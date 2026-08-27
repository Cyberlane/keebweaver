#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
app_path="${1:-$repo_root/dist/overlay/macos/KeebWeaver Overlay.app}"
output_dir="${2:-$repo_root/dist/overlay/macos}"
archive_path="$output_dir/keebweaver-overlay-macos-universal.zip"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT

bash "$script_dir/verify-app.sh" "$app_path" distribution "arm64 x86_64"
mkdir -p "$output_dir"
ditto -c -k --keepParent --sequesterRsrc "$app_path" "$temporary_dir/overlay.zip"
mv "$temporary_dir/overlay.zip" "$archive_path"

ditto -x -k "$archive_path" "$temporary_dir/extracted"
bash "$script_dir/verify-app.sh" "$temporary_dir/extracted/KeebWeaver Overlay.app" distribution "arm64 x86_64"

echo "Packaged $archive_path"
