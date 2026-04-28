// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "XarjiMenuBar",
    platforms: [
        // Menu-bar styling + modern AppKit APIs we lean on (Task, async URLSession)
        // are comfortable on macOS 13 Ventura. Dropping lower would force a lot of
        // availability checks for not much reach.
        .macOS(.v13),
    ],
    dependencies: [
        // Sparkle 2 — auto-updates. SwiftPM resolves into .build/.../Sparkle.framework
        // which package_app.sh embeds into Xarji.app/Contents/Frameworks/. EdDSA-only
        // (no DSA), no XPC variant (we ship non-sandboxed). See CLAUDE.md §6 for the
        // codesign order, §10 for the JIT entitlement scoping (Sparkle gets none).
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0"),
    ],
    targets: [
        .executableTarget(
            name: "XarjiMenuBar",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/XarjiMenuBar",
            resources: [
                .process("Resources"),
            ]
        ),
    ]
)
