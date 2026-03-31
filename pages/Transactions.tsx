
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Transaction, TransactionType } from '../types';
import { extractTransactionsFromText, analyzeReceipt } from '../services/geminiService';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from '../services/LanguageContext';
import { formatDisplayDate } from '../services/formatters';

interface TransactionsProps {
  transactions: Transaction[];
  onAdd: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ transactions, onAdd, onDelete }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    type: (searchParams.get('type') as TransactionType) || 'expense',
    description: '',
    date: new Date().toISOString().split('T')[0],
    excludeFromAnalytics: false
  });

  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl) {
      setFormData(prev => ({ ...prev, type: typeFromUrl as TransactionType }));
      setShowAdd(true);
    }
  }, [searchParams]);

  const startVoiceCapture = async () => {
    setIsListening(true);
    try {
      // Use Capacitor for Native, Web Speech API for Browser
      if (Capacitor.isNativePlatform()) {
        console.log('Using Native Speech Recognition');
        const { available } = await SpeechRecognition.available();
        if (!available) {
          alert('Speech recognition is not available on this device.');
          setIsListening(false);
          return;
        }

        const status = await SpeechRecognition.checkPermissions();
        if ((status as any).display !== 'granted') {
          const newStatus = await SpeechRecognition.requestPermissions();
          if ((newStatus as any).display !== 'granted') {
            setIsListening(false);
            return;
          }
        }

        SpeechRecognition.start({
          language: 'en-US',
          partialResults: false,
          popup: true,
        });

        const result = await new Promise<string>(async (resolve, reject) => {
          let settled = false;
          let stopTimeoutId: ReturnType<typeof setTimeout> | null = null;
          let globalTimeoutId: ReturnType<typeof setTimeout> | null = null;

          const resultListener = await SpeechRecognition.addListener('results' as any, (data: any) => {
            if (settled) return;
            if (data.matches && data.matches.length > 0) {
              settled = true;
              if (stopTimeoutId) clearTimeout(stopTimeoutId);
              if (globalTimeoutId) clearTimeout(globalTimeoutId);
              resultListener.remove();
              stateListener.remove();
              resolve(data.matches[0]);
            }
          });

          const stateListener = await SpeechRecognition.addListener('listeningState' as any, (state: any) => {
            if (settled) return;
            if (state.status === 'stopped') {
              stopTimeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                if (globalTimeoutId) clearTimeout(globalTimeoutId);
                resultListener.remove();
                stateListener.remove();
                reject('Stopped without results');
              }, 500);
            }
          });

          globalTimeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            if (stopTimeoutId) clearTimeout(stopTimeoutId);
            resultListener.remove();
            stateListener.remove();
            reject('Speech recognition timed out');
          }, 30000);
        });

        processVoiceResult(result);
      } else {
        // Browser Fallback (Web Speech API)
        console.log('Using Web Speech API Fallback');
        const SpeechRecognitionWeb = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionWeb) {
          alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
          setIsListening(false);
          return;
        }

        const recognition = new SpeechRecognitionWeb();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          processVoiceResult(text);
        };

        recognition.onerror = (event: any) => {
          console.error('Web Speech API Error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            alert('Microphone permission denied. Please enable it in browser settings.');
          } else {
            alert(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      }
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
      if (err !== 'Stopped without results') {
        alert(t('speechError'));
      }
    }
  };

  const processVoiceResult = async (text: string) => {
    setIsListening(false);
    setIsUploading(true);
    try {
      const parsed = await extractTransactionsFromText(text);
      if (parsed && parsed.length > 0) {
        const item = parsed[0] as any;
        const rawCat = (item.category ?? '').toString().trim();
        const cat = rawCat ? rawCat.charAt(0).toUpperCase() + rawCat.slice(1) : '';
        const desc = (item.description ?? '').toString();
        setFormData({
          amount: (item.amount ?? 0).toString(),
          category: cat,
          type: (item.type ?? 'expense') as TransactionType,
          description: desc,
          date: item.date ?? new Date().toISOString().split('T')[0],
          excludeFromAnalytics: item.type === 'income' &&
            (cat.toLowerCase().includes('loan') || cat.toLowerCase().includes('repayment') || cat.toLowerCase().includes('lone'))
        });
        setShowAdd(true);
      } else {
        alert(t('extractionError'));
      }
    } catch (err) {
      console.error('AI Parsing error:', err);
      alert('Failed to parse your voice input. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.amount || !formData.category) return;

    // Normalize category: Trim, and Capitalize the first letter
    const normalizedCategory = formData.category.trim().charAt(0).toUpperCase() + formData.category.trim().slice(1);

    // Auto-exclude "Loan Repayment" or similar terms from analytics if it's income
    const shouldExclude = formData.excludeFromAnalytics ||
      (formData.type === 'income' &&
        (normalizedCategory.toLowerCase().includes('loan') ||
          normalizedCategory.toLowerCase().includes('repayment') ||
          normalizedCategory.toLowerCase().includes('lone')));

    onAdd({
      id: Math.random().toString(36).slice(2, 11),
      amount: parseFloat(formData.amount),
      category: normalizedCategory,
      type: formData.type,
      description: formData.description,
      date: formData.date,
      excludeFromAnalytics: shouldExclude
    });
    setFormData({
      amount: '',
      category: '',
      type: 'expense',
      description: '',
      date: new Date().toISOString().split('T')[0],
      excludeFromAnalytics: false
    });
    setShowAdd(false);
  };

  const normalizeDate = (raw: string): string => {
    const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const [, m, d, y] = slashMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return raw;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;

      if (file.name.toLowerCase().endsWith('.csv')) {
        try {
          const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length > 1) {
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
                    const rawCategory = values[categoryIdx] || '';
                    const category = rawCategory.trim().charAt(0).toUpperCase() + rawCategory.trim().slice(1);

                    const type = (() => {
                      if (typeIdx === -1 || !values[typeIdx]) return 'expense';
                      const t = values[typeIdx].toLowerCase().replace(/[^a-z]/g, '');
                      return t === 'income' ? 'income' : 'expense';
                    })() as TransactionType;

                    const autoExclude = type === 'income' &&
                      (category.toLowerCase().includes('loan') ||
                        category.toLowerCase().includes('repayment') ||
                        category.toLowerCase().includes('lone'));

                    onAdd({
                      id: Math.random().toString(36).slice(2, 11),
                      date: normalizeDate(values[dateIdx] || new Date().toISOString().split('T')[0]),
                      amount: amount,
                      category: category,
                      type: type,
                      description: (descIdx !== -1 && values[descIdx]) ? values[descIdx] : 'CSV Upload',
                      excludeFromAnalytics: autoExclude
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

      try {
        const extracted = await extractTransactionsFromText(content);
        if (extracted && extracted.length > 0) {
          extracted.forEach((item: any) => {
            const cat = (item.category ?? '').toString().toLowerCase();
            const autoExclude = item.type === 'income' &&
              (cat.includes('loan') || cat.includes('repayment') || cat.includes('lone'));
            onAdd({
              id: Math.random().toString(36).slice(2, 11),
              ...item,
              excludeFromAnalytics: autoExclude
            });
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
    { label: 'rent', icon: 'home', type: 'expense' as const },
    { label: 'oil', icon: 'local_gas_station', type: 'expense' as const },
    { label: 'phone', icon: 'smartphone', type: 'expense' as const },
    { label: 'car', icon: 'directions_car', type: 'expense' as const },
    { label: 'insurance', icon: 'shield', type: 'expense' as const },
    { label: 'internet', icon: 'wifi', type: 'expense' as const },
    { label: 'groceries', icon: 'shopping_cart', type: 'expense' as const },
    { label: 'transport', icon: 'directions_transit', type: 'expense' as const },
    { label: 'deliveroo', icon: 'delivery_dining', type: 'income' as const },
    { label: 'glovo', icon: 'moped', type: 'income' as const },
    { label: 'salary', icon: 'payments', type: 'income' as const },
    { label: 'freelance', icon: 'laptop', type: 'income' as const },
    { label: 'bonus', icon: 'stars', type: 'income' as const },
    { label: 'investment', icon: 'trending_up', type: 'income' as const },
  ];

  const handlePreset = (preset: typeof PRESETS[0]) => {
    // Capitalize the first letter for consistency
    const capitalizedCategory = preset.label.charAt(0).toUpperCase() + preset.label.slice(1);

    setFormData(prev => ({
      ...prev,
      category: capitalizedCategory,
      type: preset.type,
      amount: '',
      description: '',
      excludeFromAnalytics: false
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
          date: data.date,
          excludeFromAnalytics: data.type === 'income' && (data.category.toLowerCase().includes('loan') || data.category.toLowerCase().includes('repayment'))
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
    <div className="space-y-6 pb-64 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">{t('transactions')}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('transactionFeed')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => startVoiceCapture()}
            className={`size-12 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-primary text-white animate-pulse shadow-lg shadow-primary/50' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
            title={t('startVoiceCapture')}
          >
            <span className="material-symbols-outlined text-2xl font-black">{isListening ? 'mic' : 'mic_none'}</span>
          </button>
          <button
            onClick={() => startScanning()}
            className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-all hover:bg-primary hover:text-white"
            title={t('captureReceipt')}
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
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('quickAdd')}</p>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PRESETS.filter(p => p.type === 'expense').map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className="flex flex-col items-center gap-1.5 min-w-[64px] bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl p-3 active:scale-95 transition-all hover:bg-rose-500 hover:text-white shrink-0"
            >
              <span className="material-symbols-outlined text-xl">{preset.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">{t(preset.label)}</span>
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
              <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">{t(preset.label)}</span>
            </button>
          ))}
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-6 animate-fadeIn">
          <div className="relative w-full aspect-[3/4] rounded-[2rem] overflow-hidden border-4 border-primary/50 shadow-2xl ai-glow">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_15px_rgba(19,127,236,1)] animate-[scan_2s_infinite]"></div>
          </div>
          <p className="text-white font-black uppercase text-[10px] tracking-widest mt-8 opacity-70">Align receipt within frame</p>
          <div className="mt-auto mb-10 flex flex-col gap-4 w-full">
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
                onClick={() => { stopCamera(); setIsScanning(false); }}
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

      {(showAdd || isUploading) && (
        <div className={`bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-2xl animate-fadeIn space-y-6 relative overflow-hidden ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
          {isUploading && (
            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="font-black text-[10px] uppercase tracking-widest text-primary">{t('analyzingReceipt')}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('transactionDetails')}</h3>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.type === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}
              >{t('income')}</button>
              <button
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.type === 'expense' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}
              >{t('expense')}</button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('value')} (€)</label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('category')}</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white"
                  placeholder={t('categoryPlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('date')}</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('description')}</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white"
                placeholder={t('descriptionPlaceholder')}
              />
            </div>

            {/* Exclude Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-primary/20 transition-all cursor-pointer" onClick={() => setFormData({ ...formData, excludeFromAnalytics: !formData.excludeFromAnalytics })}>
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center ${formData.excludeFromAnalytics ? 'bg-primary/20 text-primary' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-xl">{formData.excludeFromAnalytics ? 'visibility_off' : 'visibility'}</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white">{t('excludeFromAnalytics')}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">{t('excludeDesc')}</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.excludeFromAnalytics ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${formData.excludeFromAnalytics ? 'left-5' : 'left-1'}`} />
              </div>
            </div>

            <button
              onClick={() => handleSubmit()}
              className={`w-full py-5 rounded-[1.5rem] font-black text-white shadow-xl transition-all active:scale-95 ${formData.type === 'income' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}
            >
              {t('confirm')} {t(formData.type)}
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-4">
        {transactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t_item => (
          <div key={t_item.id} className="group relative bg-white dark:bg-slate-900/50 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-5 flex items-center justify-between transition-all hover:border-primary/20">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={`size-12 rounded-2xl flex items-center justify-center font-black flex-shrink-0 ${t_item.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {t_item.category.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{t_item.category}</h4>
                  {t_item.excludeFromAnalytics && (
                    <span className="material-symbols-outlined text-[14px] text-slate-400" title={t('excludedFromAnalyticsTooltip')}>visibility_off</span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">{formatDisplayDate(t_item.date)} • {t_item.description || t('autoLogged')}</p>
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 ml-4">
              <span className={`text-lg font-black tracking-tight ${t_item.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {t_item.type === 'income' ? '+' : '-'}€{t_item.amount.toLocaleString()}
              </span>
              <button onClick={() => onDelete(t_item.id)} className="text-[10px] font-black text-slate-300 hover:text-rose-500 transition-colors uppercase mt-1">{t('remove')}</button>
            </div>
          </div>
        ))}

        {transactions.length === 0 && !showAdd && (
          <div className="py-20 text-center space-y-4">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
            </div>
            <h4 className="font-black text-slate-400 uppercase tracking-widest text-sm">{t('emptyLedger')}</h4>
          </div>
        )}
      </div>

      {/* Floating Batch Action */}
      <div className="fixed bottom-48 left-1/2 -translate-x-1/2 z-40 no-print flex gap-2 w-max max-w-[90vw]">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-center justify-center whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          <span className="hidden sm:inline">{t('template')}</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-center justify-center whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">upload_file</span>
          <span>{t('importCsv')}</span>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
      </div>

      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>
    </div>
  );
};
