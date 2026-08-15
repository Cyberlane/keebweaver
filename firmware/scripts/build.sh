#!/usr/bin/env bash
set -euo pipefail

# Build only inside managed local directories. This script never mounts or
# writes to a keyboard volume; installation remains a separate manual action.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_root=$(cd "$script_dir/../.." && pwd)
work_root=${KEEBWEAVER_FIRMWARE_WORKSPACE:-"$project_root/.firmware-work"}
board_source_dir="$work_root/CorneZMK"
build_root="$work_root/build-work"
artifacts_dir="$project_root/firmware/artifacts"

board_source_url=https://github.com/patwyh/CorneZMK.git
board_source_commit=5d79d8b1cef4168d46d4ff975a65523928ea2ba1
zmk_commit=edf5c0814fd3ea202e43aad2d68fd32e882a518c
zephyr_commit=dacab4875df72109b96cc8977547a0dc04875bcd
container_image=zmkfirmware/zmk-build-arm@sha256:edb1c953438c6f720ddb79c3762f3972013b7fbbaf4fff3592fc869983e7afc5
zephyr_sdk_version=0.16.9
project_commit=$(git -C "$project_root" rev-parse HEAD)
project_tree=$(git -C "$project_root" rev-parse HEAD^{tree})
project_dirty=false
if [[ -n "$(git -C "$project_root" status --porcelain --untracked-files=normal)" ]]; then
  project_dirty=true
fi

mkdir -p "$work_root" "$build_root/config" "$artifacts_dir"

if [[ ! -d "$board_source_dir/.git" ]]; then
  git clone --no-checkout "$board_source_url" "$board_source_dir"
fi

git -C "$board_source_dir" fetch origin "$board_source_commit"
git -C "$board_source_dir" checkout --detach "$board_source_commit"

# Every upstream board implementation file used by the build carries an
# explicit MIT SPDX declaration. KeebWeaver supplies its own keymap.
while IFS= read -r board_file; do
  # Do not use grep -q here: with pipefail, a large source file can make
  # `git show` receive SIGPIPE after grep exits early and look like a failure.
  if ! git -C "$board_source_dir" show "$board_source_commit:$board_file" | grep 'SPDX-License-Identifier: MIT' >/dev/null; then
    printf 'Missing MIT SPDX declaration in required board source: %s\n' "$board_file" >&2
    exit 1
  fi
done <<'EOF'
boards/arm/ergokeeb_corne/Kconfig.board
boards/arm/ergokeeb_corne/Kconfig.defconfig
boards/arm/ergokeeb_corne/board.cmake
boards/arm/ergokeeb_corne/ergokeeb_corne-layouts.dtsi
boards/arm/ergokeeb_corne/ergokeeb_corne.dtsi
boards/arm/ergokeeb_corne/ergokeeb_corne_left.dts
boards/arm/ergokeeb_corne/ergokeeb_corne_left_defconfig
boards/arm/ergokeeb_corne/ergokeeb_corne_right.dts
boards/arm/ergokeeb_corne/ergokeeb_corne_right_defconfig
EOF

cp "$project_root/firmware/config/ergokeeb_corne.conf" "$build_root/config/ergokeeb_corne.conf"
cp "$project_root/firmware/config/ergokeeb_corne_left.conf" "$build_root/config/ergokeeb_corne_left.conf"
cp "$project_root/firmware/config/ergokeeb_corne.keymap" "$build_root/config/ergokeeb_corne.keymap"
cp "$project_root/firmware/config/ergokeeb_corne.overlay" "$build_root/config/ergokeeb_corne.overlay"
cp "$project_root/firmware/west.yml" "$build_root/config/west.yml"

