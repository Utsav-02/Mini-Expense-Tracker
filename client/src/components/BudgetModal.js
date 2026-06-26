import React, { useState, useEffect } from "react";
import { CATEGORIES } from "../utils/api";
import "./BudgetModal.css";

const EMOJI = { Food:"🍜", Transport:"🚗", Bills:"📄", Entertainment:"🎬", Health:"💊", Shopping:"🛍️", Other:"📦" };

export default function BudgetModal({ budgets, onSave, onClose }) {
  const [vals, setVals] = useState({});

  useEffect(() => {
    const m = {};
    (budgets || []).forEach(b => { m[b.category] = b.amount; });
    setVals(m);
  }, [budgets]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Monthly Budgets</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-desc">
          Set a monthly spending cap per category. A progress bar will appear when you're approaching or over the limit.
        </p>
        <div className="bm-list">
          {CATEGORIES.map(cat => (
            <div key={cat} className="bm-row">
              <label>{EMOJI[cat]} {cat}</label>
              <div className="bm-input-wrap">
                <span className="bm-prefix">₹</span>
                <input
                  type="number" min="0" step="500" placeholder="No limit"
                  value={vals[cat] || ""}
                  onChange={e => setVals(v => ({ ...v, [cat]: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="ef-btn ef-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ef-btn ef-btn--primary" onClick={() => onSave(vals)}>Save budgets</button>
        </div>
      </div>
    </div>
  );
}
