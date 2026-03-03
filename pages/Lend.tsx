
import React, { useState, useEffect } from 'react';
import { LendRecord, LendStatus, CurrencyType, Repayment } from '../types';
import { fetchExchangeRates } from '../services/geminiService';

interface LendProps {
  lendRecords: LendRecord[];
  onAdd: (record: LendRecord) => void;
  onAddBulk: (records: LendRecord[]) => void;
  onUpdate: (record: LendRecord) => void;
  onDelete: (id: string) => void;
}

export const Lend: React.FC<LendProps> = ({ lendRecords, onAdd, onAddBulk, onUpdate, onDelete }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [currentPkrRate, setCurrentPkrRate] = useState<number>(300);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [repaymentModal, setRepaymentModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
        if (data && data.PKR) {
          setCurrentPkrRate(data.PKR);
        }
      } catch (e) {
        console.error("Failed to fetch rate", e);
      } finally {
        setFetchingRate(false);
      }
    };

    getRate();
    const interval = setInterval(getRate, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []); // Only run once on mount for the interval

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
      onAdd({
        id: Math.random().toString(36).substr(2, 9),
        personName: formData.personName,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        exchangeRateAtLending: currentPkrRate,
        dateLent: formData.dateLent,
        dueDate: formData.dueDate,
        status: 'pending',
        description: formData.description,
        repayments: []
      });
    }
    setFormData({ personName: '', amount: '', currency: 'EUR', dateLent: new Date().toISOString().split('T')[0], dueDate: '', description: '' });
    setShowAdd(false);
  };

  const handleEdit = (record: LendRecord) => {
    setFormData({
      personName: record.personName,
      amount: record.amount.toString(),
      currency: record.currency,
      dateLent: record.dateLent,
      dueDate: record.dueDate,
      description: record.description || ''
    });
    setEditingId(record.id);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    const record = lendRecords.find(r => r.id === repaymentModal);
    if (!record) return;

    const newRepayment: Repayment = {
      id: Math.random().toString(36).substr(2, 9),
      amount: parseFloat(repayData.amount),
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
    setRepaymentModal(null);
    setRepayData({ amount: '', currency: 'EUR', date: new Date().toISOString().split('T')[0] });
  };

  const calculateTotalRepaid = (record: LendRecord): number => {
    return record.repayments.reduce((sum, rep) => {
      if (rep.currency === record.currency) {
        return sum + rep.amount;
      } else {
        if (record.currency === 'EUR') {
          return sum + (rep.amount / rep.exchangeRateAtRepayment);
        } else {
          return sum + (rep.amount * rep.exchangeRateAtRepayment);
        }
      }
    }, 0);
  };

  const isOverdue = (date: string) => new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();

  const downloadTemplate = () => {
    const headers = "personName,amount,currency,dateLent,dueDate,description\n";
    const sample = "John Doe,150.50,EUR,2024-03-01,2024-04-01,Rent assistance\nJane Smith,5000,PKR,2024-03-05,2024-06-01,Business loan";
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hisaab_receivables_template.csv';
    a.click();
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newRecords: LendRecord[] = [];

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [personName, amount, currency, dateLent, dueDate, description] = line.split(',').map(s => s.trim());

        newRecords.push({
          id: Math.random().toString(36).substr(2, 9),
          personName,
          amount: parseFloat(amount) || 0,
          currency: (currency as CurrencyType) || 'EUR',
          exchangeRateAtLending: currentPkrRate,
          dateLent: dateLent || new Date().toISOString().split('T')[0],
          dueDate: dueDate || '',
          status: 'pending',
          description: description || '',
          repayments: []
        });
      }

      if (newRecords.length > 0) {
        onAddBulk(newRecords);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for next use
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Receivables</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <label
              className="size-11 flex items-center justify-center text-slate-400 hover:text-primary transition-all cursor-pointer rounded-xl hover:bg-white dark:hover:bg-slate-700"
              title="Import CSV"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
            </label>
            <button
              onClick={downloadTemplate}
              className="size-11 flex items-center justify-center text-slate-400 hover:text-primary transition-all rounded-xl hover:bg-white dark:hover:bg-slate-700"
              title="Download Template"
            >
              <span className="material-symbols-outlined text-lg">download</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (showAdd) {
                setEditingId(null);
                setFormData({ personName: '', amount: '', currency: 'EUR', dateLent: new Date().toISOString().split('T')[0], dueDate: '', description: '' });
              }
              setShowAdd(!showAdd);
            }}
            className="bg-primary text-white h-13 px-8 rounded-2xl font-black hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
          >
            {showAdd ? 'Close' : 'Record Entry'}
          </button>
        </div>
      </header>

      {showAdd && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl animate-fadeIn space-y-6">
          <div className="flex justify-between items-center border-b dark:border-slate-800 pb-4">
            <h4 className="text-xl font-black">{editingId ? 'Edit Entry' : 'New Loan Entry'}</h4>
            {!editingId && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                <span className="size-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                  Live Rate: 1€ = {currentPkrRate.toFixed(2)} ₨
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Recipient Name</label>
              <input required type="text" value={formData.personName} onChange={e => setFormData({ ...formData, personName: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white" placeholder="Name" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Loan Value</label>
              <div className="flex gap-2">
                <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/20 font-black text-slate-900 dark:text-white" placeholder="0.00" />
                <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value as CurrencyType })} className="bg-primary text-white rounded-2xl px-3 font-black text-xs w-24 appearance-none text-center">
                  <option value="EUR">EUR</option>
                  <option value="PKR">PKR</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date Lent</label>
              <input required type="date" value={formData.dateLent} onChange={e => setFormData({ ...formData, dateLent: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-slate-900 dark:text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Return Date</label>
              <input required type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-slate-900 dark:text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Notes</label>
            <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-slate-900 dark:text-white" placeholder="Purpose of loan" />
          </div>
          <button type="submit" disabled={fetchingRate} className="w-full bg-primary text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all">
            {editingId ? 'Save Changes' : 'Confirm Entry'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {lendRecords.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
            <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">No Active Records</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-10">Start Tracking Your Receivables Portfolio</p>

            <div className="mt-8 flex items-center justify-center gap-2">
              <span className="size-2 bg-primary rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Use the tools above to start your entries</p>
            </div>
          </div>
        ) : (
          lendRecords.map(record => {
            const totalRepaid = calculateTotalRepaid(record);
            const remaining = Math.max(0, record.amount - totalRepaid);
            const progress = (totalRepaid / record.amount) * 100;
            const overdue = record.status !== 'returned' && isOverdue(record.dueDate);

            return (
              <div key={record.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden transition-all hover:border-primary/20 animate-fadeIn">
                <div className="p-6 space-y-5">
                  {/* Header: Name & Status */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-2xl">person</span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white leading-tight">{record.personName}</h4>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>
                          {overdue ? '⚠️ Overdue' : `Due ${record.dueDate}`}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${record.status === 'returned' ? 'bg-emerald-500 text-white' :
                      record.status === 'partial' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                      {record.status}
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Repayment Progress</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1">
                          {record.currency === 'EUR' ? '€' : '₨'}{remaining.toLocaleString()} <span className="text-xs text-slate-400">Left</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900 dark:text-white">{progress.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${remaining > 0 ? 'bg-primary shadow-[0_0_10px_rgba(19,127,236,0.3)]' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      <span>Paid: {record.currency === 'EUR' ? '€' : '₨'}{totalRepaid.toLocaleString()}</span>
                      <span>Total: {record.currency === 'EUR' ? '€' : '₨'}{record.amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Footer: Smart Wrap Notes & Actions */}
                  <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-50 dark:border-slate-800/50">
                    {/* Note Section (Flexible Wrap) */}
                    <div className="flex items-center gap-2 text-slate-400 min-w-[200px] flex-1">
                      <span className="material-symbols-outlined text-sm">notes</span>
                      <p className="text-[10px] font-bold uppercase italic leading-tight truncate sm:whitespace-normal">
                        {record.description || 'No notes added'}
                      </p>
                    </div>

                    {/* Actions Section (Pushed to wrap if space is low) */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                      <button
                        onClick={() => handleEdit(record)}
                        className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                        title="Edit record"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                      <button
                        onClick={() => onDelete(record.id)}
                        className="size-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                        title="Delete record"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                      <button
                        onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                        className={`size-11 rounded-xl flex items-center justify-center transition-all shadow-sm ${expandedRow === record.id ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary'}`}
                        title="View history"
                      >
                        <span className="material-symbols-outlined text-xl">history</span>
                      </button>

                      {record.status !== 'returned' && (
                        <button
                          onClick={() => setRepaymentModal(record.id)}
                          className="px-6 h-11 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all whitespace-nowrap"
                        >
                          Return Funds
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Timeline */}
                  {expandedRow === record.id && (
                    <div className="pt-4 space-y-3 animate-fadeIn border-t border-slate-50 dark:border-slate-800/50">
                      <h5 className="text-[10px] font-black text-primary uppercase tracking-widest">Payment History</h5>
                      {record.repayments.length === 0 ? (
                        <p className="text-[9px] text-slate-400 font-bold italic">No repayments recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {record.repayments.map(rep => (
                            <div key={rep.id} className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700/50">
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                  <span className="material-symbols-outlined text-sm">payments</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black">{rep.currency === 'EUR' ? '€' : '₨'}{rep.amount.toLocaleString()}</span>
                                  <span className="text-[8px] font-black text-slate-400 uppercase">{rep.date}</span>
                                </div>
                              </div>
                              {rep.currency !== record.currency && (
                                <div className="text-right">
                                  <span className="text-[8px] font-black text-slate-400 uppercase">Rate: {rep.exchangeRateAtRepayment}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {repaymentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-fadeIn border border-slate-100 dark:border-slate-800">
            <h4 className="text-xl font-black mb-1">Add Repayment</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 tracking-widest">Update Loan Portfolio</p>
            <form onSubmit={handleAddRepayment} className="space-y-5">
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  step="0.01"
                  value={repayData.amount}
                  onChange={e => setRepayData({ ...repayData, amount: e.target.value })}
                  className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500/20 font-black text-slate-900 dark:text-white"
                  placeholder="0.00"
                />
                <select value={repayData.currency} onChange={e => setRepayData({ ...repayData, currency: e.target.value as CurrencyType })} className="bg-emerald-500 text-white rounded-2xl px-3 font-black text-xs w-24 appearance-none text-center">
                  <option value="EUR">EUR</option>
                  <option value="PKR">PKR</option>
                </select>
              </div>
              <input required type="date" value={repayData.date} onChange={e => setRepayData({ ...repayData, date: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 outline-none text-slate-900 dark:text-white" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRepaymentModal(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-400 font-black py-4 rounded-2xl active:scale-95 transition-all text-[10px] uppercase">Cancel</button>
                <button type="submit" disabled={fetchingRate} className="flex-1 bg-emerald-500 text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-[10px] uppercase shadow-lg shadow-emerald-500/20">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
