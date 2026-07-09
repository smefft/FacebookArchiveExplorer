## Prerequisites

- **Node.js** v23.11.0 (or later) — [nodejs.org](https://nodejs.org)
- **Rust** (stable toolchain) — install via [rustup.rs](https://rustup.rs)
- **Tauri CLI** — installed automatically via npm devDependencies, or globally with `cargo install tauri-cli`


## Setup

1. Clone the repo
2. Install frontend dependencies:
```bash
   npm install
```
3. Run in development mode:
```bash
   npx tauri dev
```
4. Build for production:
```bash
   npx tauri build
```