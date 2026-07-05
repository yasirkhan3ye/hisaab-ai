
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Transaction, TransactionType } from '../types';
import { extractTransactionsFromText } from '../services/geminiService';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { useTranslation } from '../services/LanguageContext';
import { formatDisplayDate, formatDisplayTime, formatAmount } from '../services/formatters';

interface TransactionsProps {
  transactions: Transaction[];
  onAdd: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdate?: (t: Transaction) => void;
  onBulkUpdate?: (ts: Transaction[]) => void;
}

// Icon map matching presets
const CATEGORY_ICONS: Record<string, string> = {
  rent: 'home',
  oil: 'local_gas_station',
  petrol: 'local_gas_station',
  phone: 'smartphone',
  car: 'directions_car',
  insurance: 'shield',
  internet: 'wifi',
  groceries: 'shopping_cart',
  'rent food': 'shopping_cart',
  'rentfood': 'shopping_cart',
  transport: 'directions_transit',
  deliveroo: 'delivery_dining',
  glovo: 'moped',
  salary: 'payments',
  salery: 'payments',
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
  'misc.': 'miscellaneous_services',
  accountant: 'calculate',
  donation: 'favorite',
  khairati: 'favorite',
  'bank repayment': 'credit_score',
  'bankrepayment': 'credit_score',
  remittances: 'send_money',
  rimitance: 'send_money',
  lending: 'handshake',
  'loan repayment': 'currency_exchange',
  karim: 'handshake'
};

const getCategoryIcon = (category: string, type: string): string => {
  const cat = category.toLowerCase().trim();
  const icon = CATEGORY_ICONS[cat];
  if (icon) return icon;

  // Partial matches
  if (cat.includes('food')) return 'restaurant';
  if (cat.includes('oil') || cat.includes('petrol')) return 'local_gas_station';
  if (cat.includes('loan')) return 'handshake';

  return type === 'income' ? 'account_balance' : 'shopping_bag';
};

