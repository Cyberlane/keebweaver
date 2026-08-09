# Third-party notices

KeebWeaver includes or builds with the following third-party work. The
KeebWeaver MIT license applies only to original KeebWeaver contributions.

## ZMK firmware

ZMK and the historical nice!view Mountain and Balloon bitmap data are licensed
under the MIT License. The bitmap source is
`app/boards/shields/nice_view/widgets/art.c` at commit
`f1b944b1efc01805a769cb2b15797c2c611bcc5f`. The applicable notice is preserved
in `LICENSES/ZMK-MIT.txt`.

## ErgoKeeb Corne board definitions

Firmware builds use the `ergokeeb_corne_left` and `ergokeeb_corne_right` board
definitions from `patwyh/CorneZMK` at commit
`5d79d8b1cef4168d46d4ff975a65523928ea2ba1`. The board, Kconfig, Devicetree,
and runner files used by the build carry `SPDX-License-Identifier: MIT` and
copyright notices for the ZMK Contributors. KeebWeaver supplies its own keymap
and does not redistribute the upstream repository's unlicensed example keymap.

## Three.js

The browser application uses Three.js 0.185.1 under the MIT License. The exact
dependency is recorded in `package-lock.json`.

ErgoKeeb, Eyelash Corne, ZMK, nice!view, Three.js, and other names are the
property of their respective owners. KeebWeaver is an independent community
project and is not endorsed by or affiliated with those projects or vendors.
