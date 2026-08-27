#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
package_dir="$script_dir"
output_dir="${KEEBWEAVER_OUTPUT_DIR:-$repo_root/dist/overlay/macos}"
app_path="$output_dir/KeebWeaver Overlay.app"
app_version="$(node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version);' "$repo_root/package.json")"
app_build_number="${KEEBWEAVER_BUILD_NUMBER:-1}"
build_archs="${KEEBWEAVER_BUILD_ARCHS:-$(uname -m)}"
signing_mode="${KEEBWEAVER_SIGNING_MODE:-development}"
signing_identity="${KEEBWEAVER_CODESIGN_IDENTITY:--}"

case "$app_build_number" in
    ''|*[!0-9]*)
        echo "KEEBWEAVER_BUILD_NUMBER must contain only decimal digits." >&2
        exit 1
        ;;
esac

case "$signing_mode" in
    development)
        ;;
    distribution)
        if [[ -z "$signing_identity" || "$signing_identity" == "-" ]]; then
            echo "Distribution builds require KEEBWEAVER_CODESIGN_IDENTITY." >&2
            exit 1
        fi
        ;;
    *)
        echo "KEEBWEAVER_SIGNING_MODE must be development or distribution." >&2
        exit 1
        ;;
esac

declare -a binaries=()
declare -a seen_archs=()
for arch in $build_archs; do
    case "$arch" in
        arm64|x86_64)
            ;;
        *)
            echo "Unsupported macOS build architecture: $arch" >&2
            exit 1
            ;;
    esac

    for seen_arch in "${seen_archs[@]-}"; do
        if [[ "$seen_arch" == "$arch" ]]; then
            echo "Duplicate macOS build architecture: $arch" >&2
            exit 1
        fi
    done
    seen_archs+=("$arch")

    scratch_path="$package_dir/.build/$arch"
    triple="$arch-apple-macosx13.0"
    swift build \
        --package-path "$package_dir" \
        --scratch-path "$scratch_path" \
        --triple "$triple" \
        -c release
    bin_dir="$(swift build \
        --package-path "$package_dir" \
        --scratch-path "$scratch_path" \
        --triple "$triple" \
        -c release \
        --show-bin-path)"
    binary="$bin_dir/KeebWeaverOverlay"
    test -x "$binary"
    binaries+=("$binary")
done

rm -rf "$app_path"
mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
if [[ "${#binaries[@]}" -eq 1 ]]; then
    cp "${binaries[0]}" "$app_path/Contents/MacOS/KeebWeaverOverlay"
else
    lipo -create "${binaries[@]}" -output "$app_path/Contents/MacOS/KeebWeaverOverlay"
fi
cp "$package_dir/Info.plist" "$app_path/Contents/Info.plist"
plutil -replace CFBundleShortVersionString -string "$app_version" "$app_path/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$app_build_number" "$app_path/Contents/Info.plist"
plutil -lint "$app_path/Contents/Info.plist"

if [[ "$signing_mode" == "distribution" ]]; then
    codesign \
        --force \
        --options runtime \
        --timestamp \
        --sign "$signing_identity" \
        "$app_path"
else
    codesign --force --sign "$signing_identity" --timestamp=none "$app_path" >/dev/null
fi

echo "Built $app_path"
echo "Launch with: open \"$app_path\""
