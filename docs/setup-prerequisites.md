# ScholarOS Local Prerequisites (Linux)

## Required Tools

- Rust toolchain (stable)
- Node.js 20+
- pnpm 10+
- pkg-config
- dbus development headers (needed by Tauri notification stack on Linux)
- WebKitGTK and GTK development headers (typical Tauri Linux requirement)

## Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y pkg-config libdbus-1-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
npm install -g pnpm
```

## Fedora

```bash
sudo dnf install -y pkgconf-pkg-config dbus-devel gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
npm install -g pnpm
```

## Verify

```bash
pnpm -v
cargo --version
pkg-config --modversion dbus-1
```
