// swift-tools-version: 6.0
// SPDX-License-Identifier: MIT

import PackageDescription

let package = Package(
    name: "KeebWeaverOverlay",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .executable(
            name: "KeebWeaverOverlay",
            targets: ["KeebWeaverOverlay"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "KeebWeaverOverlay",
            path: "Sources/KeebWeaverOverlay"
        ),
        .testTarget(
            name: "KeebWeaverOverlayTests",
            dependencies: ["KeebWeaverOverlay"],
            path: "Tests/KeebWeaverOverlayTests"
        ),
    ]
)
