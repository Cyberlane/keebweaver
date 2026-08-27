// SPDX-License-Identifier: MIT

import Foundation

struct LayerStateFrame: Equatable {
    static let version: UInt8 = 2
    static let legacyVersion: UInt8 = 1
    static let byteCount = 6
    static let legacyByteCount = 4
    private static let supportedLayerMask = UInt16((1 << Layer.allCases.count) - 1)

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

        let decodedHighestLayerIndex = data[data.startIndex + 1]
        let decodedActiveLayerMask = UInt16(data[data.startIndex + 2]) |
            (UInt16(data[data.startIndex + 3]) << 8)
        guard decodedActiveLayerMask & ~Self.supportedLayerMask == 0,
              Self.highestActiveLayer(in: decodedActiveLayerMask) == decodedHighestLayerIndex else {
            return nil
        }

        highestLayerIndex = decodedHighestLayerIndex
        activeLayerMask = decodedActiveLayerMask
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

    private static func highestActiveLayer(in mask: UInt16) -> UInt8 {
        var remaining = mask
        var highest: UInt8 = 0
        while remaining > 1 {
            remaining >>= 1
            highest += 1
        }
        return highest
    }
}
