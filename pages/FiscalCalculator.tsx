
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../services/LanguageContext';
import { formatAmount } from '../services/formatters';

export const FiscalCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [grossRevenue, setGrossRevenue] = useState<string>('');
  const [isFullTimeEmployee, setIsFullTimeEmployee] = useState<boolean>(false);

  const stats = useMemo(() => {
    const revenue = parseFloat(grossRevenue) || 0;

    // Step 1: Initial Taxable Base (67% of Gross)
    const initialTaxableBase = revenue * 0.67;

    // Step 2: INPS Contributions
    // Scenario A (Freelancer only): 26.07%
    // Scenario B (Full-time employee): 24.00%
    const inpsRate = isFullTimeEmployee ? 0.2400 : 0.2607;
    const inpsContributions = initialTaxableBase * inpsRate;

    // Step 3: Final Net Taxable Base (Deduct INPS)
    const netTaxableBase = Math.max(0, initialTaxableBase - inpsContributions);

    // Step 4: Flat Tax (15%)
    const flatTax = netTaxableBase * 0.15;

    // Step 5: Total Paid to State
    const totalPaid = inpsContributions + flatTax;

    // Step 6: Net Cash Remaining
    const netProfit = revenue - totalPaid;

    // Monthly Savings Rule
    const savingsPercent = isFullTimeEmployee ? 17 : 25;
    const monthlySavingsBuffer = (revenue / 12) * (savingsPercent / 100);

    return {
      revenue,
      initialTaxableBase,
      inpsContributions,
      netTaxableBase,
      flatTax,
      totalPaid,
      netProfit,
      savingsPercent,
      monthlySavingsBuffer
    };
  }, [grossRevenue, isFullTimeEmployee]);

  return (
    <div className="space-y-8 pb-10 animate-fadeIn">
      <header className="px-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">Fiscal Calculator</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Regime Forfettario (Ateco 82.99.99)</p>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Annual Gross Revenue (€)</label>
            <input
              type="number"
              value={grossRevenue}
              onChange={(e) => setGrossRevenue(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-8 py-5 text-3xl font-black outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white transition-all"
              placeholder="0.00"
            />
          </div>

          <div
            onClick={() => setIsFullTimeEmployee(!isFullTimeEmployee)}
            className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-primary/20 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className={`size-12 rounded-2xl flex items-center justify-center transition-all ${isFullTimeEmployee ? 'bg-primary text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                <span className="material-icons text-xl">{isFullTimeEmployee ? 'work' : 'person'}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">Full-Time Employee?</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tight">
                  {isFullTimeEmployee ? 'INPS Reduced Rate (24%)' : 'Freelancer Only (26.07%)'}
                </p>
              </div>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-all ${isFullTimeEmployee ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
               <div className={`absolute top-1 size-5 bg-white rounded-full shadow-md transition-all ${isFullTimeEmployee ? 'left-6' : 'left-1'}`} />
            </div>
          </div>
        </div>
      </div>

      {stats.revenue > 0 && (
        <div className="space-y-8 animate-fadeInUp">
          {/* Main Summary Card */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/5 ai-glow">
            <div className="relative z-10 flex justify-between items-start">
               <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Annual Net Profit</span>
                  <h3 className="text-5xl font-black tracking-tighter mt-1">€{formatAmount(stats.netProfit)}</h3>
               </div>
               <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-400">Monthly Avg</span>
                  <p className="text-xl font-black text-emerald-400 mt-1">€{formatAmount(stats.netProfit / 12)}</p>
               </div>
            </div>
            <div className="absolute -bottom-10 -right-10 opacity-5">
              <span className="material-icons text-[150px]">calculate</span>
            </div>
          </div>

          {/* Detailed Math Table */}
          <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
             <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Step-by-Step Fiscal Math</h4>
             <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800/50">
                   <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-900 dark:text-white">Taxable Base (67%)</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Gross × 0.67</p>
                   </div>
                   <p className="font-black text-slate-900 dark:text-white text-sm">€{formatAmount(stats.initialTaxableBase)}</p>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800/50">
                   <div className="space-y-1">
                      <p className="text-[11px] font-black text-rose-500">INPS Gestione Separata</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Taxable × {(stats.isFullTimeEmployee ? 0.24 : 0.2607 * 100).toFixed(2)}%</p>
                   </div>
                   <p className="font-black text-rose-500 text-sm">-€{formatAmount(stats.inpsContributions)}</p>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800/50">
                   <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-900 dark:text-white">Net Taxable Base</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Deductible INPS</p>
                   </div>
                   <p className="font-black text-slate-900 dark:text-white text-sm">€{formatAmount(stats.netTaxableBase)}</p>
                </div>

                <div className="flex justify-between items-center">
                   <div className="space-y-1">
                      <p className="text-[11px] font-black text-rose-500">Imposta Sostitutiva (15%)</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Net Taxable × 0.15</p>
                   </div>
                   <p className="font-black text-rose-500 text-sm">-€{formatAmount(stats.flatTax)}</p>
                </div>
             </div>
          </section>

          {/* Actionable Advice */}
          <section className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-8 space-y-5">
             <div className="flex items-center gap-3">
                <span className="material-icons text-emerald-500">lightbulb</span>
                <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Financial Advice</h4>
             </div>

             <div className="space-y-4">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly Savings Rule</p>
                   <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                     Instantly move <span className="text-emerald-500 font-black">{stats.savingsPercent}%</span> of every Deliveroo payment to a separate bank account.
                   </p>
                </div>

                <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Target Monthly Transfer</p>
                      <p className="text-lg font-black text-emerald-500">€{formatAmount(stats.monthlySavingsBuffer)}</p>
                   </div>
                   <span className="material-icons text-slate-300">account_balance</span>
                </div>

                <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight italic">
                  *This covers your June and November F24 deadlines comfortably.
                </p>
             </div>
          </section>
        </div>
      )}
    </div>
  );
};
