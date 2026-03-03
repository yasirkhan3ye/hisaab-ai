
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '../types';
import { fetchExchangeRates } from '../services/geminiService';

interface DashboardProps {
  transactions: Transaction[];
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  const navigate = useNavigate();
  const [pkrRate, setPkrRate] = useState<number>(302.45);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

  // Monthly Filter State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => {
    const updateRate = async () => {
      setIsSyncing(true);
      try {
        const data = await fetchExchangeRates('EUR', ['PKR']);
        if (data && data.PKR) setPkrRate(data.PKR);
      } catch (e) {
        console.error("Rate sync failed", e);
      } finally {
        setIsSyncing(false);
      }
    };
    updateRate();
  }, []);

  // Filter transactions for the selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  // Calculations for current month
  const monthlyIncome = monthlyTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const monthlyExpense = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const monthlyBalance = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

  // Category Breakdown for the month based on selected viewType
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    monthlyTransactions
      .filter(t => t.type === viewType)
      .forEach(t => {
        summary[t.category] = (summary[t.category] || 0) + t.amount;
      });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [monthlyTransactions, viewType]);

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

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-7 animate-fadeIn pb-10">
      {/* Monthly Context Selector */}
      <div className="flex items-center justify-between px-2">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black tracking-tight">{monthName} {selectedYear}</h2>
          <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Financial Summary</p>
        </div>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Monthly Summary Hero */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl ai-glow border border-white/5">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Monthly Net Balance</span>
              <h2 className="text-4xl font-black tracking-tighter">
                €{monthlyBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-400">Savings Rate</span>
              <p className={`text-lg font-black ${savingsRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {savingsRate.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 group hover:bg-white/10 transition-colors">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Total Inflow</span>
              <p className="text-lg font-black text-white">+€{monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-[8px] text-slate-400 font-black mt-1 uppercase">≈ ₨{(monthlyIncome * pkrRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 group hover:bg-white/10 transition-colors">
              <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Total Outflow</span>
              <p className="text-lg font-black text-white">-€{monthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-[8px] text-slate-400 font-black mt-1 uppercase">≈ ₨{(monthlyExpense * pkrRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-5">
          <span className="material-symbols-outlined text-[150px]">analytics</span>
        </div>
      </div>

      {/* Category Intelligence Toggle */}
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Categorical Analysis</h3>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
            <button
              onClick={() => setViewType('income')}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >Income</button>
            <button
              onClick={() => setViewType('expense')}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >Expense</button>
          </div>
        </div>

        <div className="space-y-6">
          {categorySummary.length > 0 ? (
            categorySummary.map(([cat, val]) => {
              const total = viewType === 'income' ? monthlyIncome : monthlyExpense;
              const percentage = (val / (total || 1)) * 100;
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${viewType === 'income' ? 'bg-emerald-500' : 'bg-primary'}`}></div>
                      <span className="text-xs font-black">{cat}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 dark:text-white block">€{val.toLocaleString()}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{percentage.toFixed(1)}% of total</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${viewType === 'income' ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 italic text-[10px] uppercase font-bold tracking-widest bg-slate-50 dark:bg-slate-800/20 rounded-2xl">
              No {viewType} records for {monthName}
            </div>
          )}
        </div>
      </section>

      {/* Monthly Quick Add */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/transactions?type=income')}
          className="flex items-center justify-between p-5 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 active:scale-95 transition-all group"
        >
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-black uppercase text-emerald-500 mb-1">New Entry</span>
            <span className="text-sm font-black group-hover:text-emerald-500 transition-colors">Income</span>
          </div>
          <div className="size-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-xl font-black">add_circle</span>
          </div>
        </button>
        <button
          onClick={() => navigate('/transactions?type=expense')}
          className="flex items-center justify-between p-5 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all group"
        >
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-black uppercase text-rose-500 mb-1">New Entry</span>
            <span className="text-sm font-black group-hover:text-rose-500 transition-colors">Expense</span>
          </div>
          <div className="size-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
            <span className="material-symbols-outlined text-xl font-black">remove_circle</span>
          </div>
        </button>
      </div>

      {/* Activity Feed with Split View */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{monthName} Activity</h3>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{monthlyTransactions.length} Total Logs</span>
        </div>
        <div className="space-y-3">
          {monthlyTransactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
            <div key={t.id} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all cursor-default group">
              <div className="flex items-center gap-4">
                <div className={`size-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <span className="material-symbols-outlined text-xl font-black">
                    {t.type === 'income' ? 'account_balance' : 'shopping_bag'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{t.category}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t.description || 'General Log'} • {t.date}</p>
                </div>
              </div>
              <p className={`text-base font-black ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {t.type === 'income' ? '+' : '-'}€{t.amount.toLocaleString()}
              </p>
            </div>
          ))}
          {monthlyTransactions.length === 0 && (
            <div className="py-16 text-center space-y-4 bg-slate-50 dark:bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-5xl text-slate-300 block">history_edu</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No activity detected</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Start recording your {monthName} finances</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
