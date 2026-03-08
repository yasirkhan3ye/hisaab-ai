
import React, { useState, useEffect, useMemo } from 'react';
import { LendRecord, LendStatus, CurrencyType, Repayment, Transaction } from '../types';
import { fetchExchangeRates } from '../services/geminiService';

interface LendProps {
  lendRecords: LendRecord[];
  onAdd: (record: LendRecord) => void;
  onAddBulk: (records: LendRecord[]) => void;
  onUpdate: (record: LendRecord) => void;
  onDelete: (id: string) => void;
  onAddTransaction: (t: Transaction) => void;
}

export const Lend: React.FC<LendProps> = ({ lendRecords, onAdd, onAddBulk, onUpdate, onDelete, onAddTransaction }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [currentPkrRate, setCurrentPkrRate] = useState<number>(300);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [repaymentModal, setRepaymentModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTemplateHelp, setShowTemplateHelp] = useState(false);

  const [formData, setFormData] = useState({
    personName: '',
    amount: '',
    currency: 'EUR' as CurrencyType,
    dateLent: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: ''
  });

  const [repayData, setRepayData] = useState({
    amount: '',
    currency: 'EUR' as CurrencyType,
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const getRate = async () => {
      setFetchingRate(true);
      try {
        const data = await fetchExchangeRates('EUR', ['PKR']);
        if (data && data.PKR) setCurrentPkrRate(data.PKR);
      } catch (e) {
        console.error("Failed to fetch rate", e);
      } finally {
        setFetchingRate(false);
      }
    };
    getRate();
  }, []);

  const calculateTotalRepaid = (record: LendRecord): number => {
    return record.repayments.reduce((sum, rep) => {
      if (rep.currency === record.currency) {
        return sum + rep.amount;
      } else {
        if (record.currency === 'EUR') {
          return sum + (rep.amount / (rep.exchangeRateAtRepayment || 1));
        } else {
          return sum + (rep.amount * (rep.exchangeRateAtRepayment || 1));
        }
      }
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const record = lendRecords.find(r => r.id === editingId);
      if (record) {
        onUpdate({
          ...record,
          personName: formData.personName,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          dateLent: formData.dateLent,
          dueDate: formData.dueDate,
          description: formData.description
        });
      }
      setEditingId(null);
    } else {
      const amount = parseFloat(formData.amount);
      onAdd({
        id: Math.random().toString(36).substr(2, 9),
        personName: formData.personName,
        amount: amount,
        currency: formData.currency,
        exchangeRateAtLending: currentPkrRate,
        dateLent: formData.dateLent,
        dueDate: formData.dueDate,
        status: 'pending',
        description: formData.description,
        repayments: []
      });

      onAddTransaction({
        id: Math.random().toString(36).substr(2, 9),
        amount: formData.currency === 'EUR' ? amount : amount / (currentPkrRate || 1),
        category: 'Lending',
        date: formData.dateLent,
        type: 'expense',
        description: `Lent to ${formData.personName}`,
        excludeFromAnalytics: true
      });
    }
    setFormData({ personName: '', amount: '', currency: 'EUR', dateLent: new Date().toISOString().split('T')[0], dueDate: '', description: '' });
    setShowAdd(false);
  };

  const handleAddRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    const record = lendRecords.find(r => r.id === repaymentModal);
    if (!record) return;

    const repayAmount = parseFloat(repayData.amount);
    const newRepayment: Repayment = {
      id: Math.random().toString(36).substr(2, 9),
      amount: repayAmount,
      currency: repayData.currency,
      exchangeRateAtRepayment: currentPkrRate,
      date: repayData.date
    };

    const updatedRecord = {
      ...record,
      repayments: [...record.repayments, newRepayment]
    };

    const totalRepaidNormalized = calculateTotalRepaid(updatedRecord);
    if (totalRepaidNormalized >= record.amount) {
      updatedRecord.status = 'returned';
    } else if (totalRepaidNormalized > 0) {
      updatedRecord.status = 'partial';
    }

    onUpdate(updatedRecord);

    onAddTransaction({
      id: Math.random().toString(36).substr(2, 9),
      amount: repayData.currency === 'EUR' ? repayAmount : repayAmount / (currentPkrRate || 1),
      category: 'Loan Repayment',
      date: repayData.date,
      type: 'income',
      description: `Repayment from ${record.personName}`,
      excludeFromAnalytics: true
    });

    setRepaymentModal(null);
    setRepayData({ amount: '', currency: 'EUR', date: new Date().toISOString().split('T')[0] });
  };

  const totalReceivableEUR = useMemo(() => {
    return lendRecords.reduce((acc, record) => {
      const repaid = calculateTotalRepaid(record);
      const remaining = Math.max(0, record.amount - repaid);
      if (record.currency === 'EUR') return acc + remaining;
      return acc + (remaining / (record.exchangeRateAtLending || currentPkrRate || 1));
    }, 0);
  }, [lendRecords, currentPkrRate]);

  const csvTemplateContent = "personName,amount,currency,dateLent,dueDate,description\nChangaiz Mehmood,1849,EUR,2024-03-01,2025-03-28,Business Loan\nAdnan Khan,500,EUR,2024-03-05,2024-12-01,Personal Assistance";

  const downloadTemplate = () => {
    try {
      const blob = new Blob([csvTemplateContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "hisaab_receivables_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Fallback for mobile: explain if it fails
      setTimeout(() => {
        if (!showTemplateHelp) {
          setShowTemplateHelp(true);
        }
      }, 1000);
    } catch (e) {
      console.error("Download failed", e);
      setShowTemplateHelp(true);
    }
  };

  const copyTemplateToClipboard = () => {
    navigator.clipboard.writeText(csvTemplateContent).then(() => {
      alert("Template copied! You can paste it into a file.");
    }).catch(err => {
      alert("Copy failed. Please manually copy the text from the help menu.");
    });
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const newRecords: LendRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 2) continue;

        const [personName, amount, currency, dateLent, dueDate, description] = parts.map(s => s?.trim());

        if (personName && !isNaN(parseFloat(amount))) {
          newRecords.push({
            id: Math.random().toString(36).substr(2, 9),
            personName,
            amount: parseFloat(amount),
            currency: (currency as CurrencyType) || 'EUR',
            exchangeRateAtLending: currentPkrRate,
            dateLent: dateLent || new Date().toISOString().split('T')[0],
            dueDate: dueDate || '',
            status: 'pending',
            description: description || '',
            repayments: []
          });
        }
      }

      if (newRecords.length > 0) {
        onAddBulk(newRecords);
        alert(`Success: Imported ${newRecords.length} records.`);
      } else {
        alert("Error: No valid data found in CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col gap-4">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden ai-glow border border-white/5">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Portfolio Summary</p>
            <div className="mb-6">
              <h2 className="text-4xl font-black tracking-tighter">
                €{totalReceivableEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Receivable Balance</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="flex-1 bg-primary text-white py-4 rounded-2xl font-black hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 uppercase text-[11px] tracking-widest"
              >
                {showAdd ? 'Close Form' : 'Record New Loan'}
              </button>
              <div className="flex bg-white/5 p-1 rounded-2xl">
                <button onClick={downloadTemplate} className="size-11 flex items-center justify-center text-slate-400 hover:text-white" title="Download Template"><span className="material-symbols-outlined text-lg">download</span></button>
                <label className="size-11 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer" title="Import Data">
                  <span className="material-symbols-outlined text-lg">upload_file</span>
                  <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
                </label>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-5">
            <span className="material-symbols-outlined text-[150px]">payments</span>
          </div>
        </div>
      </header>

      {/* Template Help / Copy Menu */}
      {showTemplateHelp && (
        <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary">Template Helper</h4>
            <button onClick={() => setShowTemplateHelp(false)} className="text-slate-400"><span className="material-symbols-outlined text-sm">close</span></button>
          </div>
          <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">If the automatic download didn't start, you can copy the template content below and save it as a <span className="font-bold">.csv</span> file.</p>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl mb-4 overflow-x-auto">
            <pre className="text-[9px] font-mono text-slate-400 whitespace-pre">{csvTemplateContent}</pre>
          </div>
          <button
            onClick={copyTemplateToClipboard}
            className="w-full py-3 bg-white dark:bg-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            Copy Template Text
          </button>
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl animate-fadeIn space-y-6">
          <h4 className="text-xl font-black">New Loan Entry</h4>
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Recipient Name</label>
              <input required type="text" value={formData.personName} onChange={e => setFormData({ ...formData, personName: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-slate-900 dark:text-white font-bold" placeholder="Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Amount</label>
                <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none font-black text-slate-900 dark:text-white" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Currency</label>
                <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value as CurrencyType })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none font-black text-xs text-slate-900 dark:text-white">
                  <option value="EUR">EUR</option>
                  <option value="PKR">PKR</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date Lent</label>
                <input required type="date" value={formData.dateLent} onChange={e => setFormData({ ...formData, dateLent: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-xs text-slate-900 dark:text-white font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Due Date</label>
                <input required type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-xs text-slate-900 dark:text-white font-bold" />
              </div>
            </div>
          </div>
          <button type="submit" className="w-full bg-primary text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 active:scale-95 transition-all uppercase text-[11px] tracking-widest">Confirm Entry</button>
        </form>
      )}

      <div className="space-y-4">
        {lendRecords.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <span className="material-symbols-outlined text-4xl text-slate-300">payments</span>
            <p className="text-[10px] font-black uppercase text-slate-400 mt-2">No Active Records</p>
          </div>
        ) : (
          lendRecords.map(record => {
            const totalRepaid = calculateTotalRepaid(record);
            const remaining = Math.max(0, record.amount - totalRepaid);
            const progress = (totalRepaid / record.amount) * 100;
            const isExpanded = expandedRow === record.id;

            return (
              <div key={record.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden transition-all hover:border-primary/20">
                <div className="p-6 space-y-5">
                  <div
                    onClick={() => setExpandedRow(isExpanded ? null : record.id)}
                    className="flex justify-between items-start cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-2xl">person</span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white leading-tight">{record.personName}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due {record.dueDate}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${record.status === 'returned' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {record.status}
                      </div>
                      <span className={`material-symbols-outlined text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Repayment Progress</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900 dark:text-white">€{remaining.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">left</span>
                      </div>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${remaining > 0 ? 'bg-primary' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-4 space-y-4 animate-fadeIn border-t dark:border-slate-800">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Payment History</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Initial Loan</p>
                            <p className="text-sm font-black">{record.currency === 'EUR' ? '€' : '₨'}{record.amount.toLocaleString()}</p>
                          </div>
                          <p className="text-[8px] font-black text-slate-400 uppercase">{record.dateLent}</p>
                        </div>
                        {record.repayments.map((rep, idx) => (
                          <div key={rep.id} className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                            <div>
                              <p className="text-[10px] font-black uppercase text-emerald-500/60">Entry #{idx + 1}</p>
                              <p className="text-sm font-black">{record.currency === 'EUR' ? '€' : '₨'}{rep.amount.toLocaleString()}</p>
                            </div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">{rep.date}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex items-center justify-between gap-4 border-t border-slate-50 dark:border-slate-800/50">
                    <button onClick={() => onDelete(record.id)} className="size-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-xl">delete</span></button>
                    {record.status !== 'returned' && (
                      <button onClick={() => setRepaymentModal(record.id)} className="flex-1 h-11 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Return Funds</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {repaymentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-fadeIn border border-slate-100 dark:border-slate-800">
            <h4 className="text-xl font-black mb-6">Record Repayment</h4>
            <form onSubmit={handleAddRepayment} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Amount</label>
                  <input required type="number" step="0.01" value={repayData.amount} onChange={e => setRepayData({ ...repayData, amount: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-black outline-none text-slate-900 dark:text-white" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Currency</label>
                  <select value={repayData.currency} onChange={e => setRepayData({ ...repayData, currency: e.target.value as CurrencyType })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-black outline-none text-xs text-slate-900 dark:text-white">
                    <option value="EUR">EUR</option>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
              </div>
              <input required type="date" value={repayData.date} onChange={e => setRepayData({ ...repayData, date: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-xs text-slate-900 dark:text-white" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setRepaymentModal(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
