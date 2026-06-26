Here is a professional, updated `README.md` file for your project. You can copy and paste this directly into your GitHub repository.

---

# 💸 SpendLens — Expense Tracker

A full-stack, responsive personal expense tracker designed to help you gain financial clarity through simple visualization and robust tracking.

 🚀 Key Features

**Smart Tracking:** Add, edit, and delete expenses with custom notes, categories, and dates.
 **Data Visualization:** Interactive Pie and Bar charts powered by **Recharts** to see where your money goes.
 **Budgeting:** Set category-specific monthly budgets with real-time visual progress bars.
 **Filtering:** Flexible views for specific categories and date ranges (This Month, Last 3 Months, Custom Range).
 **Data Control:** Export your transaction history to CSV at any time.
 **Local Persistence:** Uses **SQLite** via `sql.js` to ensure your data stays safe and local.
 **Polished UI:** Modern, clean interface with toast notifications and smooth animations.

 🛠️ Tech Stack

* **Frontend:** React 18, Recharts, CSS.
* **Backend:** Node.js, Express.
* **Database:** SQLite (`sql.js`).

 🤖 Built with AI Assistance

This project was developed through an iterative, collaborative process using **Claude** and **Google Gemini**. These AI models were instrumental in:

* **Architecting** the state management and SQLite integration.
* **Debugging** complex React rendering loops and performance issues.
* **Refining** the UI components and ensuring strict defensive coding (null-checking) for a crash-free experience.

 📦 Quick Start

### 1. Installation

Ensure you have [Node.js](https://nodejs.org/) installed, then clone the repository and run:

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

```

### 2. Run in Development Mode

You will need two terminal windows to run the frontend and backend simultaneously:

* **Terminal 1 (Backend):**
```bash
cd server && node index.js

```


* **Terminal 2 (Frontend):**
```bash
cd client && npm start

```



Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in your browser.

## 🏗️ Production Build

To generate the production-ready build:

```bash
cd client && npm run build

```

---

*Built with passion and AI-powered iteration.*
