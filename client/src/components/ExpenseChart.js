import React, { useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { formatCurrency, CATEGORY_COLORS } from "../utils/api";
import "./ExpenseChart.css";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="chart-tip">
      <div className="chart-tip-name">{name}</div>
      <div className="chart-tip-val">{formatCurrency(value)}</div>
    </div>
  );
};

export default function ExpenseChart({ data }) {
  const [mode, setMode] = useState("pie");

  if (!data || data.length === 0) {
    return <div className="ec-empty">No data to display yet.</div>;
  }

  const chartData = data.map(d => ({
    name: d.category,
    value: d.total,
    color: CATEGORY_COLORS[d.category] || "#94a3b8",
  }));

  return (
    <div className="ec">
      <div className="ec-toggle">
        <button className={mode === "pie" ? "active" : ""} onClick={() => setMode("pie")}>Pie</button>
        <button className={mode === "bar" ? "active" : ""} onClick={() => setMode("bar")}>Bar</button>
      </div>

      {mode === "pie" ? (
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie
              data={chartData} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius={50} outerRadius={85}
              paddingAngle={2} strokeWidth={2} stroke="#fff"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F0" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }}
              axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={40} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79,70,229,0.05)", radius: 4 }} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="ec-legend">
        {chartData.map(d => (
          <div key={d.name} className="ec-legend-item">
            <span className="ec-legend-dot" style={{ background: d.color }} />
            <span>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