docker run --rm \
  -v "$work_root:/work" \
  -v "$project_root:/project:ro" \
  -w /work/build-work \
  "$container_image" bash -lc '
    set -euo pipefail
    test -d /opt/zephyr-sdk-0.16.9
    if [[ ! -d .west ]]; then west init -l config; fi
    west update --fetch-opt=--filter=tree:0
    west zephyr-export
    source /work/build-work/zephyr/zephyr-env.sh
    zephyr_args="-DZephyr_DIR=/work/build-work/zephyr/share/zephyr-package/cmake -DZMK_CONFIG=/work/build-work/config -DZMK_EXTRA_MODULES=/work/CorneZMK;/project/firmware/modules/keebweaver_display"
    west build -p always -s zmk/app -d /work/build-work/out/keebweaver-ergokeeb-corne-left -b ergokeeb_corne_left \
      -S studio-rpc-usb-uart -- ${zephyr_args} -DSHIELD=nice_view -DCONFIG_ZMK_STUDIO=y -DCONFIG_ZMK_STUDIO_LOCKING=n -DCONFIG_KEEBWEAVER_LAYER_STATE_BLE=y
    west build -p always -s zmk/app -d /work/build-work/out/keebweaver-ergokeeb-corne-right -b ergokeeb_corne_right \
      -- ${zephyr_args} -DSHIELD=nice_view
    west build -p always -s zmk/app -d /work/build-work/out/keebweaver-ergokeeb-corne-settings-reset -b ergokeeb_corne_left \
      -- ${zephyr_args} -DSHIELD=settings_reset

    for target in \
      keebweaver-ergokeeb-corne-left \
      keebweaver-ergokeeb-corne-right \
      keebweaver-ergokeeb-corne-settings-reset; do
      build_dir="/work/build-work/out/${target}"
      west spdx --init -d "${build_dir}"
      west build -c -d "${build_dir}"
      west spdx -d "${build_dir}" \
        -n "https://github.com/Cyberlane/keebweaver/spdx/${target}"
      test -s "${build_dir}/spdx/app.spdx"
      test -s "${build_dir}/spdx/zephyr.spdx"
      test -s "${build_dir}/spdx/build.spdx"
    done
  '

actual_zmk=$(git -C "$build_root/zmk" rev-parse HEAD)
actual_zephyr=$(git -C "$build_root/zephyr" rev-parse HEAD)
if [[ "$actual_zmk" != "$zmk_commit" || "$actual_zephyr" != "$zephyr_commit" ]]; then
  printf 'Dependency closure mismatch: zmk=%s zephyr=%s\n' "$actual_zmk" "$actual_zephyr" >&2
  exit 1
fi

cp "$build_root/out/keebweaver-ergokeeb-corne-left/zephyr/zmk.uf2" "$artifacts_dir/keebweaver-ergokeeb-corne-left.uf2"
cp "$build_root/out/keebweaver-ergokeeb-corne-right/zephyr/zmk.uf2" "$artifacts_dir/keebweaver-ergokeeb-corne-right.uf2"
cp "$build_root/out/keebweaver-ergokeeb-corne-settings-reset/zephyr/zmk.uf2" "$artifacts_dir/keebweaver-ergokeeb-corne-settings-reset.uf2"

for target in \
  keebweaver-ergokeeb-corne-left \
  keebweaver-ergokeeb-corne-right \
  keebweaver-ergokeeb-corne-settings-reset; do
  target_spdx_dir="$artifacts_dir/spdx/$target"
  mkdir -p "$target_spdx_dir"
  cp "$build_root/out/$target/spdx/app.spdx" "$target_spdx_dir/app.spdx"
  cp "$build_root/out/$target/spdx/zephyr.spdx" "$target_spdx_dir/zephyr.spdx"
  cp "$build_root/out/$target/spdx/build.spdx" "$target_spdx_dir/build.spdx"
done

node "$project_root/scripts/verify-uf2.mjs" "$artifacts_dir"/keebweaver-*.uf2

{
  printf 'project=KeebWeaver\n'
  printf 'project_commit=%s\n' "$project_commit"
  printf 'project_tree=%s\n' "$project_tree"
  printf 'project_dirty=%s\n' "$project_dirty"
  printf 'board_source_url=%s\n' "$board_source_url"
  printf 'board_source=%s\n' "$(git -C "$board_source_dir" rev-parse HEAD)"
  printf 'zmk=%s\n' "$actual_zmk"
  printf 'zephyr=%s\n' "$actual_zephyr"
  printf 'container=%s\n' "$container_image"
  printf 'zephyr_sdk=%s\n' "$zephyr_sdk_version"
} > "$artifacts_dir/build-manifest.txt"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$artifacts_dir" && sha256sum keebweaver-*.uf2 > SHA256SUMS)
else
  (cd "$artifacts_dir" && shasum -a 256 keebweaver-*.uf2 > SHA256SUMS)
fi

printf 'Built verified artifacts in %s\n' "$artifacts_dir"
