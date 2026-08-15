// SPDX-License-Identifier: MIT

import SwiftUI

struct OverlayView: View {
    @ObservedObject var model: OverlayModel

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            header

            HStack(spacing: 8) {
                Picker("Layer", selection: Binding(
                    get: { model.visibleLayer },
                    set: { model.selectManualLayer($0) }
                )) {
                    ForEach(Layer.allCases) { layer in
                        Text(layer.title).tag(layer)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(maxWidth: 330)

                Text(model.visibleLayer.instruction)
                    .font(.caption)
                    .foregroundStyle(NordPalette.snowStorm0.opacity(0.68))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            pointerSpeedControl

            KeyboardDiagramView(layer: model.visibleLayer)

            Divider()
                .overlay(NordPalette.polarNight3.opacity(0.9))

            HStack(spacing: 8) {
                Text("NUM = numbers  •  SYM = symbols  •  ENTER = nav")
                    .font(.caption2)
                    .foregroundStyle(NordPalette.snowStorm0.opacity(0.68))
                Spacer(minLength: 8)
                if model.clickThrough {
                    Text("Pass-through")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(NordPalette.auroraOrange)
                }
            }
        }
        .padding(12)
        .frame(minWidth: 620, minHeight: 300)
        .background(NordPalette.polarNight0.opacity(0.98), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(NordPalette.polarNight3.opacity(0.9), lineWidth: 1)
        }
        .colorScheme(.dark)
        .tint(NordPalette.frostBlue)
        .opacity(model.opacity)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text("KeebWeaver")
                .font(.headline.weight(.bold))
                .foregroundStyle(NordPalette.snowStorm2)

            Spacer(minLength: 10)

            HStack(spacing: 7) {
                HStack(spacing: 5) {
                    Circle()
                        .fill(model.bluetoothConnected ? NordPalette.auroraGreen : NordPalette.auroraYellow)
                        .frame(width: 6, height: 6)
                    Text(model.bluetoothConnected ? "BLE" : "BLE…")
                        .font(.caption2)
                        .foregroundStyle(NordPalette.snowStorm0.opacity(0.72))
                }
                .help(model.bluetoothStatus)

                Toggle("Pass-through", isOn: $model.clickThrough)
                    .toggleStyle(.checkbox)
                    .labelsHidden()
                    .help("Pass-through overlay clicks")

                HStack(spacing: 5) {
                    Text("Opacity")
                        .font(.caption2)
                        .foregroundStyle(NordPalette.snowStorm0.opacity(0.72))
                    Slider(value: $model.opacity, in: 0.45...1)
                        .frame(width: 65)
                    Text("\(Int(model.opacity * 100))%")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(NordPalette.snowStorm0.opacity(0.72))
                        .frame(width: 28, alignment: .trailing)
                }
            }
        }
    }

    private var pointerSpeedControl: some View {
        HStack(spacing: 8) {
            Text("Speed")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(NordPalette.snowStorm1)

            Button {
                model.adjustPointerSpeed(by: -OverlayModel.pointerSpeedStep)
            } label: {
                Text("−")
                    .frame(width: 14)
            }

            Slider(
                value: Binding(
                    get: { Double(model.pointerSpeed) },
                    set: { model.requestPointerSpeed(Int($0.rounded())) }
                ),
                in: Double(OverlayModel.pointerSpeedMinimum)...Double(OverlayModel.pointerSpeedMaximum),
                step: Double(OverlayModel.pointerSpeedStep)
            )
            .frame(width: 150)

            Button {
                model.adjustPointerSpeed(by: OverlayModel.pointerSpeedStep)
            } label: {
                Text("+")
                    .frame(width: 14)
            }

            Text("\(model.pointerSpeed)")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(NordPalette.snowStorm1)
                .frame(width: 34, alignment: .trailing)

            Button {
                model.resetPointerSpeed()
            } label: {
                Text("↺")
                    .frame(width: 14)
            }
            .help("Reset pointer speed")
            .accessibilityLabel("Reset pointer speed")

            Spacer(minLength: 8)

            Text(model.pointerSpeedAvailable
                ? "SYM ↑↓"
                : "BLE…")
                .font(.caption2)
                .foregroundStyle(NordPalette.snowStorm0.opacity(0.68))
        }
        .controlSize(.small)
        .foregroundStyle(NordPalette.snowStorm1)
        .disabled(!model.bluetoothConnected || !model.pointerSpeedAvailable)
    }
}

