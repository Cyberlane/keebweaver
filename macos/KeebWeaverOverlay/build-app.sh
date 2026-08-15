#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
package_dir="$script_dir"
app_path="$repo_root/macos/build/KeebWeaver Overlay.app"
app_version="$(node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version);' "$repo_root/package.json")"
app_build_number="${KEEBWEAVER_BUILD_NUMBER:-1}"

case "$app_build_number" in
    ''|*[!0-9]*)
        echo "KEEBWEAVER_BUILD_NUMBER must contain only decimal digits." >&2
        exit 1
        ;;
esac

swift build --package-path "$package_dir" -c release
bin_dir="$(swift build --package-path "$package_dir" -c release --show-bin-path)"

rm -rf "$app_path"
mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
cp "$bin_dir/KeebWeaverOverlay" "$app_path/Contents/MacOS/KeebWeaverOverlay"
cp "$package_dir/Info.plist" "$app_path/Contents/Info.plist"
plutil -replace CFBundleShortVersionString -string "$app_version" "$app_path/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$app_build_number" "$app_path/Contents/Info.plist"
plutil -lint "$app_path/Contents/Info.plist"

if command -v codesign >/dev/null 2>&1; then
    codesign --force --deep --sign - "$app_path" >/dev/null
fi

echo "Built $app_path"
echo "Launch with: open \"$app_path\""
