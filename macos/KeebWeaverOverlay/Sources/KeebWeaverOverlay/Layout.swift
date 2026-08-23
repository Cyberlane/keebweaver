// SPDX-License-Identifier: MIT

import Foundation

enum Layer: String, CaseIterable, Hashable, Identifiable {
    case base = "Base"
    case navigation = "Navigation"
    case numbers = "Numbers"
    case symbols = "Symbols"

    var id: String { rawValue }

    init?(firmwareIndex: UInt8) {
        switch firmwareIndex {
        case 0: self = .base
        case 1: self = .navigation
        case 2: self = .numbers
        case 3: self = .symbols
        default: return nil
        }
    }

    var title: String { rawValue }

    var instruction: String {
        switch self {
        case .base:
            return "Normal typing layer"
        case .navigation:
            return "Hold the Enter / Nav thumb key"
        case .numbers:
            return "Hold the Num thumb key"
        case .symbols:
            return "Hold the Space / Sym thumb key"
        }
    }
}

struct KeySpec: Identifiable {
    let id: String
    let base: String
    let width: Double
    let overrides: [Layer: String]
    let shiftedOverrides: [Layer: String]

    func label(for layer: Layer) -> String {
        overrides[layer] ?? base
    }

    func shiftedLabel(for layer: Layer) -> String? {
        shiftedOverrides[layer]
    }

    func label(for layer: Layer, shiftHeld: Bool) -> String {
        guard shiftHeld else { return label(for: layer) }
        return shiftedLabel(for: layer) ?? label(for: layer)
    }

    func isOverride(for layer: Layer) -> Bool {
        overrides[layer] != nil
    }
}

enum PointerRow {
    case up
    case horizontal
    case down
}

struct KeyboardRow: Identifiable {
    let id: String
    let left: [KeySpec]
    let right: [KeySpec]
    let pointer: PointerRow
}

enum KeyboardLayout {
    // This is intentionally a small, explicit mirror of the checked-in
    // beginner keymap. The position IDs match the firmware source so drift is
    // easy to review when the layout changes.
    static let rows: [KeyboardRow] = [
        KeyboardRow(
            id: "top",
            left: [
                key("r0c0", "Tab", width: 1.15),
                key("r0c1", "Q", overrides: [.navigation: "Word\n←"]),
                key("r0c2", "W", overrides: [.navigation: "Word\n→"]),
                key("r0c3", "E", overrides: [.navigation: "Home"]),
                key("r0c4", "R", overrides: [.navigation: "End"]),
                key("r0c5", "T", overrides: [.navigation: "Page\nUp"]),
            ],
            right: [
                key("r0c11", "Y", overrides: [.numbers: "7", .symbols: "!"], shifted: [.numbers: "&"]),
                key("r0c12", "U", overrides: [.numbers: "8", .symbols: "@"], shifted: [.numbers: "*"]),
                key("r0c13", "I", overrides: [.numbers: "9", .symbols: "#"], shifted: [.numbers: "("]),
                key("r0c14", "O", overrides: [.numbers: "/", .symbols: "$"], shifted: [.numbers: "?"]),
                key("r0c15", "P", overrides: [.numbers: "⌫", .symbols: "%"]),
                key("r0c16", "⌫", width: 1.15, overrides: [.numbers: "⌦", .symbols: "⌫"]),
            ],
            pointer: .up
        ),
        KeyboardRow(
            id: "home",
            left: [
                key("r1c0", "⇧ /\nCaps", width: 1.35),
                key("r1c1", "A", overrides: [.navigation: "←"]),
                key("r1c2", "S", overrides: [.navigation: "↓"]),
                key("r1c3", "D", overrides: [.navigation: "↑"]),
                key("r1c4", "F", overrides: [.navigation: "→"]),
                key("r1c5", "G", overrides: [.navigation: "Page\nDown"]),
            ],
            right: [
                key("r1c11", "H", overrides: [.numbers: "4", .symbols: "("], shifted: [.numbers: "$"]),
                key("r1c12", "J", overrides: [.numbers: "5", .symbols: ")"], shifted: [.numbers: "%"]),
                key("r1c13", "K", overrides: [.numbers: "6", .symbols: "["], shifted: [.numbers: "^", .symbols: "{"]),
                key("r1c14", "L", overrides: [.numbers: "*", .symbols: "]"], shifted: [.symbols: "}"]),
                key("r1c15", ";", overrides: [.numbers: "Home", .symbols: "{"], shifted: [.base: ":"]),
                key("r1c16", "'", overrides: [.numbers: "Page\nUp", .symbols: "}"], shifted: [.base: "\""]),
            ],
            pointer: .horizontal
        ),
        KeyboardRow(
            id: "bottom",
            left: [
                key("r2c0", "Ctrl", width: 1.15),
                key("r2c1", "Z", overrides: [.navigation: "⌘Z"]),
                key("r2c2", "X", overrides: [.navigation: "⌘X"]),
                key("r2c3", "C", overrides: [.navigation: "⌘C"]),
                key("r2c4", "V", overrides: [.navigation: "⌘V"]),
                key("r2c5", "B", overrides: [.navigation: "⌘⇧Z"]),
            ],
            right: [
                key("r2c11", "N", overrides: [.numbers: "1", .symbols: "-"], shifted: [.numbers: "!", .symbols: "_"]),
                key("r2c12", "M", overrides: [.numbers: "2", .symbols: "="], shifted: [.numbers: "@", .symbols: "+"]),
                key("r2c13", ",", overrides: [.numbers: "3", .symbols: "<"], shifted: [.base: "<", .numbers: "#"]),
                key("r2c14", ".", overrides: [.numbers: "-", .symbols: ">"], shifted: [.base: ">", .numbers: "_"]),
                key("r2c15", "/", overrides: [.numbers: "End", .symbols: "\\"], shifted: [.base: "?", .symbols: "|"]),
                key("r2c16", "Esc", width: 1.15, overrides: [.numbers: "Page\nDown", .symbols: "`"], shifted: [.symbols: "~"]),
            ],
            pointer: .down
        ),
    ]

    static let leftThumbs: [KeySpec] = [
        key("r3c3", "⌘", width: 1.05),
        key("r3c4", "NUM\nhold", width: 1.25),
        key("r3c5", "SYM\nSpace", width: 1.5),
    ]

    static let rightThumbs: [KeySpec] = [
        key("r3c11", "ENTER\nNAV", width: 1.5, overrides: [.numbers: "0", .symbols: "Enter"]),
        key("r3c12", "—", width: 1.05, overrides: [.numbers: ".", .symbols: "'"], shifted: [.symbols: "\""]),
        key("r3c13", "⌥", width: 1.05, overrides: [.numbers: "+", .symbols: "\""]),
    ]

    static var allKeys: [KeySpec] {
        rows.flatMap { $0.left + $0.right } + leftThumbs + rightThumbs
    }

    static func key(withID id: String) -> KeySpec? {
        allKeys.first { $0.id == id }
    }

    private static func key(
        _ id: String,
        _ base: String,
        width: Double = 1,
        overrides: [Layer: String] = [:],
        shifted: [Layer: String] = [:]
    ) -> KeySpec {
        KeySpec(id: id, base: base, width: width, overrides: overrides, shiftedOverrides: shifted)
    }
}
