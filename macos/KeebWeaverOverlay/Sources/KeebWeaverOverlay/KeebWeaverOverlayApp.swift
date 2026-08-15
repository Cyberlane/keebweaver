// SPDX-License-Identifier: MIT

import SwiftUI

@main
struct KeebWeaverOverlayApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}
