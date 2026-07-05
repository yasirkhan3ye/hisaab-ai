
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '../types';
import { fetchExchangeRates } from '../services/geminiService';
import { useTranslation } from '../services/LanguageContext';
import { formatDisplayDate, formatDisplayTime, formatAmount } from '../services/formatters';

interface DashboardProps {
  transactions: Transaction[];
}

// Icon map matching presets from Transactions page
const CATEGORY_ICONS: Record<string, string> = {
  rent: 'home',
  oil: 'local_gas_station',
  phone: 'smartphone',
  car: 'directions_car',
  insurance: 'shield',
  internet: 'wifi',
  groceries: 'shopping_cart',
  transport: 'directions_transit',
  deliveroo: 'delivery_dining',
  glovo: 'moped',
  salary: 'payments',
  freelance: 'laptop',
  bonus: 'stars',
  investment: 'trending_up',
  tips: 'volunteer_activism',
  bills: 'receipt_long',
  gas: 'local_fire_department',
  electricity: 'bolt',
  'water bill': 'water_drop',
  taxes: 'account_balance',
  miscellaneous: 'miscellaneous_services',
  accountant: 'calculate',
  donation: 'favorite',
  'bank repayment': 'credit_score',
  remittances: 'send_money',
};

const getCategoryIcon = (category: string, type: string): string => {
  const icon = CATEGORY_ICONS[category.toLowerCase()];
  if (icon) return icon;
  return type === 'income' ? 'account_balance' : 'shopping_bag';
};

