import { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Health", "Shopping", "Other"];

const CAT_META = {
  Food:          { emoji: "🍜", color: "#F59E0B" },
  Transport:     { emoji: "🚗", color: "#3B82F6" },
  Bills:         { emoji: "📄", color: "#EF4444" },
  Entertainment: { emoji: "🎬", color: "#8B5CF6" },
  Health:        { emoji: "💊", color: "#10B981" },
  Shopping:      { emoji: "🛍️", color: "#EC4899" },
  Other:         { emoji: "📦", color: "#6B7280" },
};

// ─── Storage helpers (in-memory + localStorage) ───────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem("spendlens_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        expenses: (parsed?.expenses || []).filter(Boolean),
        budgets:  parsed?.budgets  || {},
        nextId:   parsed?.nextId   || 1,
      };
    }
  } catch (_) {}
  return { expenses: [], budgets: {}, nextId: 1 };
}

function saveData(state) {
  try {
    localStorage.setItem("spendlens_v2", JSON.stringify(state));
  } catch (_) {}
}

// ─── Utility helpers ──────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthRange(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear(), m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount || 0);
}

function filterExpenses(expenses, { category, from, to }) {
  return (expenses || [])
    .filter(e => {
      if (!e) return false;
      if (category && category !== "All" && e?.category !== category) return false;
      if (from && e?.date < from) return false;
      if (to   && e?.date > to)   return false;
      return true;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      const dateA = a?.date || "";
      const dateB = b?.date || "";
      return dateB.localeCompare(dateA) || (b?.id || 0) - (a?.id || 0);
    });
}

