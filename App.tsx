
import React, { useState, useEffect, ErrorInfo, ReactNode, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Transactions } from './pages/Transactions';
import { Analytics } from './pages/Analytics';
import { Lend } from './pages/Lend';
import { Menu } from './pages/Menu';
import { Transaction, LendRecord, UserProfile, Notification } from './types';
import { fetchDataFromCloud, deleteRecordFromCloud, syncDataToCloud, supabase } from './services/supabaseClient';
import { LanguageProvider, useTranslation } from './services/LanguageContext';
import { UpdateNotifier } from './components/UpdateNotifier';

// Theme Context
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// User Context
interface UserContextType {
  profile: UserProfile;
  updateProfile: (newProfile: UserProfile) => void;
}
export const UserContext = createContext<UserContextType | undefined>(undefined);
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};

// Notification Context
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}
export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};

// Global Sync Context
interface SyncContextType {
  isSyncing: boolean;
  triggerManualSync: () => Promise<void>;
  lastSyncTime: string;
  cloudPullCount: number;
  cloudPushCount: number;
  syncError: string | null;
  syncWord: string | null;
  hardResetAndSync: () => Promise<void>;
  isInitialPullDone: boolean;
  localRecordCount: number;
  sessionLogs: string[];
}
export const SyncContext = createContext<SyncContextType | undefined>(undefined);
export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  public state = { hasError: false };
  public static getDerivedStateFromError(_: Error) { return { hasError: true }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-[#020617] text-white">
          <span className="material-icons text-rose-500 text-6xl mb-4">error</span>
          <h2 className="text-xl font-black mb-2">Something went wrong</h2>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/30">Refresh</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const initialProfile: UserProfile = { name: 'Yasir khan', avatarSeed: 'Aneka' };

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  return <Login onLogin={() => navigate('/')} />;
};

const HisaabApp: React.FC = () => {
  const [syncWord, setSyncWord] = useState<string | null>(localStorage.getItem('hisaab_sync_word'));
  const [inputWord, setInputWord] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [isInitialPullDone, setIsInitialPullDone] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cloudPullCount, setCloudPullCount] = useState(0);
  const [cloudPushCount, setCloudPushCount] = useState(0);
  const [sessionLogs, setSessionLogs] = useState<string[]>(['System initialized']);

  const addLog = (msg: string) => {
    setSessionLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('hisaab_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('hisaab_profile');
    return saved ? JSON.parse(saved) : initialProfile;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fingemini_txs');
    if (saved) return JSON.parse(saved);

    // Seed sample data if empty
    return [
      { id: 'sample-1', amount: 1200, category: 'Salary', type: 'income', date: '2026-03-01', description: 'Monthly Salary' },
      { id: 'sample-2', amount: 450, category: 'Rent', type: 'expense', date: '2026-03-02', description: 'Apartment Rent' },
      { id: 'sample-3', amount: 85, category: 'Groceries', type: 'expense', date: '2026-03-05', description: 'Weekly Shopping' },
      { id: 'sample-4', amount: 40, category: 'Internet', type: 'expense', date: '2026-03-10', description: 'Fiber Optic' },
      { id: 'sample-5', amount: 200, category: 'Freelance', type: 'income', date: '2026-03-15', description: 'Logo Design Project' },
      { id: 'sample-6', amount: 60, category: 'Dining', type: 'expense', date: '2026-03-20', description: 'Dinner with friends' }
    ];
  });
  const [lendRecords, setLendRecords] = useState<LendRecord[]>(() => {
    const saved = localStorage.getItem('fingemini_lend');
    return saved ? JSON.parse(saved) : [];
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const pullDataFromCloud = async () => {
    if (!syncWord) return;
    setIsSyncing(true);
    setSyncError(null);
    addLog(`Initiating pull logic...`);
    try {
      const { data: cloudTxs, error: txError } = await fetchDataFromCloud('transactions') as any;
      const { data: cloudLend, error: lendError } = await fetchDataFromCloud('lend_records') as any;
      const { data: cloudProfile, error: profileError } = await fetchDataFromCloud('profiles') as any;

      if (txError || lendError || profileError) {
        const msg = (txError?.message || lendError?.message || profileError?.message || 'Cloud Connection Error');
        setSyncError(msg);
        addLog(`Error: ${msg}`);
        return;
      }

      addLog(`Cloud check: ${cloudTxs?.length || 0} txs found`);

      // Deep Merge logic: Prioritize cloud data for matching IDs
      if (cloudTxs && Array.isArray(cloudTxs)) {
        setCloudPullCount(cloudTxs.length);
        setTransactions(prev => {
          const merged = new Map();
          // Add local data first
          prev.forEach(t => merged.set(t.id, t));
          // Overwrite with cloud data (it is the source of truth)
          cloudTxs.forEach((ctx: any) => {
            const { user_id, created_at, ...cleanCtx } = ctx;
            merged.set(ctx.id, cleanCtx);
          });
          return Array.from(merged.values());
        });
      }
      if (cloudLend && Array.isArray(cloudLend)) {
        setLendRecords(prev => {
          const merged = new Map();
          prev.forEach(r => merged.set(r.id, r));
          cloudLend.forEach((cl: any) => {
            const { user_id, created_at, ...cleanCl } = cl;
            merged.set(cl.id, cleanCl);
          });
          return Array.from(merged.values());
        });
      }
      if (cloudProfile && cloudProfile[0]) setProfile(cloudProfile[0]);

      setLastSyncTime(new Date().toLocaleTimeString());
      setSyncError(null);

      // CRITICAL: We mark pull as done even if cloud was empty 
      // This allows the device to start uploading its existing records
      setIsInitialPullDone(true);
    } catch (e: any) {
      setSyncError(`System: ${e.message || 'Network Timeout'}`);
      // If it was a network error, we don't mark as done
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (syncWord) {
      pullDataFromCloud().then(() => {
        // After the first pull, we know we are safe to push our local data if we have any
        setIsInitialPullDone(true);
      });
    }
  }, [syncWord]);

  // Periodic Auto-Sync (every 5 mins) as a backup
  useEffect(() => {
    const timer = setInterval(() => {
      if (syncWord) pullDataFromCloud();
    }, 300000);
    return () => clearInterval(timer);
  }, [syncWord]);

  // REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!syncWord) return;

    // Subscribe to Transactions
    const txSubscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${syncWord}`
      }, (payload) => {
        console.log('Realtime TX change:', payload);
        pullDataFromCloud(); // Refresh data on any change
      })
      .subscribe();

    // Subscribe to Lend Records
    const lendSubscription = supabase
      .channel('public:lend_records')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lend_records',
        filter: `user_id=eq.${syncWord}`
      }, (payload) => {
        console.log('Realtime Lend change:', payload);
        pullDataFromCloud();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(txSubscription);
      supabase.removeChannel(lendSubscription);
    };
  }, [syncWord]);

  useEffect(() => {
    if (syncWord && isInitialPullDone) {
      localStorage.setItem('hisaab_profile', JSON.stringify(profile));
      localStorage.setItem('fingemini_txs', JSON.stringify(transactions));
      localStorage.setItem('fingemini_lend', JSON.stringify(lendRecords));

      // Forced initial push to ensure cloud matches local
      syncDataToCloud('profiles', [profile]);

      const realTxs = transactions.filter(t => !t.id.startsWith('sample-'));
      if (realTxs.length > 0) {
        syncDataToCloud('transactions', realTxs).then(err => {
          if (!err) setCloudPushCount(realTxs.length);
        });
      }

      if (lendRecords.length > 0) syncDataToCloud('lend_records', lendRecords);
    }
  }, [isInitialPullDone, syncWord]);

  useEffect(() => {
    if (syncWord && isInitialPullDone) {
      localStorage.setItem('fingemini_txs', JSON.stringify(transactions));
      const realTxs = transactions.filter(t => !t.id.startsWith('sample-'));
      if (realTxs.length > 0) {
        syncDataToCloud('transactions', realTxs).then(err => {
          if (!err) setCloudPushCount(realTxs.length);
        });
      }
    }
  }, [transactions, syncWord]);

  const triggerFullSync = async () => {
    if (!syncWord) {
      addLog('No sync word set. Aborting.');
      return;
    }
    addLog('=== ATOMIC SYNC START ===');

    // STEP 1: Push local data to cloud FIRST
    const rawTxs = localStorage.getItem('fingemini_txs');
    const localTxs: Transaction[] = rawTxs ? JSON.parse(rawTxs) : [];
    const realTxs = localTxs.filter(t => !t.id.startsWith('sample-'));

    addLog(`Local has ${localTxs.length} total (${realTxs.length} real)`);

    if (realTxs.length > 0) {
      addLog(`Uploading ${realTxs.length} records...`);
      const pushErr = await syncDataToCloud('transactions', realTxs);
      if (pushErr) {
        addLog(`UPLOAD FAILED: ${JSON.stringify(pushErr)}`);
        setSyncError(`Upload: ${JSON.stringify(pushErr)}`);
      } else {
        addLog(`Upload SUCCESS: ${realTxs.length} records sent`);
        setCloudPushCount(realTxs.length);
      }
    } else {
      addLog('No real transactions to upload');
    }

    // STEP 2: Push lend records
    const rawLend = localStorage.getItem('fingemini_lend');
    const localLend: LendRecord[] = rawLend ? JSON.parse(rawLend) : [];
    if (localLend.length > 0) {
      await syncDataToCloud('lend_records', localLend);
      addLog(`Uploaded ${localLend.length} lend records`);
    }

    // STEP 3: Push profile
    const rawProfile = localStorage.getItem('hisaab_profile');
    if (rawProfile) {
      await syncDataToCloud('profiles', [JSON.parse(rawProfile)]);
    }

    // STEP 4: Now pull everything from cloud
    addLog('Downloading from cloud...');
    await pullDataFromCloud();

    addLog('=== ATOMIC SYNC COMPLETE ===');
  };

  const hardResetAndSync = async () => {
    if (!window.confirm('This will clear local data and re-download from cloud. Continue?')) return;
    localStorage.removeItem('fingemini_txs');
    localStorage.removeItem('fingemini_lend');
    window.location.reload();
  };

  useEffect(() => {
    if (syncWord && isInitialPullDone) {
      localStorage.setItem('fingemini_lend', JSON.stringify(lendRecords));
      if (lendRecords.length > 0) syncDataToCloud('lend_records', lendRecords);
    }
  }, [lendRecords, syncWord]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('hisaab_theme', theme);
  }, [theme]);

  const handleSetSyncWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputWord.trim()) {
      const normalizedWord = inputWord.trim().toLowerCase();
      localStorage.setItem('hisaab_sync_word', normalizedWord);
      setSyncWord(normalizedWord);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const updateProfile = (newProfile: UserProfile) => setProfile(newProfile);
  const addTransaction = (t: Transaction) => setTransactions(prev => [...prev, t]);
  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await deleteRecordFromCloud('transactions', id);
  };

  const addLendRecord = (r: LendRecord) => setLendRecords(prev => [...prev, r]);
  const addLendRecords = (records: LendRecord[]) => setLendRecords(prev => [...prev, ...records]);
  const updateLendRecord = (updatedRecord: LendRecord) => setLendRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
  const deleteLendRecord = async (id: string) => {
    setLendRecords(prev => prev.filter(r => r.id !== id));
    await deleteRecordFromCloud('lend_records', id);
  };
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

  const { t } = useTranslation();

  if (!syncWord) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] size-[400px] bg-primary/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-[-10%] left-[-10%] size-[400px] bg-emerald-500/10 blur-[100px] rounded-full" />
        </div>

        <div className="w-full max-w-sm space-y-8 relative z-10 text-center">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl mb-4">
            <span className="material-icons text-primary text-4xl">sync</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter">{t('setupSync')}</h1>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest leading-relaxed px-4">
              {t('secretWordDesc')}
            </p>
          </div>

          <form onSubmit={handleSetSyncWord} className="space-y-4">
            <input
              type="text"
              placeholder={t('secretWordPlaceholder')}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 px-6 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
            />
            <button type="submit" className="w-full bg-primary py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/25 active:scale-95 transition-all">
              {t('startSynchronizing')}
            </button>
          </form>

          {/* Debug Status */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Cloud URL:</span>
              <span className="text-[8px] font-bold text-emerald-500">{import.meta.env.VITE_SUPABASE_URL ? 'Connected' : 'Missing'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Initial Pull:</span>
              <span className={`text-[8px] font-bold ${isInitialPullDone ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isInitialPullDone ? 'Success' : 'Pending...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sync DNA:</span>
              <span className="text-[8px] font-mono text-amber-400">
                {syncWord ? syncWord.slice(0, 3) + '...' + import.meta.env.VITE_SUPABASE_URL.slice(-4) : 'None'}
              </span>
            </div>
            <div className="flex justify-between items-center px-2 py-0.5 bg-black/20 rounded-lg">
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Downloaded:</span>
              <span className="text-[8px] font-bold text-emerald-400">{cloudPullCount}</span>
            </div>
            <div className="flex justify-between items-center px-2 py-0.5 bg-black/20 rounded-lg">
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Uploaded:</span>
              <span className="text-[8px] font-bold text-blue-400">{cloudPushCount}</span>
            </div>
            {syncError && (
              <div className="pt-1 border-t border-white/5">
                <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest block mb-1">Error Report:</span>
                <p className="text-[8px] font-bold text-rose-500 leading-tight">{syncError}</p>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Local Records:</span>
              <span className="text-[8px] font-bold text-blue-400">{transactions.length}</span>
            </div>

            <button
              onClick={hardResetAndSync}
              className="w-full mt-2 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[7px] font-black text-rose-400 uppercase tracking-widest transition-colors"
            >
              Hard Reset & Sync
            </button>
          </div>

          <div className="pt-4">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">{t('noRegistration')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppContent
      transactions={transactions}
      syncWord={syncWord}
      isSyncing={isSyncing}
      pullDataFromCloud={pullDataFromCloud}
      lastSyncTime={lastSyncTime}
      theme={theme}
      toggleTheme={toggleTheme}
      profile={profile}
      updateProfile={updateProfile}
      notifications={notifications}
      unreadCount={unreadCount}
      markAsRead={markAsRead}
      markAllAsRead={markAllAsRead}
      lendRecords={lendRecords}
      addTransaction={addTransaction}
      deleteTransaction={deleteTransaction}
      addLendRecord={addLendRecord}
      addLendRecords={addLendRecords}
      updateLendRecord={updateLendRecord}
      deleteLendRecord={deleteLendRecord}
      cloudPullCount={cloudPullCount}
      cloudPushCount={cloudPushCount}
      syncError={syncError}
      hardResetAndSync={hardResetAndSync}
      isInitialPullDone={isInitialPullDone}
      triggerFullSync={triggerFullSync}
      sessionLogs={sessionLogs}
    />
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <UpdateNotifier />
      <HisaabApp />
    </LanguageProvider>
  );
};

const AppContent: React.FC<any> = ({ transactions, syncWord, isSyncing, pullDataFromCloud, lastSyncTime, theme, toggleTheme, profile, updateProfile, notifications, unreadCount, markAsRead, markAllAsRead, lendRecords, addTransaction, deleteTransaction, addLendRecord, addLendRecords, updateLendRecord, deleteLendRecord, cloudPullCount, cloudPushCount, syncError, hardResetAndSync, isInitialPullDone, triggerFullSync, sessionLogs }) => {
  return (
    <SyncContext.Provider value={{
      isSyncing,
      triggerManualSync: triggerFullSync,
      lastSyncTime,
      cloudPullCount,
      cloudPushCount,
      syncError,
      syncWord,
      hardResetAndSync,
      isInitialPullDone,
      localRecordCount: transactions.length,
      sessionLogs
    }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <UserContext.Provider value={{ profile, updateProfile }}>
          <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
            <ErrorBoundary>
              <HashRouter>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard transactions={transactions} />} />
                    <Route path="/transactions" element={<Transactions transactions={transactions} onAdd={addTransaction} onDelete={deleteTransaction} />} />
                    <Route path="/analytics" element={<Analytics transactions={transactions} />} />
                    <Route path="/lend" element={<Lend lendRecords={lendRecords} onAdd={addLendRecord} onAddBulk={addLendRecords} onUpdate={updateLendRecord} onDelete={deleteLendRecord} onAddTransaction={addTransaction} />} />
                    <Route path="/menu" element={<Menu />} />
                  </Routes>
                </Layout>
              </HashRouter>
            </ErrorBoundary>
          </NotificationContext.Provider>
        </UserContext.Provider>
      </ThemeContext.Provider>
    </SyncContext.Provider>
  );
};

export default App;
