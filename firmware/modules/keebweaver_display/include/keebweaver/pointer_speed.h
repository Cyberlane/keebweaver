/*
 * Runtime pointer-speed control shared by the input processor, key behavior,
 * and encrypted BLE control characteristic.
 *
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <stdint.h>

#define KEEBWEAVER_POINTER_SPEED_DEFAULT 1200u
#define KEEBWEAVER_POINTER_SPEED_MIN 300u
#define KEEBWEAVER_POINTER_SPEED_MAX 2400u
#define KEEBWEAVER_POINTER_SPEED_STEP 100u

uint16_t keebweaver_pointer_speed_get(void);
int keebweaver_pointer_speed_set(uint16_t speed);
int keebweaver_pointer_speed_adjust(int16_t delta);
