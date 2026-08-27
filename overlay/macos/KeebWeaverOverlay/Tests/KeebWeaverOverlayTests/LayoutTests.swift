// SPDX-License-Identifier: MIT

import XCTest
import CoreBluetooth
@testable import KeebWeaverOverlay

final class LayoutTests: XCTestCase {
    func testLayoutHasTheFourRunnableLayers() {
        XCTAssertEqual(Layer.allCases, [.base, .navigation, .numbers, .symbols])
    }

    func testPhysicalKeyCountMatchesTheReferenceLayout() {
        XCTAssertEqual(KeyboardLayout.rows.reduce(0) { $0 + $1.left.count + $1.right.count }, 36)
        XCTAssertEqual(KeyboardLayout.leftThumbs.count + KeyboardLayout.rightThumbs.count, 6)
        XCTAssertEqual(KeyboardLayout.allKeys.count, 42)
    }

    func testSymbolsLayerMatchesTheProgrammerBindings() {
        XCTAssertEqual(KeyboardLayout.key(withID: "r0c11")?.label(for: .symbols), "!")
        XCTAssertEqual(KeyboardLayout.key(withID: "r0c14")?.label(for: .symbols), "$")
        XCTAssertEqual(KeyboardLayout.key(withID: "r0c15")?.label(for: .symbols), "%")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c11")?.label(for: .symbols), "(")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c12")?.label(for: .symbols), ")")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c11")?.label(for: .symbols), "-")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c12")?.label(for: .symbols), "=")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c13")?.label(for: .symbols), "<")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c14")?.label(for: .symbols), ">")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c15")?.label(for: .symbols), "\\")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c16")?.label(for: .symbols), "`")
        XCTAssertEqual(KeyboardLayout.key(withID: "r3c13")?.label(for: .symbols), "\"")
    }

    func testShiftPreviewShowsBaseAndSymbolPairs() {
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c13")?.shiftedLabel(for: .base), "<")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c14")?.label(for: .base, shiftHeld: true), ">")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c15")?.label(for: .base, shiftHeld: true), ":")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c11")?.label(for: .symbols, shiftHeld: true), "_")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c12")?.label(for: .symbols, shiftHeld: true), "+")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c15")?.label(for: .symbols, shiftHeld: true), "|")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c16")?.label(for: .symbols, shiftHeld: true), "~")
    }

    func testNumbersLayerMatchesTheRightHandNumpad() {
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c1")?.label(for: .numbers), "Host 1")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c2")?.label(for: .numbers), "Host 2")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c3")?.label(for: .numbers), "Host 3")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c4")?.label(for: .numbers), "Host 4")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c5")?.label(for: .numbers), "Host 5")
        XCTAssertEqual(KeyboardLayout.key(withID: "r0c11")?.label(for: .numbers), "7")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c13")?.label(for: .numbers), "6")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c13")?.label(for: .numbers), "3")
        XCTAssertEqual(KeyboardLayout.key(withID: "r3c11")?.label(for: .numbers), "0")
        XCTAssertEqual(KeyboardLayout.key(withID: "r3c13")?.label(for: .numbers), "+")
    }

    func testNavigationLayerKeepsTheRightHandSideTransparent() {
        XCTAssertEqual(KeyboardLayout.key(withID: "r0c11")?.label(for: .navigation), "Y")
        XCTAssertEqual(KeyboardLayout.key(withID: "r1c1")?.label(for: .navigation), "←")
        XCTAssertEqual(KeyboardLayout.key(withID: "r2c4")?.label(for: .navigation), "⌘V")
    }

    func testLayerStateFrameDecodesThePinnedFirmwareFormat() {
        let frame = LayerStateFrame(data: Data([2, 3, 9, 0, 0xb0, 0x04]))

        XCTAssertEqual(frame?.highestLayerIndex, 3)
        XCTAssertEqual(frame?.activeLayerMask, 9)
        XCTAssertEqual(frame?.pointerSpeed, 1200)
        XCTAssertEqual(frame?.layer, .symbols)
    }

    func testLayerStateFrameKeepsReadingTheLegacyLayerOnlyFormat() {
        let frame = LayerStateFrame(data: Data([1, 3, 9, 0]))

        XCTAssertEqual(frame?.layer, .symbols)
        XCTAssertNil(frame?.pointerSpeed)
    }

    func testLayerStateFrameRejectsUnknownVersionsAndLengths() {
        XCTAssertNil(LayerStateFrame(data: Data([3, 3, 9, 0, 0xb0, 0x04])))
        XCTAssertNil(LayerStateFrame(data: Data([1, 3, 9])))
        XCTAssertNil(LayerStateFrame(data: Data([2, 3, 9, 0])))
        XCTAssertNil(LayerStateFrame(data: Data([1, 8, 9, 0]))?.layer)
        XCTAssertNil(LayerStateFrame(data: Data([2, 0, 0x10, 0, 0xb0, 0x04])))
        XCTAssertNil(LayerStateFrame(data: Data([2, 1, 0x04, 0, 0xb0, 0x04])))
        XCTAssertNil(LayerStateFrame(data: Data([2, 3, 9, 0, 1, 0])))
        XCTAssertNil(LayerStateFrame.decodePointerSpeed(Data([0xb0])))
        XCTAssertNil(LayerStateFrame.decodePointerSpeed(Data([0x61, 0x09])))
        XCTAssertEqual(LayerStateFrame.decodePointerSpeed(Data([0xb0, 0x04])), 1200)
    }

    func testBluetoothIdentityRequiresTheExactDocumentedName() {
        XCTAssertTrue(BluetoothLayerStateClient.isExpectedKeyboardName("ErgoKeeb Corne"))
        XCTAssertFalse(BluetoothLayerStateClient.isExpectedKeyboardName("Corne"))
        XCTAssertFalse(BluetoothLayerStateClient.isExpectedKeyboardName(nil))
    }

    func testBluetoothCharacteristicsRequireTheDocumentedProperties() {
        XCTAssertTrue(BluetoothLayerStateClient.supportsLayerState([.read, .notify]))
        XCTAssertFalse(BluetoothLayerStateClient.supportsLayerState([.notify]))
        XCTAssertFalse(BluetoothLayerStateClient.supportsLayerState([.read, .write]))
        XCTAssertTrue(BluetoothLayerStateClient.supportsPointerSpeed([.read, .write]))
        XCTAssertFalse(BluetoothLayerStateClient.supportsPointerSpeed([.read, .writeWithoutResponse]))
    }

    func testOverlayDefaultsToBaseAndBoundsPointerSpeedRequests() {
        let suiteName = "KeebWeaverOverlayTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let model = OverlayModel(defaults: defaults)
        var requested: UInt16?

        model.onPointerSpeedRequested = { requested = $0 }
        model.setPointerSpeedChannelAvailable(true)

        XCTAssertEqual(model.selectedLayer, .base)
        model.requestPointerSpeed(1)
        XCTAssertEqual(requested, UInt16(OverlayModel.pointerSpeedMinimum))
        model.requestPointerSpeed(9_999)
        XCTAssertEqual(requested, UInt16(OverlayModel.pointerSpeedMaximum))

        XCTAssertFalse(model.shiftPreview)
        model.shiftPreview = true
        XCTAssertTrue(OverlayModel(defaults: defaults).shiftPreview)
    }
}
