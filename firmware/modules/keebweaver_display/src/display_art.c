/*
 * USB-updatable, persistent artwork for supported nice!view displays.
 *
 * The artwork payload is a 160x68, one-bit alpha bitmap (1,360 bytes). It
 * lives in a dedicated partition with two 4 KiB commit slots; a partially
 * interrupted transfer therefore leaves the last valid image intact.
 */

#include <errno.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include <zephyr/device.h>
#include <zephyr/drivers/uart.h>
#include <zephyr/kernel.h>
#include <zephyr/storage/flash_map.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/sys/crc.h>
#include <zephyr/sys/util.h>

#include <lvgl.h>

#include <zmk/display.h>
#include <zmk/event_manager.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/keymap.h>

#define KEEBWEAVER_ART_WIDTH 160
#define KEEBWEAVER_ART_HEIGHT 68
#define KEEBWEAVER_ART_PORTRAIT_WIDTH KEEBWEAVER_ART_HEIGHT
#define KEEBWEAVER_ART_PORTRAIT_HEIGHT KEEBWEAVER_ART_WIDTH
#define KEEBWEAVER_ART_ROW_BYTES (KEEBWEAVER_ART_WIDTH / 8)
#define KEEBWEAVER_ART_BYTES (KEEBWEAVER_ART_ROW_BYTES * KEEBWEAVER_ART_HEIGHT)

#define KEEBWEAVER_ART_MAGIC 0x5241574Bu /* "KWAR" in little-endian flash */
#define KEEBWEAVER_ART_VERSION 1u
#define KEEBWEAVER_ART_SLOT_SIZE 4096u
#define KEEBWEAVER_ART_SLOT_COUNT 2u

#define KEEBWEAVER_FRAME_MAGIC_0 'K'
#define KEEBWEAVER_FRAME_MAGIC_1 'W'
#define KEEBWEAVER_FRAME_MAGIC_2 'A'
#define KEEBWEAVER_FRAME_MAGIC_3 'R'
#define KEEBWEAVER_FRAME_VERSION 1u
#define KEEBWEAVER_FRAME_HEADER_BYTES 12u
#define KEEBWEAVER_FRAME_MAX_PAYLOAD 130u

enum keebweaver_frame_command {
    KEEBWEAVER_FRAME_HELLO = 1,
    KEEBWEAVER_FRAME_BEGIN = 2,
    KEEBWEAVER_FRAME_CHUNK = 3,
    KEEBWEAVER_FRAME_COMMIT = 4,
    KEEBWEAVER_FRAME_ABORT = 5,
};

enum keebweaver_frame_status {
    KEEBWEAVER_STATUS_OK = 0,
    KEEBWEAVER_STATUS_BAD_FRAME = 1,
    KEEBWEAVER_STATUS_BAD_COMMAND = 2,
    KEEBWEAVER_STATUS_BAD_LENGTH = 3,
    KEEBWEAVER_STATUS_BAD_CRC = 4,
    KEEBWEAVER_STATUS_BAD_OFFSET = 5,
    KEEBWEAVER_STATUS_FLASH_ERROR = 6,
};

struct keebweaver_art_record {
    uint32_t magic;
    uint16_t version;
    uint16_t payload_size;
    uint32_t sequence;
    uint32_t crc;
};

BUILD_ASSERT(sizeof(struct keebweaver_art_record) == 16,
             "Artwork record header must have a stable flash layout");
BUILD_ASSERT(KEEBWEAVER_ART_BYTES == 1360, "Artwork payload size changed unexpectedly");
BUILD_ASSERT(FIXED_PARTITION_SIZE(keebweaver_display_art) >=
                 KEEBWEAVER_ART_SLOT_COUNT * KEEBWEAVER_ART_SLOT_SIZE,
             "Artwork partition cannot hold two atomic slots");

static const struct device *const display_uart = DEVICE_DT_GET(DT_NODELABEL(keebweaver_display_usb));

static const struct flash_area *art_area;
static uint8_t artwork_buffers[2][KEEBWEAVER_ART_BYTES];
static uint8_t upload_buffer[KEEBWEAVER_ART_BYTES];
static uint8_t candidate_buffer[KEEBWEAVER_ART_BYTES];
static uint8_t active_buffer;
static int active_slot = -1;
static uint32_t active_sequence;
static uint16_t upload_next_offset;
static bool artwork_loaded;
static lv_obj_t *artwork_object;
static lv_obj_t *layer_object;