function computeSummary(expenses, budgets, filteredExpenses) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const mFrom = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const mTo   = `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;

  const thisMonthAll = (expenses || []).filter(e => e && e?.date >= mFrom && e?.date <= mTo);
  const thisMonth = thisMonthAll.reduce((s, e) => s + (e?.amount || 0), 0);

  const total = (filteredExpenses || []).reduce((s, e) => s + (e?.amount || 0), 0);

  const byCatMap = {};
  (filteredExpenses || []).forEach(e => {
    if (!e || !e?.category) return;
    byCatMap[e.category] = (byCatMap[e.category] || 0) + (e?.amount || 0);
  });
  
  const byCategory = Object.entries(byCatMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => (b?.total || 0) - (a?.total || 0));

  const highest = (filteredExpenses && filteredExpenses.length > 0)
    ? filteredExpenses.reduce((best, e) => (e && (e?.amount || 0) > (best?.amount || 0)) ? e : best, filteredExpenses[0])
    : null;

  return { thisMonth, total, byCategory, highest, budgets };
}

function exportCSV(expenses) {
  const header = "ID,Amount,Category,Date,Note\n";
  const rows = (expenses || []).filter(Boolean).map(e =>
    `${e?.id || ""},${Number(e?.amount || 0).toFixed(2)},${e?.category || ""},${e?.date || ""},"${(e?.note || "").replace(/"/g, '""')}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "expenses.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── DATE PRESETS ─────────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: "This month",    ...monthRange(0) },
  { label: "Last month",    ...monthRange(-1) },
  { label: "Last 3 months", from: monthRange(-2).from, to: monthRange(0).to },
  { label: "All time",      from: "", to: "" },
];

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────
const Icons = {
  plus:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  budget:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  filter:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  x:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  chart:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  wallet:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 7v11a2 2 0 0 0 2 2h16v-5"/><circle cx="18" cy="15" r="1" fill="currentColor"/></svg>,
  star:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  warning:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
      {(toasts || []).filter(Boolean).map(t => (
        <div key={t?.id || Math.random()} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", borderRadius: 10,
          background: t?.type === "error" ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${t?.type === "error" ? "#FECACA" : "#BBF7D0"}`,
          color: t?.type === "error" ? "#DC2626" : "#16A34A",
          fontSize: 13.5, fontWeight: 500, minWidth: 220,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          animation: "slideIn 0.2s ease",
        }}>
          <span style={{ width: 16, height: 16, flexShrink: 0 }}>
            {t?.type === "error" ? Icons.warning : Icons.check}
          </span>
          {t?.msg || ""}
        </div>
      ))}
    </div>
  );
}

// ─── Expense Form ─────────────────────────────────────────────────────────────
function ExpenseForm({ initial, onSubmit, onCancel, loading }) {
  const emptyForm = { amount: "", category: "", date: todayStr(), note: "" };
  const [form, setForm]     = useState(initial ? { ...initial, amount: String(initial?.amount || "") } : emptyForm);
  const [errors, setErrors] = useState({});
  const amountRef = useRef(null);

  useEffect(() => {
    setForm(initial ? { ...initial, amount: String(initial?.amount || "") } : emptyForm);
    setErrors({});
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [initial]);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  function validate() {
    const e = {};
    const amt = Number(form.amount);
    if (form.amount === "" || isNaN(amt) || amt <= 0)
      e.amount = "Enter a positive amount";
    if (!form.category) e.category = "Select a category";
    if (!form.date) {
      e.date = "Pick a date";
    } else if (form.date > todayStr()) {
      e.date = "Date can't be in the future";
    }
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSubmit({ ...form, amount: Number(Number(form.amount).toFixed(2)) });
  }

  const inputStyle = (err) => ({
    width: "100%", boxSizing: "border-box",
    padding: "9px 12px", borderRadius: 8, fontSize: 14,
    border: `1px solid ${err ? "#EF4444" : "#E2E8F0"}`,
    background: "#FAFBFD", color: "#1E293B", outline: "none",
    transition: "border-color 0.15s",
  });
  const labelStyle = { fontSize: 11.5, fontWeight: 600, color: "#64748B", letterSpacing: "0.02em", display: "block", marginBottom: 5 };
  const errStyle   = { fontSize: 11.5, color: "#EF4444", marginTop: 4 };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>Amount (₹)</label>
          <input ref={amountRef} type="number" min="0.01" step="0.01" placeholder="0.00"
            value={form.amount} onChange={e => set("amount", e.target.value)}
            style={inputStyle(errors.amount)} />
          {errors.amount && <div style={errStyle}>{errors.amount}</div>}
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)}
            style={{ ...inputStyle(errors.category), appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
              paddingRight: 30, cursor: "pointer",
              color: form.category ? (CAT_META[form.category]?.color || "#1E293B") : "#9CA3AF",
              fontWeight: form.category ? 600 : 400,
            }}>
            <option value="">Select category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].emoji} {c}</option>)}
          </select>
          {errors.category && <div style={errStyle}>{errors.category}</div>}
        </div>

        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" max={todayStr()} value={form.date}
            onChange={e => set("date", e.target.value)}
            style={inputStyle(errors.date)} />
          {errors.date && <div style={errStyle}>{errors.date}</div>}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Note <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
          <input type="text" placeholder="What was this for?" maxLength={200}
            value={form.note} onChange={e => set("note", e.target.value)}
            style={inputStyle(false)} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 500,
            border: "1px solid #E2E8F0", background: "transparent", color: "#64748B", cursor: "pointer",
          }}>Cancel</button>
        )}
        <button type="submit" disabled={loading} style={{
          padding: "8px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff",
          border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Saving…" : initial?.id ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ budgets, onSave, onClose }) {
  const [vals, setVals] = useState({ ...budgets });

  useEffect(() => { setVals({ ...budgets }); }, [budgets]);

  function handleSave() {
    const cleaned = {};
    Object.entries(vals).forEach(([k, v]) => {
      const n = Number(v);
      if (v !== "" && !isNaN(n) && n > 0) cleaned[k] = n;
    });
    onSave(cleaned);
  }

  const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const modal   = { background: "#fff", borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1E293B" }}>Monthly budgets</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 16, height: 16 }}>{Icons.x}</span>
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 0, marginBottom: 20 }}>
          Set a monthly cap per category. A progress bar appears when you're close to or over the limit.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CATEGORIES.map(cat => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 13.5, fontWeight: 500, color: "#334155", width: 140, flexShrink: 0 }}>
                {CAT_META[cat].emoji} {cat}
              </label>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13.5 }}>₹</span>
                <input type="number" min="0" step="100" placeholder="No limit"
                  value={vals[cat] || ""}
                  onChange={e => setVals(v => ({ ...v, [cat]: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", paddingLeft: 26, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13.5, background: "#FAFBFD", color: "#1E293B", outline: "none" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13.5, border: "1px solid #E2E8F0", background: "transparent", color: "#64748B", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", border: "none", cursor: "pointer" }}>Save budgets</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteDialog({ expense, onConfirm, onCancel }) {
  if (!expense) return null;
  const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const modal   = { background: "#fff", borderRadius: 16, padding: "28px", width: "100%", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1E293B", marginBottom: 8 }}>Delete this expense?</div>
        <div style={{ fontSize: 14, color: "#64748B", marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: "#1E293B" }}>{formatINR(expense?.amount)}</span>
          {" · "}{expense?.category}{" · "}{expense?.date}
        </div>
        {expense?.note && <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>"{expense?.note}"</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
          <button onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13.5, border: "1px solid #E2E8F0", background: "transparent", color: "#64748B", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, background: "#EF4444", color: "#fff", border: "none", cursor: "pointer" }}>Yes, delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Expense Row (FORTIFIED AGAINST NULLS) ───────────────────────────────────
function ExpenseRow({ expense, onEdit, onDelete, isNew }) {
  if (!expense || !expense?.category) return null;

  const meta = CAT_META[expense?.category] || CAT_META.Other;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 16px", borderRadius: 12,
      background: isNew ? "#F5F3FF" : "#fff",
      border: `1px solid ${isNew ? "#C4B5FD" : "#F1F5F9"}`,
      transition: "all 0.3s ease",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: meta.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>{meta.emoji}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: meta.color }}>{expense?.category}</span>
          {expense?.note && (
            <span style={{ fontSize: 12.5, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {expense?.note}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{expense?.date}</div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14.5, color: "#1E293B", flexShrink: 0 }}>
        {formatINR(expense?.amount)}
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={() => onEdit(expense)} title="Edit" style={{
          width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E8F0",
          background: "transparent", cursor: "pointer", color: "#64748B",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ width: 13, height: 13 }}>{Icons.edit}</span>
        </button>
        <button onClick={() => onDelete(expense)} title="Delete" style={{
          width: 30, height: 30, borderRadius: 8, border: "1px solid #FEE2E2",
          background: "transparent", cursor: "pointer", color: "#EF4444",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ width: 13, height: 13 }}>{Icons.trash}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────
function ExpenseChart({ byCategory }) {
  const [mode, setMode] = useState("pie");

  if (!byCategory || byCategory.length === 0) {
    return <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "24px 0" }}>No data yet.</div>;
  }

  const chartData = byCategory.map(d => ({
    name:  d?.category || "Other",
    value: d?.total || 0,
    color: CAT_META[d?.category]?.color || "#94A3B8",
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ fontWeight: 600, color: "#1E293B" }}>{payload[0]?.name}</div>
        <div style={{ color: "#4F46E5" }}>{formatINR(payload[0]?.value)}</div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {["pie", "bar"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer",
            border: "1px solid #E2E8F0",
            background: mode === m ? "#4F46E5" : "transparent",
            color: mode === m ? "#fff" : "#64748B",
          }}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={190}>
        {mode === "pie" ? (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={46} outerRadius={78} paddingAngle={2} strokeWidth={2} stroke="#fff">
              {chartData.map((e, i) => <Cell key={i} fill={e?.color} />)}
            </Pie>
            <RechartTooltip content={<CustomTooltip />} />
          </PieChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={36} />
            <RechartTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79,70,229,0.05)" }} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {chartData.map((e, i) => <Cell key={i} fill={e?.color} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
        {chartData.map(d => (
          <div key={d?.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748B" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: d?.color, flexShrink: 0 }} />
            {d?.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Summary Sidebar ──────────────────────────────────────────────────────────
function SummaryPanel({ summary, dateLabel }) {
  if (!summary) return null;
  const { thisMonth, total, byCategory, highest, budgets } = summary;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", borderRadius: 12, padding: "14px 16px", color: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12 }}>{Icons.calendar}</span> THIS MONTH
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{formatINR(thisMonth)}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 11, height: 11 }}>{Icons.wallet}</span> {dateLabel?.toUpperCase()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>{formatINR(total)}</div>
          </div>

          {highest && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#D97706", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 11, height: 11 }}>{Icons.star}</span> HIGHEST
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#92400E" }}>{formatINR(highest?.amount)}</div>
              <div style={{ fontSize: 10.5, color: "#B45309", marginTop: 2 }}>{highest?.category}</div>
            </div>
          )}
        </div>
      </div>

      {byCategory.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", marginBottom: 10 }}>BY CATEGORY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byCategory.map(({ category, total: amt }) => {
              const budget = budgets?.[category];
              const pct  = budget ? Math.min((amt / budget) * 100, 100) : null;
              const over = budget && amt > budget;
              const color = CAT_META[category]?.color || "#6B7280";
              return (
                <div key={category}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#334155", flex: 1 }}>
                      {CAT_META[category]?.emoji} {category}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: over ? "#EF4444" : "#1E293B" }}>
                      {formatINR(amt)}
                      {budget && <span style={{ fontWeight: 400, fontSize: 11, color: "#94A3B8" }}> / {formatINR(budget)}</span>}
                    </span>
                    {over && (
                      <span title="Over budget" style={{ width: 14, height: 14, color: "#EF4444", flexShrink: 0 }}>{Icons.warning}</span>
                    )}
                  </div>
                  {budget && (
                    <div style={{ height: 4, background: "#F1F5F9", borderRadius: 4, marginTop: 6, marginLeft: 16 }}>
                      <div style={{
                        height: "100%", borderRadius: 4, width: `${pct}%`,
                        background: over ? "#EF4444" : color,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [store, setStore] = useState(() => loadData());
  const [catFilter,    setCatFilter]    = useState("All");
  const [datePreset,   setDatePreset]   = useState(0);
  const [customFrom,   setCustomFrom]   = useState("");
  const [customTo,     setCustomTo]     = useState("");
  const [isCustom,     setIsCustom]     = useState(false);
  const [editExpense,  setEditExpense]  = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [formLoading,  setFormLoading]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showBudget,   setShowBudget]   = useState(false);
  const [newId,        setNewId]        = useState(null);
  const [toasts,       setToasts]       = useState([]);

  useEffect(() => { saveData(store); }, [store]);

  function addToast(msg, type = "success") {
    const id = Date.now() + Math.random();
    setToasts(prevToasts => {
      const safeToasts = Array.isArray(prevToasts) ? prevToasts.filter(Boolean) : [];
      return [...safeToasts, { id, msg, type }];
    });
    
    setTimeout(() => {
      setToasts(currentToasts => 
        (currentToasts || []).filter(x => x && x?.id !== id)
      );
    }, 3000);
  }

  function getRange() {
    if (isCustom) return { from: customFrom, to: customTo };
    return { from: DATE_PRESETS[datePreset]?.from, to: DATE_PRESETS[datePreset]?.to };
  }

  const range = getRange();
  const filteredExpenses = filterExpenses(store?.expenses, { category: catFilter, ...range });
  const summary = computeSummary(store?.expenses, store?.budgets, filteredExpenses);

  function handleSubmit(data) {
    setFormLoading(true);
    try {
      if (editExpense && editExpense?.id) {
        setStore(s => ({
          ...s,
          expenses: (s?.expenses || []).filter(Boolean).map(e => e?.id === editExpense?.id ? { ...e, ...data } : e),
        }));
        addToast("Expense updated");
      } else {
        const id = store?.nextId || 1;
        setStore(s => ({
          ...s,
          expenses: [{ id, ...data, created_at: new Date().toISOString() }, ...(s?.expenses || []).filter(Boolean)],
          nextId: (s?.nextId || 1) + 1,
        }));
        setNewId(id);
        setTimeout(() => setNewId(null), 1600);
        addToast("Expense added");
      }
      setShowForm(false);
      setEditExpense(null);
    } catch (err) {
      addToast(err?.message || "Something went wrong", "error");
    } finally {
      setFormLoading(false);
    }
  }

  function handleDelete() {
    if (!deleteTarget || !deleteTarget?.id) return;
    setStore(s => ({ ...s, expenses: (s?.expenses || []).filter(e => e && e?.id !== deleteTarget?.id) }));
    setDeleteTarget(null);
    addToast("Expense deleted");
  }

  function handleSaveBudgets(vals) {
    setStore(s => ({ ...s, budgets: vals }));
    setShowBudget(false);
    addToast("Budgets saved");
  }

  const dateLabel = isCustom
    ? (customFrom && customTo ? `${customFrom} → ${customTo}` : "Custom range")
    : DATE_PRESETS[datePreset]?.label || "";

  const card = { background: "#fff", borderRadius: 14, border: "1px solid #F1F5F9", padding: "20px 20px" };
  const cardTitle = { fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 };
  const iconSm = (icon) => <span style={{ width: 14, height: 14, display: "inline-flex" }}>{icon}</span>;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
        * { box-sizing: border-box; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid #4F46E5; outline-offset: 2px; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>

      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 60, background: "#fff",
        borderBottom: "1px solid #F1F5F9", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#fff",
          }}>₹</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.3px" }}>SpendLens</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Personal expense tracker</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Export CSV", icon: Icons.download, onClick: () => exportCSV(filteredExpenses), outline: true },
            { label: "Set budgets", icon: Icons.budget, onClick: () => setShowBudget(true), outline: true },
            { label: "Add expense", icon: Icons.plus, onClick: () => { setEditExpense(null); setShowForm(true); }, outline: false },
          ].map(b => (
            <button key={b.label} onClick={b.onClick} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              cursor: "pointer", border: b.outline ? "1px solid #E2E8F0" : "none",
              background: b.outline ? "transparent" : "linear-gradient(135deg, #4F46E5, #7C3AED)",
              color: b.outline ? "#334155" : "#fff",
            }}>
              <span style={{ width: 13, height: 13 }}>{b.icon}</span> {b.label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, padding: "20px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Sidebar ── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <div style={cardTitle}>{iconSm(Icons.wallet)} Overview</div>
            <SummaryPanel summary={summary} dateLabel={dateLabel} />
          </div>
          <div style={card}>
            <div style={cardTitle}>{iconSm(Icons.chart)} Spending breakdown</div>
            <ExpenseChart byCategory={summary?.byCategory} />
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Add / Edit form */}
          {showForm && (
            <div style={card}>
              <div style={{ ...cardTitle, marginBottom: 18 }}>
                {iconSm(editExpense ? Icons.edit : Icons.plus)}
                {editExpense ? "Edit expense" : "New expense"}
              </div>
              <ExpenseForm
                initial={editExpense}
                onSubmit={handleSubmit}
                onCancel={() => { setShowForm(false); setEditExpense(null); }}
                loading={formLoading}
              />
            </div>
          )}

          {/* Filters */}
          <div style={card}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                {iconSm(Icons.filter)} CATEGORY
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["All", ...CATEGORIES].map(c => {
                  const active = catFilter === c;
                  const color  = c !== "All" ? CAT_META[c]?.color : undefined;
                  return (
                    <button key={c} onClick={() => setCatFilter(c)} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                      border: `1px solid ${active && color ? color + "60" : active ? "#C4B5FD" : "#E2E8F0"}`,
                      background: active && color ? color + "18" : active ? "#EDE9FE" : "transparent",
                      color: active && color ? color : active ? "#6D28D9" : "#64748B",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {c !== "All" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: CAT_META[c]?.color, flexShrink: 0 }} />}
                      {c !== "All" ? `${CAT_META[c].emoji} ` : ""}{c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                {iconSm(Icons.calendar)} PERIOD
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {DATE_PRESETS.map((p, i) => (
                  <button key={p.label} onClick={() => { setDatePreset(i); setIsCustom(false); }} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                    border: "1px solid #E2E8F0",
                    background: !isCustom && datePreset === i ? "#4F46E5" : "transparent",
                    color: !isCustom && datePreset === i ? "#fff" : "#64748B",
                  }}>{p.label}</button>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {["from", "to"].map((k, idx) => (
                    <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {idx === 1 && <span style={{ color: "#CBD5E1", fontSize: 12 }}>→</span>}
                      <input type="date" max={todayStr()}
                        value={k === "from" ? customFrom : customTo}
                        onChange={e => {
                          const v = e.target.value;
                          if (k === "from") setCustomFrom(v); else setCustomTo(v);
                        }}
                        onBlur={() => { if (customFrom || customTo) setIsCustom(true); }}
                        style={{
                          padding: "4px 8px", borderRadius: 8, fontSize: 12,
                          border: `1px solid ${isCustom ? "#4F46E5" : "#E2E8F0"}`,
                          background: isCustom ? "#EDE9FE" : "#FAFBFD", color: "#334155", outline: "none",
                        }} />
                    </span>
                  ))}
                  {isCustom && (
                    <button onClick={() => { setIsCustom(false); setCustomFrom(""); setCustomTo(""); }} style={{
                      width: 22, height: 22, borderRadius: 6, border: "1px solid #E2E8F0",
                      background: "transparent", cursor: "pointer", color: "#94A3B8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ width: 11, height: 11 }}>{Icons.x}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Expense list */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 8 }}>
                Transactions
                <span style={{ background: "#EDE9FE", color: "#6D28D9", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                  {(filteredExpenses || []).length}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{dateLabel}</span>
            </div>

            {(!filteredExpenses || filteredExpenses.length === 0) ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🧾</div>
                <div style={{ fontWeight: 600, color: "#334155", marginBottom: 6 }}>No transactions found</div>
                <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>Adjust your filters or add a new expense.</div>
                <button onClick={() => { setEditExpense(null); setShowForm(true); }} style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", border: "none", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ width: 13, height: 13 }}>{Icons.plus}</span> Add first expense
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredExpenses.map(e => (
                  <ExpenseRow key={e?.id || Math.random()} expense={e}
                    onEdit={exp => { setEditExpense(exp); setShowForm(true); }}
                    onDelete={setDeleteTarget}
                    isNew={e?.id === newId} />
                ))}
              </div>
            )}
          </div>

        </main>
      </div>

      {deleteTarget && <DeleteDialog expense={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
      {showBudget   && <BudgetModal  budgets={store?.budgets} onSave={handleSaveBudgets} onClose={() => setShowBudget(false)} />}
    </div>
  );
}