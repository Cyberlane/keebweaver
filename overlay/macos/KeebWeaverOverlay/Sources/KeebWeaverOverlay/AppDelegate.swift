// SPDX-License-Identifier: MIT

import AppKit
import SwiftUI

final class OverlayPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = OverlayModel()

    private var panel: OverlayPanel!
    private var statusItem: NSStatusItem!
    private var clickThroughMenuItem: NSMenuItem!
    private var bluetoothClient: BluetoothLayerStateClient!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        createPanel()
        createStatusItem()

        bluetoothClient = BluetoothLayerStateClient()
        bluetoothClient.onLayerChanged = { [weak self] layer in
            self?.model.applyBluetoothLayer(layer)
        }
        bluetoothClient.onPointerSpeedChanged = { [weak self] speed in
            self?.model.applyBluetoothPointerSpeed(speed)
        }
        bluetoothClient.onPointerSpeedAvailabilityChanged = { [weak self] available in
            self?.model.setPointerSpeedChannelAvailable(available)
        }
        bluetoothClient.onStatusChanged = { [weak self] status, connected in
            self?.model.setBluetoothStatus(status, connected: connected)
        }
        bluetoothClient.start()

        model.onClickThroughChanged = { [weak self] value in
            self?.setClickThrough(value)
        }
        model.onPointerSpeedRequested = { [weak self] speed in
            self?.bluetoothClient.setPointerSpeed(speed)
        }
        setClickThrough(model.clickThrough)
        showOverlay()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func createPanel() {
        let panel = OverlayPanel(
            contentRect: NSRect(x: 0, y: 0, width: 680, height: 330),
            styleMask: [.borderless, .resizable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        panel.title = "KeebWeaver Overlay"
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.minSize = NSSize(width: 620, height: 300)
        panel.setFrameAutosaveName("KeebWeaverOverlayCompact")

        let hostingView = NSHostingView(rootView: OverlayView(model: model))
        hostingView.translatesAutoresizingMaskIntoConstraints = false
        panel.contentView = hostingView
        self.panel = panel

        if !panel.setFrameUsingName("KeebWeaverOverlayCompact") {
            panel.center()
        }
    }

    private func createStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "⌨"
        statusItem.button?.toolTip = "KeebWeaver Overlay"

        let menu = NSMenu()

        let showItem = NSMenuItem(title: "Show Overlay", action: #selector(showOverlay), keyEquivalent: "")
        showItem.target = self
        menu.addItem(showItem)

        let hideItem = NSMenuItem(title: "Hide Overlay", action: #selector(hideOverlay), keyEquivalent: "")
        hideItem.target = self
        menu.addItem(hideItem)

        menu.addItem(.separator())

        clickThroughMenuItem = NSMenuItem(title: "Pass-through", action: #selector(toggleClickThrough), keyEquivalent: "")
        clickThroughMenuItem.target = self
        menu.addItem(clickThroughMenuItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit KeebWeaver Overlay", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    private func setClickThrough(_ value: Bool) {
        panel?.ignoresMouseEvents = value
        clickThroughMenuItem?.state = value ? .on : .off
    }

    @objc private func showOverlay() {
        panel?.orderFrontRegardless()
    }

    @objc private func hideOverlay() {
        panel?.orderOut(nil)
    }

    @objc private func toggleClickThrough() {
        model.clickThrough.toggle()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
