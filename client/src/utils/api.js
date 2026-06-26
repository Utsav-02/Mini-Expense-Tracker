const BASE = "http://localhost:3001/api";

export const api = {
  async getExpenses(filters = {}) {
    const p = new URLSearchParams();
    if (filters.category && filters.category !== "All") p.set("category", filters.category);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    const r = await fetch(`${BASE}/expenses?${p}`);
    return r.json();
  },
  async addExpense(data) {
    const r = await fetch(`${BASE}/expenses`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error);
    return json;
  },
  async updateExpense(id, data) {
    const r = await fetch(`${BASE}/expenses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error);
    return json;
  },
  async deleteExpense(id) {
    await fetch(`${BASE}/expenses/${id}`, { method: "DELETE" });
  },
  async getSummary(filters = {}) {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    const r = await fetch(`${BASE}/summary?${p}`);
    return r.json();
  },
  async getBudgets() {
    const r = await fetch(`${BASE}/budgets`);
    return r.json();
  },
  async setBudget(category, amount) {
    const r = await fetch(`${BASE}/budgets/${category}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    return r.json();
  },
  exportUrl(filters = {}) {
    const p = new URLSearchParams();
    if (filters.category && filters.category !== "All") p.set("category", filters.category);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    return `${BASE}/expenses/export?${p}`;
  },
};

export const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Health", "Shopping", "Other"];

export const CATEGORY_COLORS = {
  Food:          "#F59E0B",
  Transport:     "#3B82F6",
  Bills:         "#EF4444",
  Entertainment: "#8B5CF6",
  Health:        "#10B981",
  Shopping:      "#EC4899",
  Other:         "#6B7280",
};

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2,
  }).format(amount);
}

export function today() {
  return new Date().toISOString().split("T")[0];
}

export function monthRange(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear(), m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const to   = new Date(y, m + 1, 0).toISOString().split("T")[0];
  return { from, to };
}
