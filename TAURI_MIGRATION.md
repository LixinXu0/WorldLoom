# Tauri Migration

## What changed

- Added `@tauri-apps/cli` as a dev dependency.
- Added a minimal `src-tauri/` wrapper around the existing Vite/React frontend.
- Added the `npm run tauri ...` entrypoint while keeping the existing web scripts unchanged.

## How to run web

```bash
npm run dev
```

## How to run desktop

```bash
npm run tauri dev
```

For a production desktop build:

```bash
npm run tauri build
```

## Known issue

- Rust/Cargo must be installed and available on `PATH` before Tauri desktop dev/build commands can run.
