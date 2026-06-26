const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "expenses.db");

app.use(cors());
app.use(express.json());

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      category TEXT PRIMARY KEY,
      amount REAL NOT NULL
    );
  `);
  persist();
}

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Health", "Shopping", "Other"];

// ─── Expenses ────────────────────────────────────────────────────────────────

app.get("/api/expenses", (req, res) => {
  const { category, from, to } = req.query;
  let query = "SELECT * FROM expenses WHERE 1=1";
  const params = [];
  if (category && category !== "All") { query += " AND category = ?"; params.push(category); }
  if (from) { query += " AND date >= ?"; params.push(from); }
  if (to) { query += " AND date <= ?"; params.push(to); }
  query += " ORDER BY date DESC, id DESC";
  res.json(all(query, params));
});

app.get("/api/expenses/export", (req, res) => {
  const { category, from, to } = req.query;
  let query = "SELECT * FROM expenses WHERE 1=1";
  const params = [];
  if (category && category !== "All") { query += " AND category = ?"; params.push(category); }
  if (from) { query += " AND date >= ?"; params.push(from); }
  if (to) { query += " AND date <= ?"; params.push(to); }
  query += " ORDER BY date DESC, id DESC";
  const expenses = all(query, params);
  const header = "ID,Amount,Category,Date,Note\n";
  const rows = expenses.map(e =>
    `${e.id},${e.amount},${e.category},${e.date},"${(e.note || "").replace(/"/g, '""')}"`
  ).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=expenses.csv");
  res.send(header + rows);
});

app.post("/api/expenses", (req, res) => {
  const { amount, category, date, note } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Amount must be a positive number." });
  if (!category) return res.status(400).json({ error: "Category is required." });
  if (!date) return res.status(400).json({ error: "Date is required." });
  const today = new Date().toISOString().split("T")[0];
  if (date > today) return res.status(400).json({ error: "Date cannot be in the future." });
  run("INSERT INTO expenses (amount, category, date, note) VALUES (?, ?, ?, ?)", [Number(amount), category, date, note || ""]);
  const id = get("SELECT last_insert_rowid() as id").id;
  res.status(201).json(get("SELECT * FROM expenses WHERE id = ?", [id]));
});

app.put("/api/expenses/:id", (req, res) => {
  const { id } = req.params;
  const { amount, category, date, note } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Amount must be a positive number." });
  if (!category) return res.status(400).json({ error: "Category is required." });
  if (!date) return res.status(400).json({ error: "Date is required." });
  const today = new Date().toISOString().split("T")[0];
  if (date > today) return res.status(400).json({ error: "Date cannot be in the future." });
  run("UPDATE expenses SET amount=?, category=?, date=?, note=? WHERE id=?", [Number(amount), category, date, note || "", Number(id)]);
  const expense = get("SELECT * FROM expenses WHERE id = ?", [Number(id)]);
  if (!expense) return res.status(404).json({ error: "Expense not found." });
  res.json(expense);
});

app.delete("/api/expenses/:id", (req, res) => {
  run("DELETE FROM expenses WHERE id = ?", [Number(req.params.id)]);
  res.json({ success: true });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

app.get("/api/summary", (req, res) => {
  const { from, to } = req.query;
  let where = "WHERE 1=1";
  const params = [];
  if (from) { where += " AND date >= ?"; params.push(from); }
  if (to) { where += " AND date <= ?"; params.push(to); }

  const totalRow = get(`SELECT COALESCE(SUM(amount),0) as total FROM expenses ${where}`, params);
  const byCategory = all(`SELECT category, COALESCE(SUM(amount),0) as total FROM expenses ${where} GROUP BY category ORDER BY total DESC`, params);
  const highestRow = get(`SELECT * FROM expenses ${where} ORDER BY amount DESC LIMIT 1`, params);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const thisMonthRow = get("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ?", [monthStart, monthEnd]);

  res.json({
    total: totalRow?.total || 0,
    thisMonth: thisMonthRow?.total || 0,
    byCategory,
    highest: highestRow || null,
  });
});

// ─── Budgets ─────────────────────────────────────────────────────────────────

app.get("/api/budgets", (req, res) => {
  res.json(all("SELECT * FROM budgets"));
});

app.put("/api/budgets/:category", (req, res) => {
  const { category } = req.params;
  const { amount } = req.body;
  run("INSERT INTO budgets (category, amount) VALUES (?,?) ON CONFLICT(category) DO UPDATE SET amount=?", [category, Number(amount), Number(amount)]);
  res.json({ category, amount: Number(amount) });
});

app.get("/api/categories", (req, res) => {
  res.json(CATEGORIES);
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
});

// Serve React build
app.use(express.static(path.join(__dirname, "../client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});
