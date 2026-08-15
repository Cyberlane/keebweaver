/*
 * Encrypted BLE layer-state and runtime pointer-speed channel for the
 * KeebWeaver macOS overlay.
 *
 * SPDX-License-Identifier: MIT
 */

#include <errno.h>
#include <stdint.h>

#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/byteorder.h>

#include <zmk/event_manager.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/keymap.h>
#include <keebweaver/pointer_speed.h>

LOG_MODULE_REGISTER(keebweaver_layer_state, CONFIG_ZMK_LOG_LEVEL);

#define KEEBWEAVER_LAYER_STATE_SERVICE_UUID                                              \
    BT_UUID_DECLARE_128(BT_UUID_128_ENCODE(0x8f4b0001, 0x2a0e, 0x4f6e, 0x9a1c, 0x3d7b56c4e201))
#define KEEBWEAVER_LAYER_STATE_CHARACTERISTIC_UUID                                        \
    BT_UUID_DECLARE_128(BT_UUID_128_ENCODE(0x8f4b0002, 0x2a0e, 0x4f6e, 0x9a1c, 0x3d7b56c4e201))
#define KEEBWEAVER_POINTER_SPEED_CHARACTERISTIC_UUID                                      \
    BT_UUID_DECLARE_128(BT_UUID_128_ENCODE(0x8f4b0003, 0x2a0e, 0x4f6e, 0x9a1c, 0x3d7b56c4e201))

#define KEEBWEAVER_LAYER_STATE_FRAME_VERSION 2u
#define KEEBWEAVER_LAYER_STATE_FRAME_BYTES 6u

static uint8_t layer_state_frame[KEEBWEAVER_LAYER_STATE_FRAME_BYTES];

static void notify_layer_state(void);

static void fill_layer_state_frame(void) {
    layer_state_frame[0] = KEEBWEAVER_LAYER_STATE_FRAME_VERSION;
    layer_state_frame[1] = zmk_keymap_highest_layer_active();
    sys_put_le16((uint16_t)zmk_keymap_layer_state(), &layer_state_frame[2]);
    sys_put_le16(keebweaver_pointer_speed_get(), &layer_state_frame[4]);
}

static ssize_t read_layer_state(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf,
                                uint16_t len, uint16_t offset) {
    ARG_UNUSED(attr);

    fill_layer_state_frame();

    return bt_gatt_attr_read(conn, attr, buf, len, offset, layer_state_frame,
                             sizeof(layer_state_frame));
}

static ssize_t read_pointer_speed(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf,
                                  uint16_t len, uint16_t offset) {
    uint8_t speed[2];

    ARG_UNUSED(attr);
    sys_put_le16(keebweaver_pointer_speed_get(), speed);

    return bt_gatt_attr_read(conn, attr, buf, len, offset, speed, sizeof(speed));
}

static ssize_t write_pointer_speed(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                                   const void *buf, uint16_t len, uint16_t offset, uint8_t flags) {
    ARG_UNUSED(conn);
    ARG_UNUSED(attr);
    ARG_UNUSED(flags);

    if (offset != 0) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }

    if (len != 2) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
    }

    keebweaver_pointer_speed_set(sys_get_le16(buf));
    notify_layer_state();
    return len;
}

static void layer_state_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value) {
    ARG_UNUSED(attr);

    if (value == BT_GATT_CCC_NOTIFY) {
        // Send the current state immediately so a newly connected overlay does
        // not need to wait for the next layer transition.
        notify_layer_state();
    }
}

BT_GATT_SERVICE_DEFINE(
    keebweaver_layer_state,
    BT_GATT_PRIMARY_SERVICE(KEEBWEAVER_LAYER_STATE_SERVICE_UUID),
    BT_GATT_CHARACTERISTIC(KEEBWEAVER_LAYER_STATE_CHARACTERISTIC_UUID,
                           BT_GATT_CHRC_READ | BT_GATT_CHRC_NOTIFY, BT_GATT_PERM_READ_ENCRYPT,
                           read_layer_state, NULL, NULL),
    BT_GATT_CCC(layer_state_ccc_changed,
                BT_GATT_PERM_READ_ENCRYPT | BT_GATT_PERM_WRITE_ENCRYPT),
    BT_GATT_CHARACTERISTIC(KEEBWEAVER_POINTER_SPEED_CHARACTERISTIC_UUID,
                           BT_GATT_CHRC_READ | BT_GATT_CHRC_WRITE,
                           BT_GATT_PERM_READ_ENCRYPT | BT_GATT_PERM_WRITE_ENCRYPT,
                           read_pointer_speed, write_pointer_speed, NULL));

static void notify_layer_state(void) {
    fill_layer_state_frame();

    int err = bt_gatt_notify(NULL, &keebweaver_layer_state.attrs[1], layer_state_frame,
                             sizeof(layer_state_frame));
    if (err < 0 && err != -ENOTCONN) {
        LOG_WRN("Failed to notify layer state (%d)", err);
    }
}

static int layer_state_listener(const zmk_event_t *event) {
    ARG_UNUSED(event);
    notify_layer_state();
    return ZMK_EV_EVENT_BUBBLE;
}

ZMK_LISTENER(keebweaver_layer_state, layer_state_listener);
ZMK_SUBSCRIPTION(keebweaver_layer_state, zmk_layer_state_changed);
