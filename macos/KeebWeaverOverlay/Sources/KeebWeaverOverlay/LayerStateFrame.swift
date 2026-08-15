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
              (frameVersion == Self.legacyVersion && data.count == Self.legacyByteCount),
              Layer(firmwareIndex: data[data.startIndex + 1]) != nil else {
            return nil
        }

        highestLayerIndex = data[data.startIndex + 1]
        activeLayerMask = UInt16(data[data.startIndex + 2]) |
            (UInt16(data[data.startIndex + 3]) << 8)
        if frameVersion == Self.version {
            guard let speed = Self.decodePointerSpeed(data.suffix(2)) else { return nil }
            pointerSpeed = speed
        } else {
            pointerSpeed = nil
        }
    }

    static func decodePointerSpeed(_ data: Data) -> UInt16? {
        guard data.count == 2 else { return nil }
        let speed = UInt16(data[data.startIndex]) |
            (UInt16(data[data.startIndex + 1]) << 8)
        guard speed >= UInt16(OverlayModel.pointerSpeedMinimum),
              speed <= UInt16(OverlayModel.pointerSpeedMaximum) else { return nil }
        return speed
    }

    var layer: Layer? {
        Layer(firmwareIndex: highestLayerIndex)
    }
}
