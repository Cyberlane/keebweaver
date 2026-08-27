#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
app_path="${1:-}"
verification_mode="${2:-}"
expected_archs="${3:-}"

if [[ -z "$app_path" || -z "$verification_mode" || -z "$expected_archs" || $# -ne 3 ]]; then
    echo "Usage: verify-app.sh <app-path> <development|distribution> <expected-architectures>" >&2
    exit 1
fi
if [[ ! -d "$app_path" ]]; then
    echo "App bundle does not exist: $app_path" >&2
    exit 1
fi

executable="$app_path/Contents/MacOS/KeebWeaverOverlay"
info_plist="$app_path/Contents/Info.plist"
test -x "$executable"
plutil -lint "$info_plist" >/dev/null
test "$(plutil -extract CFBundleIdentifier raw "$info_plist")" = "com.keebweaver.overlay"
test "$(plutil -extract LSMinimumSystemVersion raw "$info_plist")" = "13.0"
expected_version="$(node -p 'require(process.argv[1]).version' "$repo_root/package.json")"
test "$(plutil -extract CFBundleShortVersionString raw "$info_plist")" = "$expected_version"
codesign --verify --deep --strict --verbose=4 "$app_path"

actual_archs="$(lipo -archs "$executable")"
for arch in $expected_archs; do
    case " $actual_archs " in
        *" $arch "*) ;;
        *) echo "Missing expected architecture $arch (found: $actual_archs)." >&2; exit 1 ;;
    esac
done
for arch in $actual_archs; do
    case " $expected_archs " in
        *" $arch "*) ;;
        *) echo "Unexpected architecture $arch (expected: $expected_archs)." >&2; exit 1 ;;
    esac
done

case "$verification_mode" in
    development)
        ;;
    distribution)
        signature_details="$(codesign --display --verbose=4 "$app_path" 2>&1)"
        grep -Eq '^Authority=Developer ID Application:' <<<"$signature_details"
        grep -Eq '^TeamIdentifier=[A-Z0-9]+$' <<<"$signature_details"
        grep -Eq '^Timestamp=.+$' <<<"$signature_details"
        grep -Eq '^CodeDirectory .*flags=.*\(runtime\)' <<<"$signature_details"
        xcrun stapler validate "$app_path"
        spctl --assess --type execute --verbose=4 "$app_path"
        ;;
    *)
        echo "Verification mode must be development or distribution." >&2
        exit 1
        ;;
esac

echo "Verified $verification_mode app bundle: $app_path ($actual_archs)"
