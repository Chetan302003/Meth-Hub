# Setup & Restore Instructions

This guide explains how to restore, set up, and run the **METH VTC Hub** project after downloading it from GitHub or extracting it from a ZIP archive.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: Download or Clone the Repository](#step-1-download-or-clone-the-repository)
3. [Step 2: Restore Offline Configuration & Key Files](#step-2-restore-offline-configuration--key-files)
4. [Step 3: Install Node.js Dependencies](#step-3-install-nodejs-dependencies)
5. [Step 4: Run the Application](#step-4-run-the-application)
6. [Step 5: Building a Release Package](#step-5-building-a-release-package)

---

## 1. Prerequisites

Because this is a **Tauri v2** application (Vite + React + TypeScript + Rust), you need to have the following toolchains installed on your machine:

1. **Node.js** (v18.0 or newer)
   * Download and install from [nodejs.org](https://nodejs.org/).
2. **Rust Compiler Toolchain** (Required for Tauri desktop backend)
   * Download and install from [rustup.rs](https://rustup.rs/).
3. **C++ Build Tools (Windows only)**
   * Install the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
   * During installation, make sure to select the **Desktop development with C++** workload.

---

## Step 1: Download or Clone the Repository

Choose one of the options below:

### Option A: Clone using Git
Open your terminal and run:
```bash
git clone https://github.com/Chetan302003/Meth-Hub.git
cd Meth-Hub
```

### Option B: Download ZIP
1. Download the ZIP file from GitHub (or extract your backup ZIP file).
2. Extract the contents to your preferred folder.

---

## Step 2: Restore Offline Configuration & Key Files

> [!IMPORTANT]
> The following files are sensitive and git-ignored, meaning they are **not** present in the GitHub repository. You must manually copy your backup versions of these files into the root of the project:

Place these three files directly in the root directory:
* **`.env`** (Contains Supabase secrets, API URLs, and configuration settings)
* **`updater.key`** (Tauri private key used for code-signing auto-updates)
* **`updater.key.pub`** (Tauri public key used for code-signing auto-updates)

---

## Step 3: Install Node.js Dependencies

Open a terminal in the root of the project directory and run:
```bash
npm install
```
This will download and recreate the `node_modules` directory with all frontend packages.

---

## Step 4: Run the Application

You can run the application in two different environments depending on what you are testing:

### Option A: Run in the Browser (Web Mode)
To run the React frontend in your web browser:
```bash
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) to view it.

### Option B: Run as a Native Desktop App (Tauri Development Mode)
To launch the desktop application wrapper (Vite frontend + Rust Tauri core) in interactive debug mode:
```bash
npx tauri dev
```
*Note: The first time you run this command, Rust will compile the dependencies, which may take a few minutes. Subsequent runs will be extremely fast.*

---

## Step 5: Building a Release Package

To compile the final standalone Windows installer (`.exe` executable with auto-updater functionality), run:

```powershell
# Set your Tauri signing key password (default is usually 1234)
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="1234"

# Build the desktop bundle
npx tauri build
```

This will automatically:
1. Compile the production-ready frontend bundle (saving it in `dist/`).
2. Compile the Rust backend in release mode.
3. Package the app into a secure installer located in:
   `src-tauri/target/release/bundle/nsis/`