const TransactionItem: React.FC<{
  t_item: Transaction;
  onUpdate?: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onAdd: (t: Transaction) => void;
  t: (key: string) => string;
}> = ({ t_item, onUpdate, onDelete, onAdd, t }) => {
  const isPending = t_item.type === 'income' && (t_item.description || '').includes('[PENDING]');
  const cleanDescription = (t_item.description || '').replace('[PENDING]', '').trim();

  return (
    <div className={`group relative rounded-[1.5rem] border p-5 flex items-center justify-between transition-all hover:border-primary/20 ${isPending ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`size-12 rounded-2xl flex items-center justify-center font-black flex-shrink-0 ${isPending ? 'bg-amber-500/10 text-amber-500' : t_item.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          <span className="material-symbols-outlined text-xl">
            {isPending ? 'hourglass_empty' : getCategoryIcon(t_item.category, t_item.type)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{t_item.category}</h4>
            {isPending && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400">Pending</span>
            )}
            {t_item.excludeFromAnalytics && !isPending && (
              <span className="material-symbols-outlined text-[14px] text-slate-400" title={t('excludedFromAnalyticsTooltip')}>visibility_off</span>
            )}
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
            {formatDisplayDate(t_item.date)} • {cleanDescription || t_item.category}
            {t_item.timestamp ? ` • ${formatDisplayTime(t_item.timestamp)}` : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 ml-4">
        <span className={`text-lg font-black tracking-tight ${isPending ? 'text-amber-500' : t_item.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
          {t_item.type === 'income' ? '+' : '-'}€{formatAmount(t_item.amount)}
        </span>
        <div className="flex gap-2 mt-1">
          {isPending && (
            <button onClick={() => {
              const updated = { ...t_item, description: cleanDescription };
              if (onUpdate) {
                onUpdate(updated);
              } else {
                onDelete(t_item.id);
                setTimeout(() => onAdd(updated), 50); // Fallback
              }
            }} className="text-[10px] font-black text-emerald-500 hover:text-emerald-600 transition-colors uppercase">Clear</button>
          )}
          <button onClick={() => onDelete(t_item.id)} className="text-[10px] font-black text-slate-300 hover:text-rose-500 transition-colors uppercase">{t('remove')}</button>
        </div>
      </div>
    </div>
  );
};

export const Transactions: React.FC<TransactionsProps> = ({ transactions, onAdd, onDelete, onUpdate, onBulkUpdate }) => {
  const { t, language } = useTranslation();
  const [searchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize expanded state for the current month
  useEffect(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setExpandedMonths({ [currentKey]: true });
  }, []);

  const [formData, setFormData] = useState({
    amount: '',
    tipAmount: '',
    category: '',
    type: (searchParams.get('type') as TransactionType) || 'expense',
    description: '',
    date: new Date().toISOString().split('T')[0],
    excludeFromAnalytics: false,
    isPending: false
  });

  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl) {
      setFormData(prev => ({ ...prev, type: typeFromUrl as TransactionType }));
      setShowAdd(true);
    }
  }, [searchParams]);

  const handleBulkPaste = async () => {
    if (!pasteData.trim()) return;
    setIsUploading(true);

    try {
      const lines = pasteData.split(/\r?\n/).filter(l => l.trim());
      const parsed: any[] = [];

      // Look for header in first few lines
      let headerLineIdx = -1;
      let headers: string[] = [];

      for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (lines[i].toLowerCase().includes('month') && (lines[i].toLowerCase().includes('salery') || lines[i].toLowerCase().includes('salary'))) {
          headerLineIdx = i;
          headers = lines[i].split('\t').map(h => h.trim());
          break;
        }
      }

      if (headerLineIdx !== -1) {
        // Custom logic for Yasir's Excel Format
        const dataLines = lines.slice(headerLineIdx + 1);

        dataLines.forEach(line => {
          const cols = line.split('\t').map(c => c.trim());
          if (cols.length < headers.length) return;

          let recordDate = new Date().toISOString().split('T')[0];
          const monthStr = cols[0].trim(); // "Aug 2022" or "August 2022"
          try {
            // Split by space, dash, or any non-alphanumeric to be safe
            const parts = monthStr.split(/[\s\-\/]+/).filter(Boolean);
            if (parts.length >= 2) {
              const mRaw = parts[0].toLowerCase();
              const y = parts[parts.length - 1]; // Take the last part as year

              const monthMap: Record<string, string> = {
                jan:'01', january:'01',
                feb:'02', february:'02',
                mar:'03', march:'03',
                apr:'04', april:'04',
                may:'05',
                jun:'06', june:'06',
                jul:'07', july:'07',
                aug:'08', august:'08',
                sep:'09', september:'09',
                oct:'10', october:'10',
                nov:'11', november:'11',
                dec:'12', december:'12'
              };

              if (monthMap[mRaw]) {
                recordDate = `${y}-${monthMap[mRaw]}-01`;
                console.log(`Detected date: ${recordDate} from "${monthStr}"`);
              }
            }
          } catch (e) {
            console.error("Date parsing failed for:", monthStr);
          }

          headers.forEach((header, idx) => {
            const headerLower = header.toLowerCase();
            const val = cols[idx];

            // Skip empty or zero values
            if (!val || val === '€0' || val === '0' || val === '€ 0' || val === '') return;

            // Skip non-transactional summary columns
            if (headerLower.includes('total') || headerLower.includes('balance') || headerLower === 'month') return;

            // Robust amount cleaning: Handle "€1,664" and "€ 143"
            let cleanVal = val.replace(/[^\d.,-]/g, '');

            // If it has a comma and it's followed by 3 digits, it's likely a thousands separator (English format)
            if (cleanVal.includes(',') && cleanVal.split(',').pop()?.length === 3) {
                cleanVal = cleanVal.replace(/,/g, '');
            } else {
                // Otherwise treat comma as decimal (European format)
                cleanVal = cleanVal.replace(',', '.');
            }

            const amount = Math.abs(parseFloat(cleanVal));

            if (!isNaN(amount) && amount > 0) {
              const isIncome = headerLower.includes('salery') || headerLower.includes('salary') || headerLower.includes('karim');
              const isLoan = headerLower.includes('karim') || headerLower.includes('loan');

              parsed.push({
                id: Math.random().toString(36).slice(2, 11),
                amount: amount,
                category: header.trim(),
                type: isIncome ? 'income' : 'expense',
                date: recordDate,
                description: isLoan ? 'Loan Repayment' : 'Historical Import',
                excludeFromAnalytics: isLoan,
                timestamp: new Date().toISOString()
              });
            }
          });
        });
      }

      if (parsed.length > 0) {
        parsed.forEach(t => onAdd(t));
        alert(`Imported ${parsed.length} items from your monthly sheet!`);
        setPasteData('');
        setShowBulkPaste(false);
      } else {
        // Fallback to AI extraction
        const extracted = await extractTransactionsFromText(pasteData);
        if (extracted && extracted.length > 0) {
          extracted.forEach((item: any) => {
            onAdd({ id: Math.random().toString(36).slice(2, 11), ...item, timestamp: new Date().toISOString() });
          });
          alert(`AI extracted ${extracted.length} records!`);
          setPasteData('');
          setShowBulkPaste(false);
        } else {
          alert("Could not read data. Please check you copied the header row too.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Import failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    const amount = parseFloat(formData.amount || '0');
    const tipAmount = parseFloat(formData.tipAmount || '0');

    if (amount <= 0 && tipAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!formData.category) {
      alert("Please enter a valid category.");
      return;
    }

    // Normalize category: Trim, and Capitalize the first letter
    const normalizedCategory = formData.category.trim().charAt(0).toUpperCase() + formData.category.trim().slice(1);

    // Auto-exclude "Loan Repayment" or similar terms from analytics if it's income
    const shouldExclude = formData.excludeFromAnalytics ||
      (formData.type === 'income' &&
        (normalizedCategory.toLowerCase().includes('loan') ||
          normalizedCategory.toLowerCase().includes('repayment') ||
          normalizedCategory.toLowerCase().includes('lone')));

    let finalDescription = formData.description.trim();

    // 1. Add Main Entry (App Earnings) - This handles the [PENDING] logic
    if (amount > 0) {
      let mainDesc = finalDescription;
      if (formData.type === 'income' && formData.isPending) {
        mainDesc = mainDesc ? `[PENDING] ${mainDesc}` : '[PENDING]';
      }

      onAdd({
        id: Math.random().toString(36).slice(2, 11),
        amount: amount,
        category: normalizedCategory,
        type: formData.type,
        description: mainDesc || normalizedCategory,
        date: formData.date,
        excludeFromAnalytics: shouldExclude,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Add Tip Entry (Always Cash, so NEVER Pending)
    if (tipAmount > 0 && formData.type === 'income') {
      const addTip = () => {
        onAdd({
          id: Math.random().toString(36).slice(2, 11),
          amount: tipAmount,
          category: 'Tips',
          type: 'income',
          description: `Cash tip from ${normalizedCategory}${finalDescription ? ' (' + finalDescription + ')' : ''}`,
          date: formData.date,
          excludeFromAnalytics: false,
          timestamp: new Date().toISOString()
        });
      };

      if (amount > 0) {
        setTimeout(addTip, 50);
      } else {
        addTip();
      }
    }

    setFormData({
      amount: '',
      tipAmount: '',
      category: '',
      type: 'expense',
      description: '',
      date: new Date().toISOString().split('T')[0],
      excludeFromAnalytics: false,
      isPending: false
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

  // A robust CSV line splitter that handles commas inside quotes
  const splitCsvLine = (text: string, sep: string) => {
    const re_value = new RegExp(`(?:^|${sep})("([^"]*)"|[^${sep}]*)`, 'g');
    const result: string[] = [];
    let match;
    while(match = re_value.exec(text)) {
        if(match[0] === '' && result.length === 0) continue;
        result.push(match[2] !== undefined ? match[2] : match[1]);
    }
    return result.length > 0 ? result : [text];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawContent = event.target?.result as string;
        const content = rawContent.replace(/^\uFEFF/, ''); // Strip BOM
        console.log("File content length:", content.length);

        // Attempt local parsing regardless of file extension (handles Android URIs)
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        console.log("Lines found:", lines.length);
        if (lines.length > 1) {
          // Search first 10 lines for a valid header row
          let headerLineIdx = -1;
          let separator = ',';
          let headers: string[] = [];
          let originalHeaders: string[] = [];
          let isLegacy = false;

          for (let idx = 0; idx < Math.min(10, lines.length); idx++) {
            const lineStr = lines[idx].toLowerCase();
            // Broader detection including common Pakistani/Indian and European terms
            if (lineStr.includes('amount') || lineStr.includes('salery') || lineStr.includes('salary') || lineStr.includes('valore')) {
               const sep = lines[idx].includes('\t') ? '\t' : (lines[idx].includes(';') ? ';' : ',');
               const testHeaders = splitCsvLine(lines[idx], sep).map(h => h.trim().toLowerCase());

               const hasStandard = testHeaders.some(h => h.includes('date') || h.includes('data')) &&
                                  testHeaders.some(h => h.includes('amount') || h.includes('valore') || h.includes('price'));

               const hasLegacy = testHeaders.some(h => h.includes('month') || h.includes('mese')) &&
                                testHeaders.some(h => h.includes('salery') || h.includes('salary'));

               if (hasStandard || hasLegacy) {
                   headerLineIdx = idx;
                   separator = sep;
                   headers = testHeaders;
                   originalHeaders = splitCsvLine(lines[idx], sep).map(h => h.trim());
                   isLegacy = hasLegacy && !hasStandard;
                   console.log("Header found at index", idx, "isLegacy:", isLegacy);
                   break;
               }
            }
          }

          if (headerLineIdx !== -1) {
            // 1. STANDARD FORMAT PARSER
            if (!isLegacy) {
              const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('data'));
              const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('valore') || h.includes('price'));
              const categoryIdx = headers.findIndex(h => h.includes('category') || h.includes('categoria'));
              const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('tipo'));
              const descIdx = headers.findIndex(h => h.includes('description') || h.includes('descrizione') || h.includes('note'));

              let addedCount = 0;
              for (let i = headerLineIdx + 1; i < lines.length; i++) {
                const values = splitCsvLine(lines[i], separator).map(v => v.trim());
                if (values.length > Math.max(dateIdx, amountIdx)) {
                  let rawVal = values[amountIdx].replace(/[^\d.,-]/g, '');
                  if (rawVal.includes(',') && !rawVal.includes('.')) rawVal = rawVal.replace(',', '.');
                  else if (rawVal.includes(',') && rawVal.includes('.')) {
                    if (rawVal.lastIndexOf(',') > rawVal.lastIndexOf('.')) rawVal = rawVal.replace(/\./g, '').replace(',', '.');
                    else rawVal = rawVal.replace(/,/g, '');
                  }

                  const amount = parseFloat(rawVal);

                  if (!isNaN(amount)) {
                    const rawCategory = categoryIdx !== -1 ? values[categoryIdx] : 'General';
                    const category = rawCategory.trim().charAt(0).toUpperCase() + rawCategory.trim().slice(1);

                    const type = (() => {
                      if (typeIdx === -1 || !values[typeIdx]) return 'expense';
                      const t = values[typeIdx].toLowerCase().replace(/[^a-z]/g, '');
                      return t === 'income' ? 'income' : 'expense';
                    })() as TransactionType;

                    onAdd({
                      id: Math.random().toString(36).slice(2, 11),
                      date: normalizeDate(values[dateIdx] || new Date().toISOString().split('T')[0]),
                      amount: amount,
                      category: category,
                      type: type,
                      description: (descIdx !== -1 && values[descIdx]) ? values[descIdx] : 'CSV Upload',
                      excludeFromAnalytics: false,
                      timestamp: new Date().toISOString()
                    });
                    addedCount++;
                  }
                }
              }
              if (addedCount > 0) {
                console.log("Successfully parsed", addedCount, "transactions locally.");
                setIsUploading(false);
                return;
              }
            }
            // 2. LEGACY WIDE-FORMAT PARSER
            else {
              const monthIdx = headers.findIndex(h => h.includes('month') || h.includes('mese'));
              const ignoreColumns = ['month', 'mese', 'balance', 'total expenses', 'total'];

              let addedCount = 0;
              for (let i = headerLineIdx + 1; i < lines.length; i++) {
                const values = splitCsvLine(lines[i], separator).map(v => v.trim());
                let recordDate = new Date().toISOString().split('T')[0];

                if (monthIdx !== -1 && values[monthIdx]) {
                  try {
                    const parsed = new Date(values[monthIdx]);
                    if (!isNaN(parsed.getTime())) {
                      recordDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-01`;
                    }
                  } catch (e) {}
                }

                for (let col = 0; col < headers.length; col++) {
                  const headerNameLower = headers[col];
                  if (!headerNameLower || ignoreColumns.includes(headerNameLower) || col >= values.length) continue;

                  let rawVal = values[col].replace(/[^\d.,-]/g, '');
                  const amount = parseFloat(rawVal);

                  if (!isNaN(amount) && amount > 0) {
                    onAdd({
                      id: Math.random().toString(36).slice(2, 11),
                      date: recordDate,
                      amount: amount,
                      category: originalHeaders[col].trim(),
                      type: (headerNameLower.includes('salery') || headerNameLower.includes('salary')) ? 'income' : 'expense',
                      description: 'Legacy CSV Import',
                      excludeFromAnalytics: false,
                      timestamp: new Date().toISOString()
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
        }

        console.log("Local parsing failed or no data, falling back to Gemini AI...");
        const extracted = await extractTransactionsFromText(content);
        if (extracted && extracted.length > 0) {
          extracted.forEach((item: any) => {
            onAdd({
              id: Math.random().toString(36).slice(2, 11),
              ...item,
              timestamp: new Date().toISOString()
            });
          });
        } else {
          alert("Could not detect any transactions in this file. Please check the CSV format.");
        }
      } catch (err: any) {
        console.error("Gemini Error:", err);
        alert(err.message || "Connection to computer failed. Make sure 'vercel dev' is running.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
        setIsUploading(false);
        alert("Failed to read the file.");
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = async () => {
    // 1. Generate clean CSV content
    const headers = "date,amount,category,type,description";
    const sampleRows = [
      "2026-05-01,150.00,Groceries,expense,Weekly supermarket",
      "2026-05-02,2000.00,Salary,income,Monthly Salary"
    ];
    const csvContent = headers + "\n" + sampleRows.join("\n");

    // 2. Handle Native Mobile (Android/iOS) via Filesystem & Share API
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `hisaab_template_${Date.now()}.csv`;

        // Write the file to the Cache directory
        const result = await Filesystem.writeFile({
          path: fileName,
          data: csvContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        // Share the generated physical file URL
        await Share.share({
          title: 'Hisaab AI CSV Template',
          url: result.uri,
          dialogTitle: 'Save CSV Template',
        });
      } catch (err) {
        console.error("Share failed", err);
        alert("Could not generate or share the CSV file. Please try the web version.");
      }
      return;
    }

    // 3. Handle Web (Browser) via Blob/Download link
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "hisaab_template.csv");
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const PRESETS = [
    // Income (Earnings)
    { label: 'deliveroo', icon: 'delivery_dining', type: 'income' as const },
    { label: 'glovo', icon: 'moped', type: 'income' as const },
    { label: 'freelance', icon: 'laptop', type: 'income' as const },
    { label: 'salary', icon: 'payments', type: 'income' as const },
    { label: 'investment', icon: 'trending_up', type: 'income' as const },
    { label: 'bonus', icon: 'stars', type: 'income' as const },
    { label: 'business', icon: 'storefront', type: 'income' as const },
    { label: 'gift', icon: 'featured_video', type: 'income' as const },

    // Expenses (Spending)
    { label: 'rent', icon: 'home', type: 'expense' as const },
    { label: 'oil', icon: 'local_gas_station', type: 'expense' as const },
    { label: 'groceries', icon: 'shopping_cart', type: 'expense' as const },
    { label: 'phone', icon: 'smartphone', type: 'expense' as const },
    { label: 'insurance', icon: 'shield', type: 'expense' as const },
    { label: 'internet', icon: 'wifi', type: 'expense' as const },
    { label: 'transport', icon: 'directions_transit', type: 'expense' as const },
    { label: 'shopping', icon: 'shopping_bag', type: 'expense' as const },
    { label: 'health', icon: 'medical_services', type: 'expense' as const },
    { label: 'education', icon: 'school', type: 'expense' as const },
    { label: 'entertainment', icon: 'theater_comedy', type: 'expense' as const },
    { label: 'bills', icon: 'receipt_long', type: 'expense' as const },
    { label: 'gas', icon: 'local_fire_department', type: 'expense' as const },
    { label: 'electricity', icon: 'bolt', type: 'expense' as const },
    { label: 'water bill', icon: 'water_drop', type: 'expense' as const },
    { label: 'taxes', icon: 'account_balance', type: 'expense' as const },
    { label: 'miscellaneous', icon: 'miscellaneous_services', type: 'expense' as const },
    { label: 'accountant', icon: 'calculate', type: 'expense' as const },
    { label: 'donation', icon: 'favorite', type: 'expense' as const },
    { label: 'bank repayment', icon: 'credit_score', type: 'expense' as const },
    { label: 'remittances', icon: 'send_money', type: 'expense' as const },
  ];

  const handlePreset = (preset: typeof PRESETS[0]) => {
    // Capitalize the first letter for consistency
    const capitalizedCategory = preset.label.charAt(0).toUpperCase() + preset.label.slice(1);

    // Auto-set pending for typical shift-work jobs
    const shouldBePending = preset.type === 'income' && ['deliveroo', 'glovo', 'freelance'].includes(preset.label.toLowerCase());

    setFormData(prev => ({
      ...prev,
      category: capitalizedCategory,
      type: preset.type,
      amount: '',
      tipAmount: '',
      description: '',
      excludeFromAnalytics: false,
      isPending: shouldBePending
    }));
    setShowAdd(true);
  };

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.trim().toLowerCase();
    const dateStr = formatDisplayDate(t.date).toLowerCase();
    const timeStr = t.timestamp ? formatDisplayTime(t.timestamp).toLowerCase() : '';
    const catStr = t.category.trim().toLowerCase();
    const descStr = t.description?.trim().toLowerCase() || '';
    const amountStr = t.amount.toString();

    return catStr.includes(searchLower) ||
           descStr.includes(searchLower) ||
           dateStr.includes(searchLower) ||
           timeStr.includes(searchLower) ||
           amountStr.includes(searchLower);
  });

  const pendingTransactions = filteredTransactions.filter(t => t.type === 'income' && (t.description || '').trim().includes('[PENDING]'));

  const handleClearBatchPending = (txsToClear: Transaction[]) => {
    if (!onBulkUpdate) return;
    const clearedTxs = txsToClear.map(t => ({
      ...t,
      description: (t.description || '').replace('[PENDING]', '').trim()
    }));
    onBulkUpdate(clearedTxs);
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedTransactions = useMemo(() => {
    // 1. Separate Pending
    const pending = filteredTransactions.filter(t => (t.description || '').includes('[PENDING]'));
    const regular = filteredTransactions.filter(t => !(t.description || '').includes('[PENDING]'));

    // 1.5 Group Pending by Month
    const pendingGroups: Record<string, { label: string, txs: Transaction[], total: number }> = {};
    pending.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!pendingGroups[key]) {
        const label = d.toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' });
        pendingGroups[key] = { label, txs: [], total: 0 };
      }
      pendingGroups[key].txs.push(t);
      pendingGroups[key].total += t.amount;
    });
    const sortedPendingKeys = Object.keys(pendingGroups).sort((a, b) => b.localeCompare(a));

    // 2. Group Regular by Month
    const groups: Record<string, { label: string, txs: Transaction[], inflow: number, outflow: number, net: number }> = {};

    regular.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) {
        const label = d.toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' });
        groups[key] = { label, txs: [], inflow: 0, outflow: 0, net: 0 };
      }
      groups[key].txs.push(t);
      if (t.type === 'income') groups[key].inflow += t.amount;
      else groups[key].outflow += t.amount;
      groups[key].net = groups[key].inflow - groups[key].outflow;
    });

    // 3. Sort groups by key descending (newest first)
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return { pending, sortedPendingKeys, pendingGroups, sortedKeys, groups };
  }, [filteredTransactions, language]);

  return (
    <>
      <div className="space-y-6 pb-64 animate-fadeIn">
        {/* Page Header */}
        <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">{t('transactions')}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('transactionFeed')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulkPaste(!showBulkPaste); setShowAdd(false); setShowSearch(false); }}
            className={`size-12 rounded-2xl flex items-center justify-center transition-all ${showBulkPaste ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/50' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white'}`}
            title="Bulk Paste from Excel"
          >
            <span className="material-symbols-outlined text-2xl font-black">content_paste</span>
          </button>
          <button
            onClick={() => { setShowSearch(!showSearch); setShowAdd(false); setShowBulkPaste(false); }}
            className={`size-12 rounded-2xl flex items-center justify-center transition-all ${showSearch ? 'bg-primary text-white shadow-lg shadow-primary/50' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-2xl font-black">search</span>
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowSearch(false); setShowBulkPaste(false); }}
            className={`size-12 rounded-2xl flex items-center justify-center transition-all shadow-xl ${showAdd ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 rotate-45' : 'bg-primary text-white shadow-primary/30'}`}
          >
            <span className="material-symbols-outlined text-2xl font-black">add</span>
          </button>
        </div>
      </div>

      {showBulkPaste && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-2xl animate-fadeIn space-y-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('bulkPaste')}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('bulkPasteDesc')}</p>
          </div>
          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="Example:&#10;2026-05-01	150.00	Groceries	expense	Weekly supermarket&#10;2026-05-02	2000.00	Salary	income	Monthly Salary"
            className="w-full h-40 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowBulkPaste(false)}
              className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleBulkPaste}
              disabled={!pasteData.trim() || isUploading}
              className="flex-[2] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white bg-amber-500 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isUploading ? t('parsing') : t('importAllRows')}
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="px-1 animate-fadeIn">
          <div className="relative">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 px-6 pl-12 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>
      )}

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

      {(showAdd || isUploading) && (
        <div className={`bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-100 dark:border-slate-800 shadow-2xl animate-fadeIn space-y-6 relative overflow-hidden ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
          {isUploading && (
            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="font-black text-[10px] uppercase tracking-widest text-primary">{t('loading')}</p>
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
            {formData.type === 'income' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{formData.isPending ? 'App Earnings' : t('value')} (€)</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-4 text-2xl font-black outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Cash Tips (€)</label>
                  <input
                    type="number"
                    value={formData.tipAmount}
                    onChange={e => setFormData({ ...formData, tipAmount: e.target.value })}
                    className="w-full bg-emerald-50 dark:bg-emerald-500/10 border-none rounded-2xl p-4 text-2xl font-black outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ) : (
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
            )}
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

            {/* Pending Earning Toggle (Only for Income) */}
            {formData.type === 'income' && (
              <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-900/50 hover:border-amber-400 transition-all cursor-pointer" onClick={() => setFormData({ ...formData, isPending: !formData.isPending })}>
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${formData.isPending ? 'bg-amber-500 text-white' : 'bg-amber-200 dark:bg-amber-800 text-amber-600 dark:text-amber-400'}`}>
                    <span className="material-symbols-outlined text-xl">hourglass_empty</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-400">Pending Earning</p>
                    <p className="text-[8px] font-bold text-amber-600 dark:text-amber-500 uppercase">Will not affect bank balance yet</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.isPending ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800'}`}>
                  <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${formData.isPending ? 'left-5' : 'left-1'}`} />
                </div>
              </div>
            )}

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
        {groupedTransactions.sortedPendingKeys.length > 0 && onBulkUpdate && (
          <div className="space-y-3">
             <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] px-1">Pending Payout Batches</p>
             {groupedTransactions.sortedPendingKeys.map(key => {
               const group = groupedTransactions.pendingGroups[key];
               return (
                <div key={`pending-batch-${key}`} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 p-5 rounded-[1.8rem] animate-fadeIn">
                  <div className="min-w-0 flex-1 mr-4">
                    <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-0.5">{group.label}</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">€{formatAmount(group.total)} <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">({group.txs.length} entries)</span></p>
                  </div>
                  <button
                    onClick={() => handleClearBatchPending(group.txs)}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg shadow-amber-500/30 transition-all active:scale-95 flex-shrink-0"
                  >
                    Clear {group.label.split(' ')[0]}
                  </button>
                </div>
               );
             })}
          </div>
        )}

        {/* 1. Render Pending (Always Expanded) */}
        {groupedTransactions.pending.length > 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] px-1">{t('activePendingEntries')}</p>
            {groupedTransactions.pending.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()).map(t_item => (
               <TransactionItem key={t_item.id} t_item={t_item} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd} t={t} />
            ))}
          </div>
        )}

        {/* 2. Render Collapsible Months */}
        {groupedTransactions.sortedKeys.map(key => {
          const group = groupedTransactions.groups[key];
          const isExpanded = expandedMonths[key];

          return (
            <div key={key} className="space-y-3">
              {/* Monthly Header / Toggle */}
              <button
                onClick={() => toggleMonth(key)}
                className={`w-full flex items-center justify-between p-5 rounded-[1.8rem] transition-all border ${isExpanded ? 'bg-slate-900 border-slate-800 text-white shadow-xl' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'}`}
              >
                <div className="flex flex-col items-start min-w-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isExpanded ? 'text-primary' : 'text-slate-400'}`}>{group.label}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-black">€{formatAmount(group.net)}</span>
                    <span className={`text-[8px] font-bold uppercase ${group.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {group.net >= 0 ? t('savings') : t('deficit')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">{t('in')} €{formatAmount(group.inflow)}</p>
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">{t('out')} €{formatAmount(group.outflow)}</p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : 'text-slate-300'}`}>
                    expand_more
                  </span>
                </div>
              </button>

              {/* Transactions in Month */}
              {isExpanded && (
                <div className="space-y-3 animate-fadeIn pl-2 border-l-2 border-slate-100 dark:border-slate-800 ml-5">
                  {group.txs.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()).map(t_item => (
                    <TransactionItem key={t_item.id} t_item={t_item} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd} t={t} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredTransactions.length === 0 && !showAdd && (
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
        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/octet-stream,*/*" onChange={handleFileUpload} />
      </div>
    </div>
    </>
  );
};
