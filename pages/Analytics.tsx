
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTranslation } from '../services/LanguageContext';
import { formatAmount } from '../services/formatters';

import { SmartProjection } from '../components/SmartProjection';
import { FiscalCalculator } from './FiscalCalculator';

interface AnalyticsProps {
  transactions: Transaction[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ transactions }) => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'insights' | 'fiscal'>('insights');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long' });

  // Temporal Filter
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const totalIncome = filteredData
    .filter(t => t.type === 'income' && !t.excludeFromAnalytics)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = filteredData
    .filter(t => t.type === 'expense' && !t.excludeFromAnalytics && t.category.toLowerCase() !== 'lending')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Modern Category List Data
  const expenseData = useMemo(() => {
    const summary = filteredData
      .filter(t => t.type === 'expense' && !t.excludeFromAnalytics && t.category.toLowerCase() !== 'lending')
      .reduce((acc: Record<string, number>, curr) => {
        const cat = curr.category.trim();
        acc[cat] = (acc[cat] || 0) + curr.amount;
        return acc;
      }, {});

    return Object.entries(summary)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Modern Trend Data (Last 6 months)
  const historicalFlow = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'short' });

      const inVal = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && t.type === 'income' && !t.excludeFromAnalytics;
      }).reduce((s, c) => s + c.amount, 0);

      const exVal = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && t.type === 'expense' && !t.excludeFromAnalytics && t.category.toLowerCase() !== 'lending';
      }).reduce((s, c) => s + c.amount, 0);

      months.push({
        month: label,
        Income: Number(inVal.toFixed(0)),
        Spending: Number(exVal.toFixed(0))
      });
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
    <div className="space-y-8 pb-10 animate-fadeIn">
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'insights' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Insights
        </button>
        <button
          onClick={() => setActiveTab('fiscal')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'fiscal' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Fiscal
        </button>
      </div>

      {activeTab === 'fiscal' ? (
        <FiscalCalculator />
      ) : (
        <>
          <header className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">{t('hisaabAnalysis')}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthName} {selectedYear}</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm font-black">chevron_left</span></button>
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm font-black">chevron_right</span></button>
            </div>
          </header>

          {/* Hero Flow Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-6">
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest block mb-1">{t('monthlyInflow')}</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">€{formatAmount(totalIncome)}</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-6">
              <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-widest block mb-1">{t('monthlyOutflow')}</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">€{formatAmount(totalExpense)}</p>
            </div>
          </div>

          {/* Smart Projection Component */}
          <SmartProjection
            transactions={transactions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          {/* Modern Trend Chart */}
          <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="mb-6">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">{t('momentumTrend')}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('momentumTrendDesc')}</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalFlow}>
                  <defs>
                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                    itemStyle={{ padding: '2px 0' }}
                  />
                  <Area type="monotone" dataKey="Income" name={t('income')} stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInc)" />
                  <Area type="monotone" dataKey="Spending" name={t('spending')} stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Modern Category List (Replacing Pie Chart) */}
          <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="mb-8">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">{t('expenseDistribution')}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('expenseDistributionDesc')}</p>
            </div>

            <div className="space-y-6">
              {expenseData.length > 0 ? expenseData.map((item) => {
                const percentage = (item.value / (totalExpense || 1)) * 100;
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 capitalize">{t(item.name.toLowerCase()) || item.name}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">€{formatAmount(item.value)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{percentage.toFixed(1)}% {t('percentOfTotal')}</p>
                  </div>
                );
              }) : (
                <div className="py-10 text-center text-slate-400 italic text-[10px] uppercase font-bold tracking-widest bg-slate-50 dark:bg-slate-800/20 rounded-3xl">
                  {t('noRecordsFound')}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
