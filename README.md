# Description

A tool to explore your own downloaded facebook data. Your files never touch the internet and we never have access to them. The tool merely gives you a user friendly way to peruse your downloaded facebook data. This way you don't have to dig through directories of json files to find the meaningful stuff you may want to save even after you delete your account.

## Prerequisites

- **Node.js** v23.11.0 (or later) — [nodejs.org](https://nodejs.org)
- **Rust** (stable toolchain) — install via [rustup.rs](https://rustup.rs)
- **Tauri CLI** — installed automatically via npm devDependencies, or globally with `cargo install tauri-cli`
- **ffmpeg** - `brew install ffmpeg`


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