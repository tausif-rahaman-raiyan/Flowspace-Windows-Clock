<p align="center">
  <img src="assets/icon.png" alt="Flowspace Logo" width="108" height="108" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
</p>

<h1 align="center">Flowspace</h1>

<p align="center">
  <strong>Offline Windows Focus Dashboard & Study Sanctuary</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-preview">Preview</a> •
  <a href="#-download--installation">Download</a> •
  <a href="#-keyboard-shortcuts">Shortcuts</a> •
  <a href="#-building-via-github-actions">Build Workflow</a> •
  <a href="#-developer">Developer</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=flat-square&logo=windows" alt="Windows">
  <img src="https://img.shields.io/badge/Runtime-Electron-47848F?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Mode-100%25%20Offline-2ea44f?style=flat-square" alt="Offline">
  <img src="https://img.shields.io/badge/Design-Glassmorphism-black?style=flat-square" alt="Glassmorphism">
</p>

---

## 📸 Preview

<p align="center">
  <img src="assets/preview.jpg" alt="Flowspace Focus Dashboard Screenshot" width="100%" style="border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15);">
</p>

---

## ✨ Overview

**Flowspace** is a distraction-free, privacy-first desktop focus dashboard tailored for students, developers, writers, and deep-work professionals. Built with dark-mode glassmorphism and calming natural soundscapes, Flowspace transforms your screen into a tranquil environment where you can enter flow state effortlessly.

---

## 🌟 Key Features

### ⏱ Precision Focus Timers
* **Pomodoro Mode**: 25-minute work intervals paired with customizable short and long recharge breaks.
* **Countdown & Stopwatch**: Flexible timers for open-ended study sprints, exams, or reading sessions.
* **Multiple Display Styles**: Choose between clean Minimalist, Flip Clock, Progress Bar, Circular Gauge, Dot Matrix, or Pie chart.
* **Timer Protection**: Prevents accidental resets and ensures active focus sessions are never lost when switching modes.

### 🗗 Floating Always-on-Top Desktop Overlay
* **Multi-Window Overlay**: Pop out a compact floating timer widget that stays pinned on top of any active window (Microsoft Word, Visual Studio Code, Chrome, PDFs, Discord, or games).
* **Move Anywhere**: Seamlessly drag and place the overlay across any corner of your monitor or multi-display setup.
* **Instant Controls**: Start, pause, or reset your focus session without ever minimizing your current work. One click returns you smoothly to full dashboard view.

### 🔥 Streak, 30-Day Activity & XP System
* **Real-Time Calendar Sync**: Automatically logs focus minutes to local calendar days (`YYYY-MM-DD`) without timezone drift.
* **30-Day Activity Drawer**: Inspect your day-by-day study log with clean, single-scrollbar navigation.
* **Gamified Momentum**: Earn XP badges and build consecutive day study streaks to keep your discipline sharp.

### 🖼 120+ Curated Sceneries & Custom Wallpapers
* **120 Built-in 4K Sceneries**: Serene alpine lakes, misty pine forests, rainy cabins, aurora borealis, and cosmic starfields.
* **Upload Your Own**: Add custom photos and wallpapers with instant preview, local offline caching, and one-click deletion.
* **Custom Scenery Dim & Blur**: Dial in wallpaper dimming (0–75%) and background gaussian blur (0–12px) for comfortable readability during nighttime study.

### ♫ Built-in Ambient Soundscapes
* Pure offline generative soundscapes created via Web Audio API—no external audio streaming or heavy MP3 files required:
  * 🌧 **Rainfall**: Gentle, soothing steady rain shower.
  * ☕ **Brown Noise**: Deep low-frequency acoustic warmth that blocks office and street chatter.
  * 🧠 **432 Hz Focus Tone**: Harmonic sine resonance for cognitive clarity and sustained meditation.

### ❝ Independent Dual Quotes System
* Select between inspiring **English productivity aphorisms** or **peaceful Islamic wisdom verses** (Bengali/Quranic references).
* Independent customization: Display English on your daily dashboard while enjoying Islamic contemplation in immersive fullscreen mode (or vice-versa).
* Dynamic font-size scaling from `12px` to `48px`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Start / Pause active focus timer |
| <kbd>F</kbd> | Toggle Immersive Fullscreen Focus View |
| <kbd>N</kbd> | Shuffle to next natural wallpaper scenery |
| <kbd>Q</kbd> | Generate a fresh quote for active view |
| <kbd>Esc</kbd> | Exit fullscreen or close open drawers |
| <kbd>Double Click</kbd> | Enter / Exit immersive focus mode |

---

## 📦 Download & Installation

### Windows Installer (Recommended)
1. Download the latest `Flowspace Setup 1.0.0.exe` from [Releases](https://github.com/tausif-rahaman-raiyan/Flowspace-Windows/releases) or the GitHub Actions tab.
2. Run the installer:
   * **Choose Custom Location**: Flowspace allows you to choose your desired installation drive and directory (e.g. `C:\`, `D:\Flowspace`).
   * Creates automatic Start Menu and Desktop shortcuts.

### Standalone Portable Version
* Download `Flowspace 1.0.0.exe` for an instant, zero-install portable executable you can run directly from a USB stick or portable drive.

---

## 🚀 Building via GitHub Actions

This repository includes a preconfigured GitHub Actions CI workflow (`.github/workflows/build.yml`) that automatically builds both the Windows installer and standalone executable on Windows runner infrastructure.

### Trigger Build via GitHub CLI:
```bash
# Dispatch build
gh workflow run build.yml

# Watch build progress live
gh run watch

# Download the compiled .exe artifacts
gh run download -n Flowspace-Windows-x64
```

### Trigger Build via GitHub Web:
1. Open the repository on GitHub.
2. Navigate to the **Actions** tab.
3. Select **Build Windows App** on the left.
4. Click **Run workflow** &rarr; select branch `main` &rarr; click **Run workflow**.
5. Once completed, download your Windows executable directly from the **Artifacts** section at the bottom of the run summary.

---

## 🛠 Local Development

```bash
# Clone the repository
git clone https://github.com/tausif-rahaman-raiyan/Flowspace-Windows.git
cd Flowspace-Windows

# Install dependencies
npm install

# Run web development server
npm run dev

# Launch desktop Electron app
npm start

# Build Windows installer locally (on Windows)
npm run dist:win
```

---

## 👨‍💻 Developer & Contact Info

Flowspace was designed and crafted by **Tausif Rahaman Raiyan**.

* 📸 **Instagram**: [@tausifrahamanraiyan](https://www.instagram.com/tausifrahamanraiyan/)
* 🐙 **GitHub**: [@tausif-rahaman-raiyan](https://github.com/tausif-rahaman-raiyan)
* 🌐 **Website**: [tausifrahamanraiyan.blogspot.com](https://tausifrahamanraiyan.blogspot.com/)

---

<p align="center">
  <sub>Made with ❤️ for deep thinkers and focused minds. © 2026 Flowspace.</sub>
</p>
