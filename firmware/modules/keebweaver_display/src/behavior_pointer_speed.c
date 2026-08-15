/*
 * Key behavior for runtime pointer-speed adjustments.
 *
 * SPDX-License-Identifier: MIT
 */

#define DT_DRV_COMPAT keebweaver_behavior_pointer_speed

#include <errno.h>

#include <zephyr/device.h>
#include <zephyr/logging/log.h>

#include <drivers/behavior.h>
#include <keebweaver/pointer_speed.h>
#include <zmk/behavior.h>
#include <dt-bindings/keebweaver/pointer_speed.h>

LOG_MODULE_REGISTER(keebweaver_pointer_speed_behavior, CONFIG_ZMK_LOG_LEVEL);

static int pointer_speed_binding_pressed(struct zmk_behavior_binding *binding,
                                         struct zmk_behavior_binding_event event) {
    ARG_UNUSED(event);

    switch (binding->param1) {
    case KEEBWEAVER_POINTER_SPEED_UP:
        return keebweaver_pointer_speed_adjust(KEEBWEAVER_POINTER_SPEED_STEP);
    case KEEBWEAVER_POINTER_SPEED_DOWN:
        return keebweaver_pointer_speed_adjust(-((int16_t)KEEBWEAVER_POINTER_SPEED_STEP));
    case KEEBWEAVER_POINTER_SPEED_RESET:
        return keebweaver_pointer_speed_set(KEEBWEAVER_POINTER_SPEED_DEFAULT);
    default:
        return -EINVAL;
    }
}

static int pointer_speed_binding_released(struct zmk_behavior_binding *binding,
                                          struct zmk_behavior_binding_event event) {
    ARG_UNUSED(binding);
    ARG_UNUSED(event);
    return ZMK_BEHAVIOR_OPAQUE;
}

static const struct behavior_driver_api pointer_speed_driver_api = {
    .locality = BEHAVIOR_LOCALITY_CENTRAL,
    .binding_pressed = pointer_speed_binding_pressed,
    .binding_released = pointer_speed_binding_released,
};

BEHAVIOR_DT_INST_DEFINE(0, NULL, NULL, NULL, NULL, POST_KERNEL, CONFIG_KERNEL_INIT_PRIORITY_DEFAULT,
                        &pointer_speed_driver_api);
