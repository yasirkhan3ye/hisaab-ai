import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip, ReferenceLine, XAxis, YAxis, CartesianGrid } from 'recharts';

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
           !t.excludeFromAnalytics;
  });

  // Get unique days with income
  const uniqueDays = new Set(incomeTransactions.map(t => t.date.split('T')[0]));
  const workingDaysCount = uniqueDays.size;
  
  const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const dailyAverage = workingDaysCount > 0 ? totalIncome / workingDaysCount : 0;
  
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthlyProjection = dailyAverage * daysInMonth;

  // Prepare data for the daily graph
  const dailyData = useMemo(() => {
    const data = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayIncome = incomeTransactions
        .filter(t => t.date.split('T')[0] === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      data.push({
        day,
        amount: dayIncome,
        label: `${day}`
      });
    }
    return data;
  }, [incomeTransactions, selectedMonth, selectedYear, daysInMonth]);

  if (workingDaysCount === 0) return null;

  return (
    <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] p-7 border border-white/10 shadow-2xl relative overflow-hidden group">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        <span className="material-symbols-outlined text-[120px] text-primary">trending_up</span>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm font-black">insights</span>
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Smart Projection</h3>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="size-1.5 bg-primary rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{workingDaysCount} Working Days</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Daily Average Highlights</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">€{dailyAverage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Per Day</span>
              </div>
            </div>

            <div className="h-px w-full bg-white/5"></div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Estimated Monthly Total</p>
                <p className="text-2xl font-black text-emerald-400">€{monthlyProjection.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Month Potential</p>
                <p className="text-xs font-black text-white/40 uppercase leading-none">{daysInMonth} Days Period</p>
              </div>
            </div>
          </div>

          {/* Daily Graph Section */}
          <div className="h-48 relative group/graph bg-white/5 rounded-3xl p-4 border border-white/5">
            <div className="absolute top-3 left-4 z-20">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary"></span>
                Daily Fluctuations
              </p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="day" 
                  hide={true}
                />
                <YAxis hide={true} domain={[0, 'auto']} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Day {payload[0].payload.day}</p>
                          <p className="text-sm font-black text-white">€{payload[0].value?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAmount)" 
                  animationDuration={2000}
                />
                <ReferenceLine 
                  y={dailyAverage} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ 
                    position: 'insideBottomRight', 
                    value: 'AVG', 
                    fill: '#10b981', 
                    fontSize: 8, 
                    fontWeight: 900,
                    offset: 10
                  }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
