import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip, ReferenceLine, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTranslation } from '../services/LanguageContext';
import { formatAmount } from '../services/formatters';

interface SmartProjectionProps {
  transactions: Transaction[];
  selectedMonth: number;
  selectedYear: number;
}

export const SmartProjection: React.FC<SmartProjectionProps> = ({ transactions, selectedMonth, selectedYear }) => {
  const { t } = useTranslation();
  const incomeTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'income' &&
      d.getMonth() === selectedMonth &&
      d.getFullYear() === selectedYear &&
      !t.excludeFromAnalytics;
  });

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Logic to determine how many days to divide by:
  // If it's the current month, use the current day of the month.
  // If it's a past month, use the total days in that month.
  const now = new Date();
  const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;

  // Optimized Divisor Logic:
  // If it's the current month, we check if the user has actually started working today.
  // We subtract 1 from the day count if it's before 11:00 AM AND no transactions have been logged yet.
  // This keeps the "Daily Average" (Target) stable in the morning.
  const hasIncomeToday = useMemo(() => {
    if (!isCurrentMonth) return false;
    const todayStr = now.toISOString().split('T')[0];
    return incomeTransactions.some(t => t.date.split('T')[0] === todayStr);
  }, [incomeTransactions, isCurrentMonth, now]);

  const daysElapsed = useMemo(() => {
    if (!isCurrentMonth) return daysInMonth;
    const currentDay = now.getDate();
    // If it's early (before 11 AM) and no work is logged, don't count today as 'elapsed' for the average
    if (currentDay > 1 && !hasIncomeToday && now.getHours() < 11) {
      return currentDay - 1;
    }
    return currentDay;
  }, [isCurrentMonth, hasIncomeToday, daysInMonth, now]);

  const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const dailyAverage = daysElapsed > 0 ? totalIncome / daysElapsed : 0;

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

  if (totalIncome === 0) return null;

  return (
    <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] p-4 border border-white/10 shadow-2xl relative overflow-hidden group">
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
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('smartProjection')}</h3>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="size-1.5 bg-primary rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{daysElapsed} {t('daysElapsed')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('dailyAverageHighlights')}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">€{formatAmount(dailyAverage)}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('perDay')}</span>
              </div>
            </div>

            <div className="h-px w-full bg-white/5"></div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('estimatedMonthlyTotal')}</p>
                <p className="text-2xl font-black text-emerald-400">€{formatAmount(monthlyProjection)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('monthPotential')}</p>
                <p className="text-xs font-black text-white/40 uppercase leading-none">{daysInMonth} {t('daysPeriod')}</p>
              </div>
            </div>
          </div>

          {/* Daily Graph Section */}
          <div className="h-64 relative group/graph bg-white/5 rounded-3xl p-3 border border-white/5 select-none" style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none', userSelect: 'none', outline: 'none', touchAction: 'manipulation' }}>
            <div className="absolute top-3 left-4 z-20">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary"></span>
                {t('dailyFluctuations')}
              </p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 20, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" style={{ pointerEvents: 'none' }} />
                <XAxis
                  dataKey="day"
                  hide={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b', pointerEvents: 'none' }}
                  dy={5}
                />
                <YAxis
                  hide={false}
                  domain={[0, 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b', pointerEvents: 'none' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl pointer-events-none select-none">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('dayLabel')} {payload[0].payload.day}</p>
                          <p className="text-sm font-black text-white">€{formatAmount(payload[0].value as number)}</p>
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
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={(props: any) => {
                    const { viewBox } = props;
                    return (
                      <text
                        x={viewBox.width + viewBox.x}
                        y={viewBox.y - 12}
                        fill="#10b981"
                        fontSize={10}
                        fontWeight={900}
                        textAnchor="end"
                        className="font-mono"
                      >
                        {t('avgLabel')}: €{formatAmount(dailyAverage)}
                      </text>
                    );
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
