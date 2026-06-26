import React from "react";
import { formatCurrency, CATEGORY_COLORS } from "../utils/api";
import "./SummaryPanel.css";

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`sc ${accent ? "sc--accent" : ""}`}>
      <div className="sc-label">{label}</div>
      <div className="sc-value">{value}</div>
      {sub && <div className="sc-sub">{sub}</div>}
    </div>
  );
}

export default function SummaryPanel({ summary, budgets, dateLabel }) {
  if (!summary) return null;
  const { total, thisMonth, byCategory, highest } = summary;

  const budgetMap = {};
  (budgets || []).forEach(b => { budgetMap[b.category] = b.amount; });

  return (
    <div className="sp">
      <div className="sp-cards">
        <StatCard label="This Month" value={formatCurrency(thisMonth)} accent />
        <StatCard label={dateLabel || "Filtered Total"} value={formatCurrency(total)} />
        {highest && (
          <StatCard
            label="Highest Expense"
            value={formatCurrency(highest.amount)}
            sub={`${highest.category} · ${highest.date}`}
          />
        )}
      </div>

      {byCategory.length > 0 && (
        <div className="sp-cats">
          <div className="sp-cats-title">By Category</div>
          {byCategory.map(({ category, total: amt }) => {
            const budget = budgetMap[category];
            const pct = budget ? Math.min((amt / budget) * 100, 100) : null;
            const over = budget && amt > budget;
            return (
              <div key={category} className="sp-cat">
                <div className="sp-cat-header">
                  <span className="sp-cat-dot" style={{ background: CATEGORY_COLORS[category] || "#64748b" }} />
                  <span className="sp-cat-name">{category}</span>
                  <span className={`sp-cat-amt ${over ? "sp-cat-amt--over" : ""}`}>
                    {formatCurrency(amt)}
                    {budget && <span className="sp-cat-budget"> / {formatCurrency(budget)}</span>}
                  </span>
                </div>
                {budget && (
                  <div className="sp-bar-track">
                    <div
                      className={`sp-bar-fill ${over ? "sp-bar-fill--over" : ""}`}
                      style={{ width: `${pct}%`, background: over ? "var(--red)" : (CATEGORY_COLORS[category] || "var(--accent)") }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