static lv_img_dsc_t artwork_descriptor = {
    .header =
        {
            .cf = LV_IMG_CF_ALPHA_1BIT,
            .always_zero = 0,
            .reserved = 0,
            .w = KEEBWEAVER_ART_WIDTH,
            .h = KEEBWEAVER_ART_HEIGHT,
        },
    .data_size = KEEBWEAVER_ART_BYTES,
    .data = artwork_buffers[0],
};

static void set_pixel(uint8_t *art, uint16_t x, uint16_t y) {
    if (x >= KEEBWEAVER_ART_WIDTH || y >= KEEBWEAVER_ART_HEIGHT) {
        return;
    }

    art[y * KEEBWEAVER_ART_ROW_BYTES + (x / 8)] |= BIT(7 - (x % 8));
}

static void set_portrait_pixel(uint8_t *art, int x, int y) {
    if (x < 0 || x >= KEEBWEAVER_ART_PORTRAIT_WIDTH || y < 0 ||
        y >= KEEBWEAVER_ART_PORTRAIT_HEIGHT) {
        return;
    }
    set_pixel(art, KEEBWEAVER_ART_WIDTH - 1 - y, x);
}

static void draw_line(uint8_t *art, int x0, int y0, int x1, int y1) {
    int dx = x1 >= x0 ? x1 - x0 : x0 - x1;
    int sx = x0 < x1 ? 1 : -1;
    int dy = -(y1 >= y0 ? y1 - y0 : y0 - y1);
    int sy = y0 < y1 ? 1 : -1;
    int error = dx + dy;

    for (;;) {
        set_portrait_pixel(art, x0, y0);
        if (x0 == x1 && y0 == y1) {
            return;
        }
        int twice_error = 2 * error;
        if (twice_error >= dy) {
            error += dy;
            x0 += sx;
        }
        if (twice_error <= dx) {
            error += dx;
            y0 += sy;
        }
    }
}

static void seed_default_art(uint8_t *art) {
    memset(art, 0, KEEBWEAVER_ART_BYTES);

    // Compose in the same 68x160 portrait coordinate system shown by the web
    // editor, then rotate each point into the native 160x68 device buffer.
    for (int x = 2; x < KEEBWEAVER_ART_PORTRAIT_WIDTH - 2; ++x) {
        set_portrait_pixel(art, x, 2);
        set_portrait_pixel(art, x, 143);
    }
    for (int y = 2; y <= 143; ++y) {
        set_portrait_pixel(art, 2, y);
        set_portrait_pixel(art, KEEBWEAVER_ART_PORTRAIT_WIDTH - 3, y);
    }

    draw_line(art, 4, 137, 21, 104);
    draw_line(art, 21, 104, 38, 137);
    draw_line(art, 27, 137, 48, 88);
    draw_line(art, 48, 88, 64, 137);
    draw_line(art, 43, 100, 48, 88);
    draw_line(art, 48, 88, 53, 103);
    for (int x = 5; x < 64; x += 4) {
        set_portrait_pixel(art, x, 139 + ((x / 4) % 2));
    }
    set_portrait_pixel(art, 10, 45);
    set_portrait_pixel(art, 24, 53);
    set_portrait_pixel(art, 41, 43);
    set_portrait_pixel(art, 58, 57);
    set_portrait_pixel(art, 49, 70);
}

static bool read_slot(uint8_t slot, struct keebweaver_art_record *record, uint8_t *destination) {
    if (slot >= KEEBWEAVER_ART_SLOT_COUNT || art_area == NULL) {
        return false;
    }

    off_t offset = (off_t)slot * KEEBWEAVER_ART_SLOT_SIZE;
    if (flash_area_read(art_area, offset, record, sizeof(*record)) != 0 ||
        record->magic != KEEBWEAVER_ART_MAGIC || record->version != KEEBWEAVER_ART_VERSION ||
        record->payload_size != KEEBWEAVER_ART_BYTES) {
        return false;
    }

    if (flash_area_read(art_area, offset + sizeof(*record), destination, KEEBWEAVER_ART_BYTES) != 0) {
        return false;
    }

    return crc32_ieee(destination, KEEBWEAVER_ART_BYTES) == record->crc;
}

