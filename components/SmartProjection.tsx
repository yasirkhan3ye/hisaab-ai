import React from 'react';
import { Transaction } from '../types';

interface SmartProjectionProps {
  transactions: Transaction[];
  selectedMonth: number;
  selectedYear: number;
}

export const SmartProjection: React.FC<SmartProjectionProps> = ({ transactions, selectedMonth, selectedYear }) => {
  const incomeTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'income' &&
           d.getMonth() === selectedMonth &&
           d.getFullYear() === selectedYear &&
           !t.excludeFromAnalytics; // Exclude non-income inflows like loan repayments
  });

  // Get unique days with income
  const uniqueDays = new Set(incomeTransactions.map(t => t.date.split('T')[0]));
  const workingDaysCount = uniqueDays.size;
  
  const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const dailyAverage = workingDaysCount > 0 ? totalIncome / workingDaysCount : 0;
  
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthlyProjection = dailyAverage * daysInMonth;

  if (workingDaysCount === 0) return null;

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-7 border border-primary/20 shadow-2xl relative overflow-hidden group">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
        <span className="material-symbols-outlined text-6xl text-primary">trending_up</span>
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-sm font-black">insights</span>
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Smart Projection</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Daily Average (Highlighted)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary">€{dailyAverage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">/ day</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 mt-2">
              <span className="size-1 bg-primary rounded-full animate-pulse"></span>
              <span className="text-[8px] font-black text-primary uppercase tracking-tighter">Based on {workingDaysCount} working days</span>
            </div>
          </div>

          <div className="h-px w-full bg-white/5"></div>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Estimated Monthly Total</p>
              <p className="text-2xl font-black text-white">€{monthlyProjection.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Month Potential</p>
              <p className="text-xs font-black text-slate-400 uppercase">{daysInMonth} Days Total</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
