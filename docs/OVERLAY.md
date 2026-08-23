# macOS layout overlay

KeebWeaver includes a native macOS learning overlay for the verified ErgoKeeb
Eyelash Corne target. It is a separate companion app: it does not flash the
keyboard, change ZMK settings, inspect typed text, or require Accessibility or
Input Monitoring permission.

Build and launch it from the repository root:

```sh
bash macos/KeebWeaverOverlay/build-app.sh
open "macos/build/KeebWeaver Overlay.app"
```

The floating panel is always above normal windows and can be moved, resized,
made translucent, hidden, or set to pass through mouse clicks. The default
panel is intentionally compact; use its resize handle if you want larger
keycaps. It uses the Nord dark color scheme with Polar Night surfaces, Frost
controls, and Aurora layer accents. Use the menu-bar keyboard icon to recover
the panel when pass-through is enabled.

When the BLE-enabled left-half firmware is installed, the overlay also looks
for the KeebWeaver layer-state GATT channel. It subscribes to versioned,
encrypted notifications and switches the diagram to the currently highest
active layer. The compact speed control writes only the bounded pointer-speed
value; the firmware persists it through ZMK settings after a short debounce.
The keyboard is authoritative after reconnect, so the overlay reads the saved
value again instead of maintaining a competing macOS preference. Allow about
five seconds after the last change before powering down so the debounced write
can finish.
The Symbols-layer pointer up/down positions provide the same faster/slower
shortcuts. Bluetooth permission is required the first time the app uses
CoreBluetooth. The app does not replace the keyboard's normal macOS Bluetooth
connection.

The client requires the exact `ErgoKeeb Corne` name, service UUID, layer
read/notify properties, and speed read/write properties. Malformed values or an
unexpected characteristic contract are rejected. BLE link encryption prevents
plain unauthenticated GATT access, but a different peripheral can copy the name
and UUIDs; this is not cryptographic application identity. Automatic following
is experimental until owner-run physical-hardware qualification is recorded.

The panel has four manual views matching the runnable firmware layers:

- Base — normal QWERTY typing;
- Navigation — hold the Enter / Nav thumb key;
- Numbers — hold the Num thumb key;
- Symbols — hold the Space / Sym thumb key.

Large labels show the selected layer's output. Small labels show the underlying
base key, which makes transparent positions and layer changes easier to learn.

The `Shift held` checkbox provides a manual preview of Shift-modified output.
It makes pairs such as `,` → `<`, `.` → `>`, `-` → `_`, `=` → `+`, `\` → `|`,
and `` ` `` → `~` visible. This is a preview rather than live Shift detection;
the overlay intentionally does not inspect typed input or request Accessibility
or Input Monitoring permission.

If the helper firmware is not installed, the panel remains fully usable with
the manual layer tabs and shows the BLE search status. The firmware build
change is intentionally separate from flashing: run the repository's normal
build and verification flow, then flash only the exact custom left target as a
separate, explicit action.
