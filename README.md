# ScholarOS

Local-first desktop dashboard for CS PhD workflows built with Tauri v2, Rust, React, and TypeScript.

---

## 🛠️ Prerequisites

Before running the application, make sure your system has the required development libraries and toolchains installed.

### System Libraries (Linux)
Tauri requires system packages for WebKitGTK, GTK, AppIndicator, and D-Bus. Install them using your package manager:

#### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y pkg-config libdbus-1-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Fedora
```bash
sudo dnf install -y pkgconf-pkg-config dbus-devel gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

For verification commands, refer to the [setup-prerequisites.md](docs/setup-prerequisites.md) document.

### Toolchains
- **Rust**: Stable toolchain (Rust 1.78+)
- **Node.js**: Version 20+
- **pnpm**: Version 10+ (install via `npm install -g pnpm`)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
Clone the repository and install the Node.js packages:
```bash
pnpm install
```

### 2. Run the Application

#### Tauri Desktop Development App
Runs the frontend dev server and builds/launches the Rust-powered desktop app window:
```bash
pnpm tauri:dev
```

#### Frontend Only (Web Dev Server)
Runs only the Vite frontend dev server in the browser:
```bash
pnpm dev
```

#### Storybook UI Sandbox
Runs Storybook in your browser (at `http://localhost:6006`) to view and test isolated UI components:
```bash
pnpm storybook
```

---

## 🏗️ Build & Package

### Production Tauri App
Compile the frontend and build the production-ready Tauri desktop bundle:
```bash
pnpm tauri:build
```

### Frontend Build Only
Build the static frontend assets:
```bash
pnpm build
```

---

## 🧪 Testing & Code Quality

### Running Tests
Execute unit and integration tests using Vitest:
```bash
pnpm test          # Run tests once
pnpm test:watch    # Run tests in watch mode
```

### Type Checking & Linting
Verify TypeScript types and run ESLint checks:
```bash
pnpm typecheck     # Compile TypeScript types
pnpm lint          # Run ESLint check
```

## 📂 Project Structure

ScholarOS consists of a React/TypeScript frontend and a Rust/Tauri backend:

### Frontend ([src/](src))
- [main.tsx](src/main.tsx) - Application entry point.
- [app/](src/app) - App providers (e.g., React Query client).
- [routes/](src/routes) - Application router configuration ([router.tsx](src/routes/router.tsx)).
- [pages/](src/pages) - View pages: Dashboard, Projects, Reports, People, Submissions, Venues, References, and Settings.
- [components/](src/components) - Reusable components, including Radix UI wrappers (`ui/`) and shared helpers (`shared/`).
- [store/](src/store) - Zustand global state stores (preferences, command palette).
- [lib/](src/lib) - Tauri API client, parsing/formatting helpers, and type declarations.
- [styles/](src/styles) - Tailwind and global CSS styles.

### Backend ([src-tauri/](src-tauri))
- [src/main.rs](src-tauri/src/main.rs) & [src/lib.rs](src-tauri/src/lib.rs) - Application entry and Tauri setup.
- [src/db/](src-tauri/src/db) - SQLite initialization, connection pooling, and migrations ([db/mod.rs](src-tauri/src/db/mod.rs) and [db/repositories.rs](src-tauri/src/db/repositories.rs)).
- [src/domain/](src-tauri/src/domain) - Strongly typed Rust domain models.
- [src/commands/](src-tauri/src/commands) - Tauri command handlers (projects, references, submissions, people, venues, files, admin, dashboard).
- [src/services/](src-tauri/src/services) - Background workers and scheduler ([scheduler.rs](src-tauri/src/services/scheduler.rs)).
- [src/state/](src-tauri/src/state) - App state container context.
- [migrations/](src-tauri/migrations) - Database schema migration SQL scripts.

---

## 💾 Database Configuration
The application automatically creates and runs migrations on a local SQLite database named `scholaros.db` within the operating system's standard application data directory. Check [db/mod.rs](src-tauri/src/db/mod.rs) for implementation details.

---

## 📌 Current Status

The application is scaffolded and fully operational with:
- Core SQLite schema, initial migration scripts, and repository layer for CRUD operations.
- Backend Rust code covering domain models, Tauri commands, app state, and background scheduler.
- Frontend React + TS client using Vite, React Router, TanStack Query, Radix UI components, and Zustand stores.
- Development tooling configured for Vitest, ESLint, TypeScript compilation, and Storybook.
