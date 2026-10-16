# Focus Guardian 🛡️

> **One task at a time.** A high-performance, distraction-free AI mentor desktop companion built with Electron, React 19, Vite, Zustand, and Groq SDK.

---

## ✨ Features

- **🎯 One Task at a Time:** Minimalist floating pill UI keeping your current core priority front and center.
- **⚡ Groq-Powered AI Mentorship:** Ultra-low latency contextual nudges, task breakdown, and focus coaching.
- **🪟 Liquid Desktop Overlay:** Native macOS floating overlay (`BrowserWindow`) with transparent frames and fluid physics.
- **💾 Local State & Privacy:** Local-first task management and focus timers powered by Zustand.
- **🔔 Smart Micro-Nudges:** Periodic subtle check-ins that evaluate whether you are drifting off task.

---

## 🛠️ Tech Stack

- **Core & Runtime:** [Electron](https://www.electronjs.org/) (macOS focused, universal binary support)
- **Frontend:** React 19, TypeScript, Vite
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **AI Engine:** [Groq SDK](https://console.groq.com/) (Llama 3 / Mixtral ultra-fast inference)
- **Styling:** Custom Vanilla CSS & macOS vibrant material design

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Groq API Key (added in Settings or `.env`)

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/smartjaganrao/focus-guardian.git
cd focus-guardian

# Install dependencies
npm install

# Start Vite dev server + Electron with hot reload
npm run electron-dev
```

### Packaging

```bash
# Build production bundle and macOS DMG
npm run electron-build
```

---

## 🏗️ Architecture

```
focus-guardian/
├── electron/
│   └── ipc/              # Isolated IPC bridge handlers (AI, focus timer, permissions)
├── src/
│   ├── features/
│   │   ├── focus/        # Floating Pill, Focus Panel, and Nudge Overlay
│   │   └── settings/     # API keys & preferences
│   ├── services/ai/      # Groq prompt templates & fast inference client
│   └── store/            # Zustand global stores (focus.store.ts, toasts.store.ts)
├── main.js               # Electron main process (multi-window overlay management)
└── preload.cjs           # Context-isolated secure preload bridge
```

---

## 📄 License

MIT © [Jagan Rao](https://github.com/smartjaganrao)
