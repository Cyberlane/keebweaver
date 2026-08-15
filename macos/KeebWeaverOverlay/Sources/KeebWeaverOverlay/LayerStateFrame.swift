// SPDX-License-Identifier: MIT

import Foundation

struct LayerStateFrame: Equatable {
    static let version: UInt8 = 2
    static let legacyVersion: UInt8 = 1
    static let byteCount = 6
    static let legacyByteCount = 4

    let highestLayerIndex: UInt8
    let activeLayerMask: UInt16
    let pointerSpeed: UInt16?

    init?(data: Data) {
        guard let frameVersion = data.first,
              (frameVersion == Self.version && data.count == Self.byteCount) ||
              (frameVersion == Self.legacyVersion && data.count == Self.legacyByteCount) else {
            return nil
        }

        highestLayerIndex = data[data.startIndex + 1]
        activeLayerMask = UInt16(data[data.startIndex + 2]) |
            (UInt16(data[data.startIndex + 3]) << 8)
        pointerSpeed = frameVersion == Self.version
            ? UInt16(data[data.startIndex + 4]) | (UInt16(data[data.startIndex + 5]) << 8)
            : nil
    }

    var layer: Layer? {
        Layer(firmwareIndex: highestLayerIndex)
    }
}
