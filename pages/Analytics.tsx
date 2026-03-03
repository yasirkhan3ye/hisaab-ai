
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

interface AnalyticsProps {
  transactions: Transaction[];
}

const COLORS = ['#137fec', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Analytics: React.FC<AnalyticsProps> = ({ transactions }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' });

  // Temporal Filter
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const totalIncome = filteredData.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredData.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);

  const expenseData = useMemo(() => {
    return filteredData
      .filter(t => t.type === 'expense')
      .reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.name === curr.category);
        if (existing) existing.value += curr.amount;
        else acc.push({ name: curr.category, value: curr.amount });
        return acc;
      }, []);
  }, [filteredData]);

  // Comparative Monthly View (last 4 months)
  const historicalFlow = useMemo(() => {
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleString('default', { month: 'short' });

      const inVal = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && t.type === 'income';
      }).reduce((s, c) => s + c.amount, 0);

      const exVal = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && t.type === 'expense';
      }).reduce((s, c) => s + c.amount, 0);

      months.push({ month: label, income: inVal, expenses: exVal });
    }
    return months;
  }, [transactions, selectedMonth, selectedYear]);

  const changeMonth = (offset: number) => {
    let newMonth = selectedMonth + offset;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  return (
    <div className="space-y-8 pb-20 animate-fadeIn">
      <header className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">Hisaab Analysis</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthName} {selectedYear} Overview</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button onClick={() => changeMonth(-1)} className="p-1.5"><span className="material-symbols-outlined text-sm">navigate_before</span></button>
          <button onClick={() => changeMonth(1)} className="p-1.5"><span className="material-symbols-outlined text-sm">navigate_next</span></button>
        </div>
      </header>

      {/* Monthly Summary Card */}
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden ai-glow">
        <div className="relative z-10 grid grid-cols-2 gap-8">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Monthly Inflow</span>
            <p className="text-2xl font-black">€{totalIncome.toLocaleString()}</p>
            <div className="h-1 w-full bg-emerald-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: '100%' }}></div>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Monthly Outflow</span>
            <p className="text-2xl font-black">€{totalExpense.toLocaleString()}</p>
            <div className="h-1 w-full bg-rose-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500" style={{ width: `${(totalExpense / (totalIncome || 1)) * 100}%` }}></div>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-10">
          <span className="material-symbols-outlined text-[150px]">data_usage</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-slate-900/50 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Expense Breakdown by Category</h4>
          <p className="text-[10px] text-slate-400 mb-4">How your spending is split across categories this month.</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseData} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                  {expenseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {expenseData.map((entry, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{entry.name}</span>
                <span className="text-[10px] font-black text-slate-400">€{entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">4-Month Momentum</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalFlow}>
                <XAxis dataKey="month" hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                <Tooltip contentStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', color: '#64748b', fontSize: '11px', fontWeight: 900 }} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="income" fill="#10b981" radius={[10, 10, 10, 10]} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[10, 10, 10, 10]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="w-full py-5 rounded-[1.5rem] bg-slate-100 dark:bg-slate-800 font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">print</span>
        Export {monthName} {selectedYear} Report
      </button>
    </div>
  );
};
