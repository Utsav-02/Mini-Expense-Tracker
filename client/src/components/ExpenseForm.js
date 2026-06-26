import React, { useState, useEffect } from "react";
import { CATEGORIES, CATEGORY_COLORS, today } from "../utils/api";
import "./ExpenseForm.css";

const CATEGORY_EMOJI = {
  Food: "🍜", Transport: "🚗", Bills: "📄", Entertainment: "🎬",
  Health: "💊", Shopping: "🛍️", Other: "📦",
};

const empty = { amount: "", category: "", date: today(), note: "" };

export default function ExpenseForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm]     = useState(initial || empty);
  const [errors, setErrors] = useState({});

  useEffect(() => { setForm(initial || empty); setErrors({}); }, [initial]);

  function validate() {
    const e = {};
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = "Enter a positive amount";
    if (!form.category) e.category = "Select a category";
    if (!form.date)      e.date     = "Pick a date";
    else if (form.date > today()) e.date = "Date can't be in the future";
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSubmit({ ...form, amount: Number(form.amount) });
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); }

  return (
    <form className="ef" onSubmit={handleSubmit} noValidate>
      <div className="ef-grid">

        <div className={`ef-field${errors.amount ? " ef-field--err" : ""}`}>
          <label>Amount (₹)</label>
          <input type="number" min="0.01" step="0.01" placeholder="0.00"
            value={form.amount} onChange={e => set("amount", e.target.value)} />
          {errors.amount && <span className="ef-error">{errors.amount}</span>}
        </div>

        <div className={`ef-field${errors.category ? " ef-field--err" : ""}`}>
          <label>Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)}
            style={form.category ? { color: CATEGORY_COLORS[form.category] || "inherit", fontWeight: 600 } : {}}>
            <option value="">Select category…</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>
            ))}
          </select>
          {errors.category && <span className="ef-error">{errors.category}</span>}
        </div>

        <div className={`ef-field${errors.date ? " ef-field--err" : ""}`}>
          <label>Date</label>
          <input type="date" max={today()}
            value={form.date} onChange={e => set("date", e.target.value)} />
          {errors.date && <span className="ef-error">{errors.date}</span>}
        </div>

        <div className="ef-field ef-field--full">
          <label>Note <span className="ef-optional">(optional)</span></label>
          <input type="text" placeholder="What was this for?"
            value={form.note} onChange={e => set("note", e.target.value)} maxLength={200} />
        </div>
      </div>

      <div className="ef-actions">
        {onCancel && <button type="button" className="ef-btn ef-btn--ghost" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="ef-btn ef-btn--primary" disabled={loading}>
          {loading ? "Saving…" : initial?.id ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