export const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [pkrRate, setPkrRate] = useState<number>(302.45);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const [sortBy, setSortBy] = useState<'date' | 'category'>('date');

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
      if (isNaN(d.getTime())) return false; // Filter out invalid dates
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  // Calculations for current month - Excluding non-income inflows from income totals and excluding Pending
  const monthlyIncome = monthlyTransactions
    .filter(t => t.type === 'income' && t.excludeFromAnalytics !== true && !(t.description || '').includes('[PENDING]'))
    .reduce((acc, curr) => acc + (isNaN(curr.amount) ? 0 : curr.amount), 0);

  const monthlyExpense = monthlyTransactions
    .filter(t => t.type === 'expense' && t.excludeFromAnalytics !== true && t.category.toLowerCase() !== 'lending')
    .reduce((acc, curr) => acc + (isNaN(curr.amount) ? 0 : curr.amount), 0);

  const monthlyBalance = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

  const pendingEarnings = monthlyTransactions
    .filter(t => t.type === 'income' && (t.description || '').includes('[PENDING]'))
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Category Breakdown for the month based on selected viewType
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    monthlyTransactions
      .filter(t => t.type === viewType && t.excludeFromAnalytics !== true && !(t.description || '').includes('[PENDING]') && t.category.toLowerCase() !== 'lending')
      .forEach(t => {
        const normalizedCat = t.category.trim().toLowerCase();
        summary[normalizedCat] = (summary[normalizedCat] || 0) + t.amount;
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

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long' });

  // Historical Monthly Aggregates
  const monthlyHistory = useMemo(() => {
    const historyMap: Record<string, { income: number; expense: number; month: number; year: number }> = {};

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime()) || isNaN(t.amount)) return; // Skip invalid entries

      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!historyMap[key]) {
        historyMap[key] = { income: 0, expense: 0, month: d.getMonth(), year: d.getFullYear() };
      }
      if (t.type === 'income' && t.excludeFromAnalytics !== true && !(t.description || '').includes('[PENDING]')) {
        historyMap[key].income += t.amount;
      } else if (t.type === 'expense' && t.excludeFromAnalytics !== true && t.category.toLowerCase() !== 'lending') {
        historyMap[key].expense += t.amount;
      }
    });

    const sortedAsc = Object.values(historyMap).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    let cumulative = 0;
    const historyWithTotal = sortedAsc.map(item => {
      const net = item.income - item.expense;
      cumulative += net;
      return { ...item, cumulative };
    });

    return historyWithTotal.reverse();
  }, [transactions]);

  return (
    <div className="space-y-7 animate-fadeIn pb-10">
      {/* Monthly Context Selector */}
      <div className="flex items-center justify-between px-2">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="text-center px-2 flex-1 min-w-0">
          <h2 className="text-3xl font-black tracking-tight truncate capitalize">{monthName} {selectedYear}</h2>
          <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] truncate">{t('monthlySummary')}</p>
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={() => navigate('/fiscal')} className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
            <span className="material-symbols-outlined text-[22px] font-black">calculate</span>
          </button>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      {/* 1. Monthly Summary Hero (Net Balance on Top) */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl ai-glow border border-white/5">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6 gap-4">
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary truncate block">{t('netBalance')}</span>
              <h2 className="text-5xl font-black tracking-tighter truncate">
                €{formatAmount(monthlyBalance)}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[11px] font-black uppercase text-slate-400">{t('savingsRate')}</span>
              <p className={`text-xl font-black ${savingsRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {savingsRate.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 group hover:bg-white/10 transition-colors min-w-0 relative overflow-hidden">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest truncate block">{t('totalInflowCleared')}</span>
              <p className="text-2xl font-black text-white truncate">+€{formatAmount(monthlyIncome)}</p>

              {pendingEarnings > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block mb-0.5">{t('pending')}</span>
                  <p className="text-base font-black text-amber-400">€{formatAmount(pendingEarnings)}</p>
                </div>
              )}
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 group hover:bg-white/10 transition-colors min-w-0">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest truncate block">{t('totalOutflow')}</span>
              <p className="text-2xl font-black text-white">-€{formatAmount(monthlyExpense)}</p>
              <p className="text-[10px] text-slate-400 font-black mt-1 uppercase truncate">≈ ₨{formatAmount(monthlyExpense * pkrRate)}</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-5">
          <span className="material-symbols-outlined text-[150px]">analytics</span>
        </div>
      </div>

      {/* Quick Add Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/transactions?type=income')}
          className="flex items-center justify-between p-4 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 active:scale-95 transition-all group min-w-0"
        >
          <div className="flex flex-col items-start min-w-0 flex-1 mr-2">
            <span className="text-[12px] font-black uppercase text-emerald-500 mb-1 truncate w-full">{t('newEntry')}</span>
            <span className="text-base font-black group-hover:text-emerald-500 transition-colors truncate w-full text-left">{t('income')}</span>
          </div>
          <div className="size-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <span className="material-symbols-outlined text-xl font-black">add_circle</span>
          </div>
        </button>
        <button
          onClick={() => navigate('/transactions?type=expense')}
          className="flex items-center justify-between p-4 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all group min-w-0"
        >
          <div className="flex flex-col items-start min-w-0 flex-1 mr-2">
            <span className="text-[12px] font-black uppercase text-rose-500 mb-1 truncate w-full">{t('newEntry')}</span>
            <span className="text-base font-black group-hover:text-rose-500 transition-colors truncate w-full text-left">{t('expense')}</span>
          </div>
          <div className="size-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 flex-shrink-0">
            <span className="material-symbols-outlined text-xl font-black">remove_circle</span>
          </div>
        </button>
      </div>

      {/* 2. Categorical Analysis */}
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-8 gap-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 truncate">{t('categoricalAnalysis')}</h3>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex-shrink-0">
            <button
              onClick={() => setViewType('income')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${viewType === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >{t('inc')}</button>
            <button
              onClick={() => setViewType('expense')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${viewType === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >{t('exp')}</button>
          </div>
        </div>

        <div className="space-y-6">
          {categorySummary.length > 0 ? (
            categorySummary.map(([cat, val]) => {
              const total = viewType === 'income' ? monthlyIncome : monthlyExpense;
              const percentage = (val / (total || 1)) * 100;
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between items-end gap-4">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`size-2 rounded-full flex-shrink-0 ${viewType === 'income' ? 'bg-emerald-500' : 'bg-primary'}`}></div>
                      <span className="text-sm font-black truncate capitalize">{cat}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-black text-slate-900 dark:text-white block">€{formatAmount(val)}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{percentage.toFixed(2)}% of total</span>
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
              No {viewType} records
            </div>
          )}
        </div>
      </section>

      {/* 3. Monthly History */}
      <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl ai-glow border border-white/5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-black tracking-tight">{t('monthlyHistory')}</h3>
              <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">{t('netBalanceOverview')}</p>
            </div>
            <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-2xl text-slate-400">history</span>
            </div>
          </div>

          <div className="space-y-4 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
            {monthlyHistory.map(({ income, expense, month, year, cumulative }) => {
              const net = income - expense;
              const date = new Date(year, month);
              const mName = date.toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'short' });

              return (
                <div key={`${year}-${month}`} className="flex items-center justify-between p-5 bg-white/5 rounded-[1.5rem] border border-white/10 hover:bg-white/10 transition-all group">
                  <div className="flex flex-col min-w-0 flex-1 mr-4">
                    <span className="text-sm font-black uppercase text-slate-400 group-hover:text-primary transition-colors">{mName} {year}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{t('in')} €{formatAmount(income)}</span>
                      <span className="text-[10px] font-bold text-slate-600">•</span>
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{t('out')} €{formatAmount(expense)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-base font-black ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {net >= 0 ? '+' : ''}€{formatAmount(net)}
                    </p>
                    <p className="text-[11px] font-black text-slate-500 uppercase mt-0.5">{t('total')} €{formatAmount(cumulative)}</p>
                  </div>
                </div>
              );
            })}

            {monthlyHistory.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('noRecordsFound')}</p>
              </div>
            )}
          </div>

          {/* Lifetime/Yearly Summary Footer */}
          {monthlyHistory.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-base font-black uppercase tracking-tighter text-slate-400">{selectedYear} {t('hisaabAnalysis')}</h4>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">{t('yearlyAnalytics')}</p>
              </div>
              <div className="text-right">
                {(() => {
                  const yearlyNet = transactions
                    .filter(t => {
                      const d = new Date(t.date);
                      return d.getFullYear() === selectedYear && t.excludeFromAnalytics !== true && t.category.toLowerCase() !== 'lending';
                    })
                    .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

                  return (
                    <>
                      <p className={`text-2xl font-black ${yearlyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        €{formatAmount(yearlyNet)}
                      </p>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('totalForYear')} {selectedYear}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-5">
          <span className="material-symbols-outlined text-[150px]">history_edu</span>
        </div>
      </section>

      {/* Aggregate Stats */}
      <div className="px-5 py-3 bg-slate-900/50 rounded-2xl border border-white/5 flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('lifetimeAggregateBalance')}</span>
        <span className="text-sm font-black text-slate-300">€{formatAmount(monthlyHistory[0]?.cumulative || 0)}</span>
      </div>

      {/* 4. Activity Feed */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1 gap-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 truncate">{t('activity')}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setSortBy('date')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${sortBy === 'date' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
              >
                <span className="material-symbols-outlined text-[15px]">schedule</span>
                {t('date')}
              </button>
              <button
                onClick={() => setSortBy('category')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${sortBy === 'category' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
              >
                <span className="material-symbols-outlined text-[15px]">category</span>
                {t('category')}
              </button>
            </div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{monthlyTransactions.length} {t('logs')}</span>
          </div>
        </div>
        <div className="space-y-3">
          {monthlyTransactions.slice().sort((a, b) => {
            if (sortBy === 'category') {
              const catCompare = a.category.trim().toLowerCase().localeCompare(b.category.trim().toLowerCase());
              if (catCompare !== 0) return catCompare;
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          }).map(t => {
            const isPending = t.type === 'income' && (t.description || '').includes('[PENDING]');
            const cleanDescription = (t.description || '').replace('[PENDING]', '').trim();

            return (
            <div key={t.id} className={`flex items-center justify-between p-5 rounded-[1.5rem] border hover:border-primary/20 transition-all cursor-default group gap-4 ${isPending ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`size-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${isPending ? 'bg-amber-500/10 text-amber-500' : t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <span className="material-symbols-outlined text-xl font-black">
                    {isPending ? 'hourglass_empty' : getCategoryIcon(t.category, t.type)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black text-slate-900 dark:text-white leading-tight truncate capitalize">{t.category}</p>
                    {isPending && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400">Pending</span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 truncate">
                    {cleanDescription || t.category} • {formatDisplayDate(t.date)}
                    {t.timestamp ? ` • ${formatDisplayTime(t.timestamp)}` : ''}
                  </p>
                </div>
              </div>
              <p className={`text-lg font-black flex-shrink-0 ${isPending ? 'text-amber-500' : t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {t.type === 'income' ? '+' : '-'}€{formatAmount(t.amount)}
              </p>
            </div>
          )})}
          {monthlyTransactions.length === 0 && (
            <div className="py-16 text-center space-y-4 bg-slate-50 dark:bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-5xl text-slate-300 block">history_edu</span>
              <div className="px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('noActivity')}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{t('startRecording')}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
