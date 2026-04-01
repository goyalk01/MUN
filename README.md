<!-- ================= HEADER ================= -->

<h1 align="center">🚀 MUN Command Center</h1>
<h3 align="center">⚡ Real-Time Chair Dashboard for MUN Committees</h3>

<p align="center">
  <b>Not just a project — a production-grade control system for live sessions</b>
</p>

<p align="center">
  🧠 Built with system-level thinking • ⚡ Optimized for real-time usage • 🎯 Designed for pressure environments
</p>

---

# 🔥 Why this exists

Running a Model United Nations committee is chaotic.

* Keeping track of speakers? 😵
* Managing time under pressure? ⏱️
* Handling yields correctly? 🤯

👉 Most tools = manual / messy / slow

So I built something better:

> 💡 A **real-time command center** for chairpersons.

---

# ⚡ What this does

### 🎤 General Speakers List (GSL)

* Add / remove delegates
* Reorder instantly
* Auto-next speaker logic

### ⏱️ Smart Timer Engine

* 60 / 90 sec presets
* Start / Pause / Reset
* Urgency indicators:

  * 🟦 Normal
  * 🟨 Warning (<20s)
  * 🟥 Critical (<10s)

### 🔁 Yield System (MUN Accurate)

* Yield to Chair → next speaker
* Yield to Delegate → transfer time
* Yield to Questions → Q&A mode

### 🧾 Activity Logs

* Real-time event tracking
* Clean, readable format:

  * 🎤 India started speaking
  * 🔁 Yielded to USA
  * ❓ Entered Q&A mode

---

# 🧠 Built Like a Real Product

This is NOT a basic React app.

### 🧩 Architecture

```
UI (Next.js)
   ↓
Custom Hooks (Logic Layer)
   ↓
API Routes (Backend Abstraction)
   ↓
Future DB Ready
```

### ⚙️ Tech Stack

* ⚛️ Next.js 14 (App Router)
* 🟦 TypeScript
* 🎨 Tailwind CSS
* 🧠 Custom Hooks
* 🌐 API Routes
* 🚀 Vercel Deployment

---

# 🧠 Engineering Highlights

* ⚡ **Deterministic State Management**
* 🔒 **SSR-safe (no hydration errors)**
* 🧠 **Race condition prevention**
* 🔄 **Atomic API updates**
* 🚀 **Stress-tested system**

---

# 🎨 UI/UX — Not Basic.

> Silent luxury UI ✨

* 🌙 Dark mode (primary)
* ☀️ Light mode (premium feel)
* 🧠 Typography-first design
* ⚡ Instant feedback (no lag)
* ❌ No clutter, no confusion

---

# 🧪 Real-Time Reliability

Tested with:

* Rapid queue updates
* Multiple yield actions
* Timer edge cases
* High-speed interactions

👉 Result: **No crashes. No inconsistencies.**

---

# 🧠 Extra Features (Because why not)

* ⌨️ Keyboard shortcuts
* 🔄 Auto-next speaker
* 📊 Session intelligence panel
* 🎯 Delegate dropdown for yield

---

# 🚀 Live Demo

👉 [Open App](#)
*(replace with your Vercel link)*

---

# 🛠️ Run Locally

```bash
git clone https://github.com/goyalk01/mun-command-center
cd mun-command-center
npm install
npm run dev
```

---

# 🧪 Smoke Test (Production Check)

```bash
node scripts/smoke-test.mjs https://your-deployed-url.vercel.app
```

---

# 🧠 What I Learned

* Building UI ≠ building systems
* Real-time apps need deterministic logic
* SSR + dynamic data = tricky (hydration issues 💀)
* Small UX details matter A LOT

---

# 🏆 Final Thought

> This isn’t just a project submission.
> It’s a system built for real-world usage.

---

<p align="center">
  ⭐ If you liked this, drop a star — it means a lot!
</p>
