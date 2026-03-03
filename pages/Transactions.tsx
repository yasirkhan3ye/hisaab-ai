
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Transaction, TransactionType } from '../types';
import { extractTransactionsFromText, analyzeReceipt } from '../services/geminiService';

interface TransactionsProps {
  transactions: Transaction[];
  onAdd: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ transactions, onAdd, onDelete }) => {
  const [searchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    type: (searchParams.get('type') as TransactionType) || 'expense',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl) {
      setFormData(prev => ({ ...prev, type: typeFromUrl as TransactionType }));
      setShowAdd(true);
    }
  }, [searchParams]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.amount || !formData.category) return;

    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      amount: parseFloat(formData.amount),
      category: formData.category,
      type: formData.type,
      description: formData.description,
      date: formData.date
    });
    setFormData({ amount: '', category: '', type: 'expense', description: '', date: new Date().toISOString().split('T')[0] });
    setShowAdd(false);
  };

  // Normalizes MM/DD/YYYY or MM-DD-YYYY to YYYY-MM-DD
  const normalizeDate = (raw: string): string => {
    const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const [, m, d, y] = slashMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return raw; // Already YYYY-MM-DD or unknown, return as-is
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be uploaded again after changes
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;

      if (file.name.toLowerCase().endsWith('.csv')) {
        try {
          const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length > 1) {
            // Auto-detect separator: tab or comma
            const firstLine = lines[0];
            const separator = firstLine.includes('\t') ? '\t' : ',';

            const headers = firstLine.toLowerCase().split(separator).map(h => h.trim());
            if (headers.includes('date') && headers.includes('amount') && headers.includes('category')) {
              const dateIdx = headers.indexOf('date');
              const amountIdx = headers.indexOf('amount');
              const categoryIdx = headers.indexOf('category');
              const typeIdx = headers.indexOf('type');
              const descIdx = headers.indexOf('description');

              let addedCount = 0;
              for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, '').trim());
                if (values.length > Math.max(dateIdx, amountIdx, categoryIdx)) {
                  const amount = parseFloat(values[amountIdx]);
                  if (!isNaN(amount)) {
                    onAdd({
                      id: Math.random().toString(36).substr(2, 9),
                      date: normalizeDate(values[dateIdx] || new Date().toISOString().split('T')[0]),
                      amount: amount,
                      category: values[categoryIdx],
                      type: (() => {
                        if (typeIdx === -1 || !values[typeIdx]) return 'expense';
                        const t = values[typeIdx].toLowerCase().replace(/[^a-z]/g, '');
                        return t === 'income' ? 'income' : 'expense';
                      })() as TransactionType,
                      description: (descIdx !== -1 && values[descIdx]) ? values[descIdx] : 'CSV Upload'
                    });
                    addedCount++;
                  }
                }
              }
              if (addedCount > 0) {
                setIsUploading(false);
                return;
              }
            }
          }
        } catch (err) {
          console.error("Local CSV parsing error:", err);
        }
      }

      // Fallback: Use Gemini for text files
      try {
        const extracted = await extractTransactionsFromText(content);
        if (extracted && extracted.length > 0) {
          extracted.forEach((item: any) => {
            onAdd({ id: Math.random().toString(36).substr(2, 9), ...item });
          });
        } else {
          throw new Error("Empty extractions");
        }
      } catch (err) {
        console.error("Gemini Parsing Error", err);
        alert("Could not parse file. Please use the CSV template.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvContent = ["date,amount,category,type,description", "2023-10-25,150.00,Groceries,expense,Weekly supermarket trip", "2023-10-26,2000.00,Salary,income,October Salary"].join("\n") + "\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "hisaab_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PRESETS = [
    { label: 'Rent', icon: 'home', type: 'expense' as const },
    { label: 'Oil', icon: 'local_gas_station', type: 'expense' as const },
    { label: 'Phone', icon: 'smartphone', type: 'expense' as const },
    { label: 'Car', icon: 'directions_car', type: 'expense' as const },
    { label: 'Insurance', icon: 'shield', type: 'expense' as const },
    { label: 'Internet', icon: 'wifi', type: 'expense' as const },
    { label: 'Groceries', icon: 'shopping_cart', type: 'expense' as const },
    { label: 'Transport', icon: 'directions_transit', type: 'expense' as const },
    { label: 'Municipal Office', icon: 'account_balance', type: 'expense' as const },
    { label: 'Electricity', icon: 'bolt', type: 'expense' as const },
    { label: 'Water', icon: 'water_drop', type: 'expense' as const },
    { label: 'Dining', icon: 'restaurant', type: 'expense' as const },
    { label: 'Health', icon: 'favorite', type: 'expense' as const },
    { label: 'Education', icon: 'school', type: 'expense' as const },
    { label: 'Deliveroo', icon: 'delivery_dining', type: 'income' as const },
    { label: 'Glovo', icon: 'moped', type: 'income' as const },
    { label: 'Salary', icon: 'payments', type: 'income' as const },
    { label: 'Freelance', icon: 'laptop', type: 'income' as const },
    { label: 'Bonus', icon: 'stars', type: 'income' as const },
    { label: 'Investment', icon: 'trending_up', type: 'income' as const },
  ];

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setFormData(prev => ({
      ...prev,
      category: preset.label,
      type: preset.type,
      amount: '',
      description: '',
    }));
    setShowAdd(true);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startScanning = async (mode: 'user' | 'environment' = facingMode) => {
    stopCamera();
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setIsScanning(false);
      alert("Camera access is required for receipt scanning.");
    }
  };

  const captureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    const imageData = canvasRef.current.toDataURL('image/jpeg');

    stopCamera();
    setIsScanning(false);

    setIsUploading(true);
    try {
      const data = await analyzeReceipt(imageData);
      if (data) {
        setFormData({
          amount: data.amount.toString(),
          category: data.category,
          type: data.type,
          description: data.description,
          date: data.date
        });
        setShowAdd(true);
      }
    } catch (err) {
      alert("Failed to analyze receipt. Please enter manually.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-40 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">Transactions</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Feed</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => startScanning()}
            className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-all hover:bg-primary hover:text-white"
          >
            <span className="material-symbols-outlined text-2xl font-black">photo_camera</span>
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`size-12 rounded-2xl flex items-center justify-center transition-all shadow-xl ${showAdd ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 rotate-45' : 'bg-primary text-white shadow-primary/30'}`}
          >
            <span className="material-symbols-outlined text-2xl font-black">add</span>
          </button>
        </div>
      </div>

      {/* Quick Add Presets */}
      <div className="space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quick Add</p>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PRESETS.filter(p => p.type === 'expense').map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className="flex flex-col items-center gap-1.5 min-w-[64px] bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl p-3 active:scale-95 transition-all hover:bg-rose-500 hover:text-white shrink-0"
            >
              <span className="material-symbols-outlined text-xl">{preset.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">{preset.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PRESETS.filter(p => p.type === 'income').map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className="flex flex-col items-center gap-1.5 min-w-[64px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-2xl p-3 active:scale-95 transition-all hover:bg-emerald-500 hover:text-white shrink-0"
            >
              <span className="material-symbols-outlined text-xl">{preset.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Scanning Modal/Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-6 animate-fadeIn">
          <div className="relative w-full aspect-[3/4] rounded-[2rem] overflow-hidden border-4 border-primary/50 shadow-2xl ai-glow">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_15px_rgba(19,127,236,1)] animate-[scan_2s_infinite]"></div>
          </div>
          <p className="text-white font-black uppercase text-[10px] tracking-widest mt-8 opacity-70">Align receipt within frame</p>

          <div className="mt-auto mb-10 flex flex-col gap-4 w-full">
            {/* Camera Options Toggle */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { setFacingMode('user'); startScanning('user'); }}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${facingMode === 'user' ? 'bg-primary text-white shadow-lg' : 'bg-white/10 text-white/40'}`}
              >
                Front
              </button>
              <button
                onClick={() => { setFacingMode('environment'); startScanning('environment'); }}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${facingMode === 'environment' ? 'bg-primary text-white shadow-lg' : 'bg-white/10 text-white/40'}`}
              >
                Back
              </button>
            </div>

            <div className="flex gap-4 w-full">
              <button
                onClick={() => {
                  stopCamera();
                  setIsScanning(false);
                }}
                className="flex-1 py-4 bg-white/10 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={captureAndProcess}
                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-primary/30"
              >
                Capture Receipt
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Sleek Entry Form */}
      {(showAdd || isUploading) && (
        <div className={`bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-2xl animate-fadeIn space-y-6 relative overflow-hidden ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
          {isUploading && (
            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="font-black text-[10px] uppercase tracking-widest text-primary">Gemini AI is analyzing...</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Transaction Details</h3>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.type === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}
              >Income</button>
              <button
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.type === 'expense' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}
              >Expense</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Value (€)</label>
              <input
                type="number"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 text-2xl font-black outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white"
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white"
                  placeholder="Food, Rent..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white"
                placeholder="Additional notes..."
              />
            </div>
            <button
              onClick={() => handleSubmit()}
              className={`w-full py-5 rounded-[1.5rem] font-black text-white shadow-xl transition-all active:scale-95 ${formData.type === 'income' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}
            >
              Confirm {formData.type}
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-4">
        {transactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
          <div key={t.id} className="group relative bg-white dark:bg-slate-900/50 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-5 flex items-center justify-between transition-all hover:border-primary/20">
            <div className="flex items-center gap-4">
              <div className={`size-12 rounded-2xl flex items-center justify-center font-black ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {t.category.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">{t.category}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{t.date} • {t.description || 'Auto-Logged'}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-lg font-black tracking-tight ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {t.type === 'income' ? '+' : '-'}€{t.amount.toLocaleString()}
              </span>
              <button onClick={() => onDelete(t.id)} className="text-[10px] font-black text-slate-300 hover:text-rose-500 transition-colors uppercase mt-1">Remove</button>
            </div>
          </div>
        ))}

        {transactions.length === 0 && !showAdd && (
          <div className="py-20 text-center space-y-4">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
            </div>
            <h4 className="font-black text-slate-400 uppercase tracking-widest text-sm">Empty Ledger</h4>
            <p className="text-xs text-slate-500 max-w-[200px] mx-auto">Start by adding your first income or expense entry.</p>
          </div>
        )}
      </div>

      {/* Floating Batch Action */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 no-print flex gap-2 w-max max-w-[90vw]">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-center justify-center whitespace-nowrap"
          title="Download CSV Template"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          <span className="hidden sm:inline">Template</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-center justify-center whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">upload_file</span>
          <span>Import CSV</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".csv"
          onChange={handleFileUpload}
        />
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};