static void load_artwork(void) {
    if (artwork_loaded) {
        return;
    }
    artwork_loaded = true;

    if (flash_area_open(FIXED_PARTITION_ID(keebweaver_display_art), &art_area) != 0) {
        seed_default_art(artwork_buffers[0]);
        return;
    }

    bool found = false;
    for (uint8_t slot = 0; slot < KEEBWEAVER_ART_SLOT_COUNT; ++slot) {
        struct keebweaver_art_record record;
        if (!read_slot(slot, &record, candidate_buffer)) {
            continue;
        }
        if (!found || record.sequence > active_sequence) {
            memcpy(artwork_buffers[0], candidate_buffer, KEEBWEAVER_ART_BYTES);
            active_slot = slot;
            active_sequence = record.sequence;
            found = true;
        }
    }

    if (!found) {
        seed_default_art(artwork_buffers[0]);
    }
}

static int persist_artwork(const uint8_t *art, uint32_t crc) {
    if (art_area == NULL) {
        return -ENODEV;
    }

    uint8_t target_slot = active_slot == 0 ? 1 : 0;
    off_t offset = (off_t)target_slot * KEEBWEAVER_ART_SLOT_SIZE;
    struct keebweaver_art_record record = {
        .magic = UINT32_MAX,
        .version = KEEBWEAVER_ART_VERSION,
        .payload_size = KEEBWEAVER_ART_BYTES,
        .sequence = active_sequence + 1,
        .crc = crc,
    };

    int err = flash_area_erase(art_area, offset, KEEBWEAVER_ART_SLOT_SIZE);
    if (err != 0) {
        return err;
    }
    err = flash_area_write(art_area, offset + sizeof(record), art, KEEBWEAVER_ART_BYTES);
    if (err != 0) {
        return err;
    }
    // Write all metadata except the validity marker first. The magic word is
    // written last, so a lost USB/power connection cannot activate a partial image.
    err = flash_area_write(art_area, offset + sizeof(record.magic),
                           ((const uint8_t *)&record) + sizeof(record.magic),
                           sizeof(record) - sizeof(record.magic));
    if (err != 0) {
        return err;
    }
    uint32_t magic = KEEBWEAVER_ART_MAGIC;
    err = flash_area_write(art_area, offset, &magic, sizeof(magic));
    if (err == 0) {
        active_slot = target_slot;
        active_sequence = record.sequence;
    }
    return err;
}

static void refresh_artwork_display(struct k_work *work) {
    ARG_UNUSED(work);
    if (artwork_object == NULL) {
        return;
    }
    artwork_descriptor.data = artwork_buffers[active_buffer];
    lv_img_cache_invalidate_src(&artwork_descriptor);
    lv_img_set_src(artwork_object, &artwork_descriptor);
    lv_obj_invalidate(artwork_object);
}

K_WORK_DEFINE(refresh_artwork_work, refresh_artwork_display);

static void activate_uploaded_artwork(void) {
    uint8_t next_buffer = active_buffer == 0 ? 1 : 0;
    memcpy(artwork_buffers[next_buffer], upload_buffer, KEEBWEAVER_ART_BYTES);
    active_buffer = next_buffer;
    if (zmk_display_is_initialized()) {
        k_work_submit_to_queue(zmk_display_work_q(), &refresh_artwork_work);
    }
}

static void send_frame(uint8_t command, const uint8_t *payload, uint16_t payload_size) {
    uint8_t header[KEEBWEAVER_FRAME_HEADER_BYTES] = {
        KEEBWEAVER_FRAME_MAGIC_0,
        KEEBWEAVER_FRAME_MAGIC_1,
        KEEBWEAVER_FRAME_MAGIC_2,
        KEEBWEAVER_FRAME_MAGIC_3,
        KEEBWEAVER_FRAME_VERSION,
        command,
        0,
        0,
        0,
        0,
        0,
        0,
    };
    sys_put_le16(payload_size, &header[6]);
    sys_put_le32(crc32_ieee(payload, payload_size), &header[8]);

    for (size_t index = 0; index < sizeof(header); ++index) {
        uart_poll_out(display_uart, header[index]);
    }
    for (uint16_t index = 0; index < payload_size; ++index) {
        uart_poll_out(display_uart, payload[index]);
    }
}

static void send_status(uint8_t command, enum keebweaver_frame_status status) {
    uint8_t response[] = {status};
    send_frame(command | 0x80u, response, sizeof(response));
}

