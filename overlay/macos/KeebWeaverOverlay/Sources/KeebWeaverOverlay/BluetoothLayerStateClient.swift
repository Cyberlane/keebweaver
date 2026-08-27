// SPDX-License-Identifier: MIT

@preconcurrency import CoreBluetooth
import Foundation

@MainActor
final class BluetoothLayerStateClient: NSObject, @preconcurrency CBCentralManagerDelegate,
    @preconcurrency CBPeripheralDelegate {
    nonisolated static let expectedKeyboardName = "ErgoKeeb Corne"
    static let serviceUUID = CBUUID(string: "8F4B0001-2A0E-4F6E-9A1C-3D7B56C4E201")
    static let characteristicUUID = CBUUID(string: "8F4B0002-2A0E-4F6E-9A1C-3D7B56C4E201")
    static let speedCharacteristicUUID = CBUUID(string: "8F4B0003-2A0E-4F6E-9A1C-3D7B56C4E201")

    var onLayerChanged: ((Layer) -> Void)?
    var onPointerSpeedChanged: ((UInt16) -> Void)?
    var onPointerSpeedAvailabilityChanged: ((Bool) -> Void)?
    var onStatusChanged: ((String, Bool) -> Void)?

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var layerCharacteristic: CBCharacteristic?
    private var speedCharacteristic: CBCharacteristic?
    private var reconnectWorkItem: DispatchWorkItem?

    override init() {
        super.init()
    }

    func start() {
        guard central == nil else { return }
        let manager = CBCentralManager(delegate: self, queue: .main)
        central = manager

        // On some macOS versions the initial delegate callback can arrive
        // before the initializer returns. Reconcile the state once more after
        // retaining the manager so the overlay cannot remain stuck at startup.
        if manager.state != .unknown {
            centralManagerDidUpdateState(manager)
        }

        DispatchQueue.main.async { [weak self] in
            guard let self, let manager = self.central else { return }
            self.centralManagerDidUpdateState(manager)
        }
    }

    deinit {
        reconnectWorkItem?.cancel()
        central?.stopScan()
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            connectToKnownKeyboardIfPresent()
        case .unauthorized:
            report("Bluetooth permission required", connected: false)
        case .unsupported:
            report("Bluetooth is not supported", connected: false)
        case .poweredOff:
            report("Bluetooth is turned off", connected: false)
        case .resetting:
            report("Bluetooth is restarting", connected: false)
        case .unknown:
            report("Bluetooth is starting", connected: false)
        @unknown default:
            report("Bluetooth unavailable", connected: false)
        }
    }

    private func connectToKnownKeyboardIfPresent() {
        let connected = central.retrieveConnectedPeripherals(withServices: [Self.serviceUUID])
        if let existing = connected.first(where: { Self.isExpectedKeyboardName($0.name) }) {
            connect(to: existing)
        } else {
            startScanning()
        }
    }

    private func startScanning() {
        guard central.state == .poweredOn else { return }
        peripheral = nil
        layerCharacteristic = nil
        speedCharacteristic = nil
        onPointerSpeedAvailabilityChanged?(false)
        report("Searching for layer channel", connected: false)
        central.scanForPeripherals(
            // The firmware's custom service is deliberately not required to
            // appear in advertisements. Filter by the exact configured
            // keyboard name, then verify the service after connecting.
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )
    }

    private func connect(to peripheral: CBPeripheral) {
        reconnectWorkItem?.cancel()
        self.peripheral = peripheral
        layerCharacteristic = nil
        speedCharacteristic = nil
        peripheral.delegate = self
        report("Connecting to keyboard", connected: false)
        central.connect(peripheral, options: nil)
    }

    private func report(_ status: String, connected: Bool) {
        onStatusChanged?("BLE: \(status)", connected)
    }

    nonisolated static func isExpectedKeyboardName(_ name: String?) -> Bool {
        name == expectedKeyboardName
    }

    nonisolated static func supportsLayerState(_ properties: CBCharacteristicProperties) -> Bool {
        properties.contains(.read) && properties.contains(.notify)
    }

    nonisolated static func supportsPointerSpeed(_ properties: CBCharacteristicProperties) -> Bool {
        properties.contains(.read) && properties.contains(.write)
    }

    private func reject(_ peripheral: CBPeripheral, reason: String) {
        layerCharacteristic = nil
        speedCharacteristic = nil
        onPointerSpeedAvailabilityChanged?(false)
        report(reason, connected: false)
        central.cancelPeripheralConnection(peripheral)
        scheduleRetry()
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let advertisedName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        guard Self.isExpectedKeyboardName(advertisedName ?? peripheral.name) else {
            return
        }

        central.stopScan()
        connect(to: peripheral)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard Self.isExpectedKeyboardName(peripheral.name) else {
            reject(peripheral, reason: "Connected device name did not match")
            return
        }

        report("Connected; discovering layer channel", connected: false)
        peripheral.discoverServices([Self.serviceUUID])
    }

    func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        report("Keyboard connection failed; retrying", connected: false)
        scheduleRetry()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        layerCharacteristic = nil
        speedCharacteristic = nil
        onPointerSpeedAvailabilityChanged?(false)
        report("Keyboard disconnected; retrying", connected: false)
        scheduleRetry()
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil,
              let service = peripheral.services?.first(where: { $0.uuid == Self.serviceUUID }) else {
            reject(peripheral, reason: "Layer channel was not found")
            return
        }

        peripheral.discoverCharacteristics([Self.characteristicUUID, Self.speedCharacteristicUUID], for: service)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        guard error == nil, service.uuid == Self.serviceUUID,
              let characteristic = service.characteristics?.first(where: {
                  $0.uuid == Self.characteristicUUID
              }), Self.supportsLayerState(characteristic.properties) else {
            reject(peripheral, reason: "Valid layer state characteristic was not found")
            return
        }

        layerCharacteristic = characteristic
        speedCharacteristic = service.characteristics?.first(where: {
            $0.uuid == Self.speedCharacteristicUUID && Self.supportsPointerSpeed($0.properties)
        })
        onPointerSpeedAvailabilityChanged?(speedCharacteristic != nil)
        peripheral.setNotifyValue(true, for: characteristic)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == Self.characteristicUUID,
              error == nil,
              characteristic.isNotifying else {
            reject(peripheral, reason: "Layer notifications are unavailable")
            return
        }

        report("Connected; following active layer", connected: true)
        peripheral.readValue(for: characteristic)
        if let speedCharacteristic {
            peripheral.readValue(for: speedCharacteristic)
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard error == nil, let value = characteristic.value else {
            reject(peripheral, reason: "Layer channel returned an unreadable value")
            return
        }

        if characteristic.uuid == Self.characteristicUUID {
            guard let frame = LayerStateFrame(data: value) else {
                reject(peripheral, reason: "Layer channel returned a malformed frame")
                return
            }
            if let pointerSpeed = frame.pointerSpeed {
                onPointerSpeedChanged?(pointerSpeed)
            }
            if let layer = frame.layer {
                onLayerChanged?(layer)
            }
        } else if characteristic.uuid == Self.speedCharacteristicUUID {
            guard let pointerSpeed = LayerStateFrame.decodePointerSpeed(value) else {
                reject(peripheral, reason: "Pointer speed channel returned an invalid value")
                return
            }
            onPointerSpeedChanged?(pointerSpeed)
        }
    }

    func setPointerSpeed(_ speed: UInt16) {
        guard speed >= UInt16(OverlayModel.pointerSpeedMinimum),
              speed <= UInt16(OverlayModel.pointerSpeedMaximum),
              let peripheral, let speedCharacteristic,
              Self.supportsPointerSpeed(speedCharacteristic.properties) else { return }

        let data = Data([
            UInt8(speed & 0xff),
            UInt8((speed >> 8) & 0xff),
        ])
        peripheral.writeValue(data, for: speedCharacteristic, type: .withResponse)
    }

    private func scheduleRetry() {
        reconnectWorkItem?.cancel()
        let retry = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.connectToKnownKeyboardIfPresent()
        }
        reconnectWorkItem = retry
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: retry)
    }
}
