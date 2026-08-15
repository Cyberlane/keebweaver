// SPDX-License-Identifier: MIT

import Combine
import Foundation

final class OverlayModel: ObservableObject {
    static let pointerSpeedMinimum = 300
    static let pointerSpeedMaximum = 2400
    static let pointerSpeedDefault = 1200
    static let pointerSpeedStep = 100

    @Published var selectedLayer: Layer {
        didSet {
            UserDefaults.standard.set(selectedLayer.rawValue, forKey: "selectedLayer")
        }
    }

    @Published var opacity: Double {
        didSet {
            UserDefaults.standard.set(opacity, forKey: "opacity")
        }
    }

    @Published var clickThrough: Bool {
        didSet {
            onClickThroughChanged?(clickThrough)
        }
    }

    @Published private(set) var detectedLayer: Layer?
    @Published private(set) var bluetoothStatus = "BLE: starting"
    @Published private(set) var bluetoothConnected = false
    @Published private(set) var pointerSpeedAvailable = false
    @Published private(set) var pointerSpeed = pointerSpeedDefault

    var onClickThroughChanged: ((Bool) -> Void)?
    var onPointerSpeedRequested: ((UInt16) -> Void)?
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        selectedLayer = Layer(rawValue: defaults.string(forKey: "selectedLayer") ?? "") ?? .base
        opacity = defaults.object(forKey: "opacity") as? Double ?? 0.94
        clickThrough = false
        detectedLayer = nil
    }

    var visibleLayer: Layer {
        detectedLayer ?? selectedLayer
    }

    func applyBluetoothLayer(_ layer: Layer) {
        detectedLayer = layer
    }

    func setBluetoothStatus(_ status: String, connected: Bool) {
        bluetoothStatus = status
        bluetoothConnected = connected
        if !connected {
            detectedLayer = nil
            pointerSpeedAvailable = false
        }
    }

    func setPointerSpeedChannelAvailable(_ available: Bool) {
        pointerSpeedAvailable = available
    }

    func applyBluetoothPointerSpeed(_ speed: UInt16) {
        pointerSpeed = Self.clampPointerSpeed(Int(speed))
    }

    func requestPointerSpeed(_ speed: Int) {
        guard pointerSpeedAvailable else { return }

        let clamped = Self.clampPointerSpeed(speed)
        pointerSpeed = clamped
        onPointerSpeedRequested?(UInt16(clamped))
    }

    func adjustPointerSpeed(by delta: Int) {
        requestPointerSpeed(pointerSpeed + delta)
    }

    func resetPointerSpeed() {
        requestPointerSpeed(Self.pointerSpeedDefault)
    }

    func selectManualLayer(_ layer: Layer) {
        detectedLayer = nil
        selectedLayer = layer
    }

    static func clampPointerSpeed(_ speed: Int) -> Int {
        min(max(speed, pointerSpeedMinimum), pointerSpeedMaximum)
    }
}
