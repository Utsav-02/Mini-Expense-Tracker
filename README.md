<<<<<<< HEAD
# Mini-Expense-Tracker
=======
# 💸 SpendLens — Expense Tracker

A full-stack expense tracker built with React + Node.js + SQLite.

## Quick Start

### 1. Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Build the React app
```bash
cd client && npm run build
```

### 3. Start the server (serves both API + UI)
```bash
cd server && node index.js
```

Open **http://localhost:3001** in your browser.

---

## Development mode (hot reload)

Run both in separate terminals:

```bash
# Terminal 1 — API server
cd server && node index.js

# Terminal 2 — React dev server (http://localhost:3000)
cd client && npm start
```

---

## Features
- ✅ Add / edit / delete expenses (amount, category, date, note)
- ✅ Filter by category and date range (presets + custom)
- ✅ Summary panel: this month total, per-category breakdown, highest expense
- ✅ Pie & bar chart (Recharts)
- ✅ Budget per category with visual progress bar
- ✅ Export filtered expenses as CSV
- ✅ Indian Rupee (₹) formatting
- ✅ Full form validation
- ✅ SQLite persistence via sql.js
- ✅ Toast notifications, animations, dark UI

## Tech Stack
- **Frontend**: React 18, Recharts, CSS custom properties
- **Backend**: Node.js, Express, sql.js (SQLite)
- **Database**: SQLite (persisted to `server/expenses.db`)
>>>>>>> 778eb0b (Fixed sub-repository conflict and initial code)