private struct KeyboardDiagramView: View {
    let layer: Layer

    private let groupWidth: CGFloat = 245
    private let pointerWidth: CGFloat = 78

    var body: some View {
        VStack(spacing: 4) {
            ForEach(KeyboardLayout.rows) { row in
                HStack(spacing: 8) {
                    KeyGroupView(keys: row.left, layer: layer)
                        .frame(width: groupWidth, alignment: .leading)

                    PointerClusterView(row: row.pointer, layer: layer)
                        .frame(width: pointerWidth, height: 48)

                    KeyGroupView(keys: row.right, layer: layer)
                        .frame(width: groupWidth, alignment: .leading)
                }
            }

            HStack(spacing: 8) {
                KeyGroupView(keys: KeyboardLayout.leftThumbs, layer: layer)
                    .frame(width: groupWidth, alignment: .leading)
                Color.clear.frame(width: pointerWidth, height: 48)
                KeyGroupView(keys: KeyboardLayout.rightThumbs, layer: layer)
                    .frame(width: groupWidth, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct KeyGroupView: View {
    let keys: [KeySpec]
    let layer: Layer

    var body: some View {
        HStack(spacing: 3) {
            ForEach(keys) { key in
                KeyCapView(key: key, layer: layer)
            }
        }
    }
}

private struct KeyCapView: View {
    let key: KeySpec
    let layer: Layer

    private var isActiveOverride: Bool {
        layer != .base && key.isOverride(for: layer)
    }

    private var primaryLabel: String {
        key.label(for: layer)
    }

    var body: some View {
        VStack(spacing: 1) {
            Text(primaryLabel)
                .font(.system(size: primaryLabel.count > 7 ? 8 : 12, weight: .semibold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)

            if layer != .base {
                Text(isActiveOverride ? key.base : "base")
                    .font(.system(size: 7, weight: .medium, design: .rounded))
                    .foregroundStyle(NordPalette.snowStorm0.opacity(0.62))
                    .lineLimit(1)
            }
        }
        .frame(width: CGFloat(key.width) * 34, height: 36)
        .background {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isActiveOverride ? accentColor.opacity(0.34) : NordPalette.polarNight2.opacity(0.82))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(isActiveOverride ? accentColor.opacity(0.95) : NordPalette.polarNight3.opacity(0.78), lineWidth: isActiveOverride ? 1.5 : 1)
        }
        .shadow(color: .black.opacity(0.16), radius: 1, y: 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(primaryLabel), \(layer.title) layer")
        .help("\(primaryLabel) • \(layer.title)")
    }

    private var accentColor: Color {
        switch layer {
        case .base: return NordPalette.polarNight3
        case .navigation: return NordPalette.auroraGreen
        case .numbers: return NordPalette.auroraYellow
        case .symbols: return NordPalette.auroraPurple
        }
    }
}

private struct PointerClusterView: View {
    let row: PointerRow
    let layer: Layer

    var body: some View {
        switch row {
        case .up:
            pointerButton("↑", help: layer == .symbols ? "Increase pointer speed" : "Pointer up")
        case .horizontal:
            HStack(spacing: 4) {
                pointerButton("←", help: "Pointer left")
                pointerButton("●", help: "Pointer click")
                pointerButton("→", help: "Pointer right")
            }
        case .down:
            pointerButton("↓", help: layer == .symbols ? "Decrease pointer speed" : "Pointer down")
        }
    }

    private func pointerButton(_ label: String, help: String) -> some View {
            Text(label)
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .frame(width: 22, height: 22)
            .background(NordPalette.frostDeep.opacity(0.3), in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .strokeBorder(NordPalette.frostBlue.opacity(0.78), lineWidth: 1)
            }
            .foregroundStyle(NordPalette.snowStorm1)
            .help(help)
    }
}
