/*
 * Runtime scaling for relative pointer events.
 *
 * SPDX-License-Identifier: MIT
 */

#define DT_DRV_COMPAT keebweaver_input_processor_pointer_speed

#include <errno.h>
#include <stdint.h>

#include <zephyr/device.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/settings/settings.h>
#include <zephyr/sys/atomic.h>

#include <drivers/input_processor.h>
#include <keebweaver/pointer_speed.h>

LOG_MODULE_REGISTER(keebweaver_pointer_speed, CONFIG_ZMK_LOG_LEVEL);

#define POINTER_SPEED_SETTINGS_KEY "keebweaver/pointer_speed"

struct pointer_speed_config {
    uint8_t type;
    size_t codes_len;
    uint16_t codes[];
};

static atomic_t pointer_speed = ATOMIC_INIT(KEEBWEAVER_POINTER_SPEED_DEFAULT);

static uint16_t clamp_speed(uint16_t speed) {
    if (speed < KEEBWEAVER_POINTER_SPEED_MIN) {
        return KEEBWEAVER_POINTER_SPEED_MIN;
    }

    if (speed > KEEBWEAVER_POINTER_SPEED_MAX) {
        return KEEBWEAVER_POINTER_SPEED_MAX;
    }

    return speed;
}

#if IS_ENABLED(CONFIG_SETTINGS)
static int pointer_speed_settings_load_cb(const char *name, size_t len,
                                          settings_read_cb read_cb, void *cb_arg) {
    const char *next;
    uint16_t saved_speed;

    if (!settings_name_steq(name, "pointer_speed", &next) || next) {
        return -ENOENT;
    }

    if (len != sizeof(saved_speed)) {
        return -EINVAL;
    }

    int rc = read_cb(cb_arg, &saved_speed, sizeof(saved_speed));
    if (rc < 0) {
        return rc;
    }

    atomic_set(&pointer_speed, clamp_speed(saved_speed));
    return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(keebweaver_pointer_speed, "keebweaver", NULL,
                               pointer_speed_settings_load_cb, NULL, NULL);

static void pointer_speed_save_work_handler(struct k_work *work) {
    ARG_UNUSED(work);

    uint16_t speed = keebweaver_pointer_speed_get();
    int rc = settings_save_one(POINTER_SPEED_SETTINGS_KEY, &speed, sizeof(speed));
    if (rc < 0) {
        LOG_WRN("Failed to persist pointer speed (%d)", rc);
    }
}

static K_WORK_DELAYABLE_DEFINE(pointer_speed_save_work, pointer_speed_save_work_handler);
#endif

uint16_t keebweaver_pointer_speed_get(void) {
    return (uint16_t)atomic_get(&pointer_speed);
}

int keebweaver_pointer_speed_set(uint16_t speed) {
    uint16_t clamped_speed = clamp_speed(speed);
    if (keebweaver_pointer_speed_get() == clamped_speed) {
        return 0;
    }

    atomic_set(&pointer_speed, clamped_speed);

#if IS_ENABLED(CONFIG_SETTINGS)
    int rc = k_work_reschedule(&pointer_speed_save_work,
                               K_MSEC(CONFIG_KEEBWEAVER_POINTER_SPEED_SAVE_DEBOUNCE_MS));
    if (rc < 0) {
        LOG_WRN("Failed to schedule pointer-speed persistence (%d)", rc);
    }
#endif

    return 0;
}

int keebweaver_pointer_speed_adjust(int16_t delta) {
    int32_t next = (int32_t)keebweaver_pointer_speed_get() + delta;

    if (next < KEEBWEAVER_POINTER_SPEED_MIN) {
        next = KEEBWEAVER_POINTER_SPEED_MIN;
    } else if (next > KEEBWEAVER_POINTER_SPEED_MAX) {
        next = KEEBWEAVER_POINTER_SPEED_MAX;
    }

    return keebweaver_pointer_speed_set((uint16_t)next);
}

static int pointer_speed_handle_event(const struct device *dev, struct input_event *event,
                                      uint32_t param1, uint32_t param2,
                                      struct zmk_input_processor_state *state) {
    const struct pointer_speed_config *config = dev->config;

    ARG_UNUSED(param1);
    ARG_UNUSED(param2);

    if (event->type != config->type) {
        return ZMK_INPUT_PROC_CONTINUE;
    }

    for (size_t index = 0; index < config->codes_len; index++) {
        if (config->codes[index] != event->code) {
            continue;
        }

        const int32_t numerator = event->value * (int32_t)keebweaver_pointer_speed_get() +
                                  ((state && state->remainder) ? *state->remainder : 0);
        const int32_t scaled = numerator / (int32_t)KEEBWEAVER_POINTER_SPEED_DEFAULT;

        if (state && state->remainder) {
            *state->remainder = (int16_t)(numerator -
                                          (scaled * (int32_t)KEEBWEAVER_POINTER_SPEED_DEFAULT));
        }

        event->value = scaled;
        return ZMK_INPUT_PROC_CONTINUE;
    }

    return ZMK_INPUT_PROC_CONTINUE;
}

static const struct zmk_input_processor_driver_api pointer_speed_driver_api = {
    .handle_event = pointer_speed_handle_event,
};

#define POINTER_SPEED_INST(n)                                                                     \
    static const struct pointer_speed_config pointer_speed_config_##n = {                         \
        .type = DT_INST_PROP(n, type),                                                            \
        .codes_len = DT_INST_PROP_LEN(n, codes),                                                   \
        .codes = DT_INST_PROP(n, codes),                                                           \
    };                                                                                             \
    DEVICE_DT_INST_DEFINE(n, NULL, NULL, NULL, &pointer_speed_config_##n, POST_KERNEL,            \
                          CONFIG_KERNEL_INIT_PRIORITY_DEFAULT, &pointer_speed_driver_api);

DT_INST_FOREACH_STATUS_OKAY(POINTER_SPEED_INST)