static void handle_frame(uint8_t command, const uint8_t *payload, uint16_t payload_size) {
    if (command == KEEBWEAVER_FRAME_HELLO) {
        if (payload_size != 0) {
            send_status(command, KEEBWEAVER_STATUS_BAD_LENGTH);
            return;
        }
        uint8_t response[9] = {KEEBWEAVER_STATUS_OK,
#if IS_ENABLED(CONFIG_ZMK_SPLIT_ROLE_CENTRAL)
                               'L',
#else
                               'R',
#endif
                               KEEBWEAVER_FRAME_VERSION, 0, 0, 0, 0, 0, 0};
        sys_put_le16(KEEBWEAVER_ART_WIDTH, &response[3]);
        sys_put_le16(KEEBWEAVER_ART_HEIGHT, &response[5]);
        sys_put_le16(KEEBWEAVER_ART_BYTES, &response[7]);
        send_frame(command | 0x80u, response, sizeof(response));
        return;
    }

    if (command == KEEBWEAVER_FRAME_ABORT) {
        upload_next_offset = 0;
        send_status(command, KEEBWEAVER_STATUS_OK);
        return;
    }

    if (command == KEEBWEAVER_FRAME_BEGIN) {
        if (payload_size != sizeof(uint32_t) || sys_get_le32(payload) != KEEBWEAVER_ART_BYTES) {
            send_status(command, KEEBWEAVER_STATUS_BAD_LENGTH);
            return;
        }
        upload_next_offset = 0;
        send_status(command, KEEBWEAVER_STATUS_OK);
        return;
    }

    if (command == KEEBWEAVER_FRAME_CHUNK) {
        if (payload_size < sizeof(uint16_t)) {
            send_status(command, KEEBWEAVER_STATUS_BAD_LENGTH);
            return;
        }
        uint16_t offset = sys_get_le16(payload);
        uint16_t data_size = payload_size - sizeof(uint16_t);
        if (offset != upload_next_offset || data_size == 0 ||
            offset + data_size > KEEBWEAVER_ART_BYTES) {
            send_status(command, KEEBWEAVER_STATUS_BAD_OFFSET);
            return;
        }
        memcpy(upload_buffer + offset, payload + sizeof(uint16_t), data_size);
        upload_next_offset += data_size;
        send_status(command, KEEBWEAVER_STATUS_OK);
        return;
    }

    if (command == KEEBWEAVER_FRAME_COMMIT) {
        if (payload_size != sizeof(uint32_t) || upload_next_offset != KEEBWEAVER_ART_BYTES) {
            send_status(command, KEEBWEAVER_STATUS_BAD_LENGTH);
            return;
        }
        uint32_t expected_crc = sys_get_le32(payload);
        if (crc32_ieee(upload_buffer, KEEBWEAVER_ART_BYTES) != expected_crc) {
            send_status(command, KEEBWEAVER_STATUS_BAD_CRC);
            return;
        }
        if (persist_artwork(upload_buffer, expected_crc) != 0) {
            send_status(command, KEEBWEAVER_STATUS_FLASH_ERROR);
            return;
        }
        activate_uploaded_artwork();
        upload_next_offset = 0;
        send_status(command, KEEBWEAVER_STATUS_OK);
        return;
    }

    send_status(command, KEEBWEAVER_STATUS_BAD_COMMAND);
}

struct keebweaver_rx_state {
    uint8_t header[KEEBWEAVER_FRAME_HEADER_BYTES];
    uint8_t payload[KEEBWEAVER_FRAME_MAX_PAYLOAD];
    uint16_t header_size;
    uint16_t payload_size;
    uint16_t payload_index;
};

static struct keebweaver_rx_state rx;

static void reset_rx(void) {
    rx.header_size = 0;
    rx.payload_size = 0;
    rx.payload_index = 0;
}

static bool header_prefix_is_valid(void) {
    static const uint8_t magic[] = {KEEBWEAVER_FRAME_MAGIC_0, KEEBWEAVER_FRAME_MAGIC_1,
                                    KEEBWEAVER_FRAME_MAGIC_2, KEEBWEAVER_FRAME_MAGIC_3};
    for (uint16_t index = 0; index < MIN(rx.header_size, ARRAY_SIZE(magic)); ++index) {
        if (rx.header[index] != magic[index]) {
            return false;
        }
    }
    return true;
}

static void consume_rx_byte(uint8_t byte) {
    if (rx.header_size < KEEBWEAVER_FRAME_HEADER_BYTES) {
        rx.header[rx.header_size++] = byte;
        if (!header_prefix_is_valid()) {
            reset_rx();
            if (byte == KEEBWEAVER_FRAME_MAGIC_0) {
                rx.header[rx.header_size++] = byte;
            }
            return;
        }
        if (rx.header_size != KEEBWEAVER_FRAME_HEADER_BYTES) {
            return;
        }
        rx.payload_size = sys_get_le16(&rx.header[6]);
        if (rx.header[4] != KEEBWEAVER_FRAME_VERSION ||
            rx.payload_size > KEEBWEAVER_FRAME_MAX_PAYLOAD) {
            reset_rx();
            return;
        }
        if (rx.payload_size == 0) {
            if (sys_get_le32(&rx.header[8]) == crc32_ieee((const uint8_t *)"", 0)) {
                handle_frame(rx.header[5], NULL, 0);
            }
            reset_rx();
        }
        return;
    }

    rx.payload[rx.payload_index++] = byte;
    if (rx.payload_index != rx.payload_size) {
        return;
    }
    if (crc32_ieee(rx.payload, rx.payload_size) == sys_get_le32(&rx.header[8])) {
        handle_frame(rx.header[5], rx.payload, rx.payload_size);
    } else {
        send_status(rx.header[5], KEEBWEAVER_STATUS_BAD_CRC);
    }
    reset_rx();
}

static void display_usb_receiver(void) {
    uint8_t byte;
    for (;;) {
        while (uart_poll_in(display_uart, &byte) == 0) {
            consume_rx_byte(byte);
        }
        k_msleep(1);
    }
}

K_THREAD_DEFINE(keebweaver_display_usb_thread, CONFIG_KEEBWEAVER_DISPLAY_ART_USB_STACK_SIZE,
                display_usb_receiver, NULL, NULL, NULL, K_LOWEST_APPLICATION_THREAD_PRIO, 0, 0);

#if IS_ENABLED(CONFIG_ZMK_SPLIT_ROLE_CENTRAL)

struct layer_art_state {
    const char *label;
};

static void update_layer_art_status(struct layer_art_state state) {
    if (layer_object == NULL) {
        return;
    }
    lv_label_set_text(layer_object, state.label == NULL || state.label[0] == '\0' ? "Base"
                                                                            : state.label);
}

static struct layer_art_state get_layer_art_status(const zmk_event_t *event) {
    ARG_UNUSED(event);
    zmk_keymap_layer_index_t index = zmk_keymap_highest_layer_active();
    return (struct layer_art_state){.label =
                                        zmk_keymap_layer_name(zmk_keymap_layer_index_to_id(index))};
}

ZMK_DISPLAY_WIDGET_LISTENER(art_layer_status, struct layer_art_state, update_layer_art_status,
                            get_layer_art_status)
ZMK_SUBSCRIPTION(art_layer_status, zmk_layer_state_changed);

#endif

lv_obj_t *zmk_display_status_screen(void) {
    load_artwork();
    artwork_descriptor.data = artwork_buffers[active_buffer];

    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_set_size(screen, KEEBWEAVER_ART_WIDTH, KEEBWEAVER_ART_HEIGHT);
    lv_obj_set_style_bg_color(screen, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, LV_PART_MAIN);

    artwork_object = lv_img_create(screen);
    lv_img_set_src(artwork_object, &artwork_descriptor);
    lv_obj_align(artwork_object, LV_ALIGN_TOP_LEFT, 0, 0);

    layer_object = lv_label_create(screen);
    lv_obj_set_size(layer_object, 60, 18);
    lv_label_set_long_mode(layer_object, LV_LABEL_LONG_CLIP);
    lv_obj_set_style_text_font(layer_object, &lv_font_montserrat_14, LV_PART_MAIN);
    lv_obj_set_style_text_color(layer_object, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_text_align(layer_object, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_set_style_bg_color(layer_object, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(layer_object, LV_OPA_70, LV_PART_MAIN);
    lv_obj_set_style_transform_pivot_x(layer_object, 0, LV_PART_MAIN);
    lv_obj_set_style_transform_pivot_y(layer_object, 0, LV_PART_MAIN);
    lv_obj_set_style_transform_angle(layer_object, 900, LV_PART_MAIN);
    lv_obj_set_pos(layer_object, 17, 4);
#if IS_ENABLED(CONFIG_ZMK_SPLIT_ROLE_CENTRAL)
    art_layer_status_init();
#else
    lv_label_set_text(layer_object, "Artwork");
#endif

    return screen;
}
