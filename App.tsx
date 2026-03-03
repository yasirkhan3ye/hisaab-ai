
import React, { useState, useEffect, ErrorInfo, ReactNode, createContext, useContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Analytics } from './pages/Analytics';
import { Lend } from './pages/Lend';
import { Menu } from './pages/Menu';
import { Transaction, LendRecord, UserProfile, Notification } from './types';
import { fetchDataFromCloud, deleteRecordFromCloud } from './services/supabaseClient';

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

class ErrorBoundary extends React.Component<any, any> {
  public state = { hasError: false };
  public static getDerivedStateFromError(_: Error) { return { hasError: true }; }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-[#020617] text-white">
          <span className="material-symbols-outlined text-rose-500 text-6xl mb-4">error</span>
          <h2 className="text-xl font-black mb-2">Something went wrong</h2>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/30">Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const initialProfile: UserProfile = { name: 'Yasir khan', avatarSeed: 'Aneka' };

const App: React.FC = () => {
  const [syncWord, setSyncWord] = useState<string | null>(localStorage.getItem('hisaab_sync_word'));
  const [inputWord, setInputWord] = useState('');
  const [loading, setLoading] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('hisaab_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('hisaab_profile');
    return saved ? JSON.parse(saved) : initialProfile;
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lendRecords, setLendRecords] = useState<LendRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Initial Data Load
  useEffect(() => {
    if (syncWord) {
      const loadData = async () => {
        setLoading(true);
        const cloudTxs = await fetchDataFromCloud('transactions');
        const cloudLend = await fetchDataFromCloud('lend_records');
        const cloudProfile = await fetchDataFromCloud('profiles');

        if (cloudTxs) setTransactions(cloudTxs);
        if (cloudLend) setLendRecords(cloudLend);
        if (cloudProfile && cloudProfile[0]) setProfile(cloudProfile[0]);
        setLoading(false);
      };
      loadData();
    }
  }, [syncWord]);

  // Syncing to Cloud
  useEffect(() => {
    if (syncWord) {
      localStorage.setItem('hisaab_profile', JSON.stringify(profile));
      import('./services/supabaseClient').then(m => m.syncDataToCloud('profiles', [profile]));
    }
  }, [profile, syncWord]);

  useEffect(() => {
    if (syncWord) {
      localStorage.setItem('fingemini_txs', JSON.stringify(transactions));
      import('./services/supabaseClient').then(m => m.syncDataToCloud('transactions', transactions));
    }
  }, [transactions, syncWord]);

  useEffect(() => {
    if (syncWord) {
      localStorage.setItem('fingemini_lend', JSON.stringify(lendRecords));
      import('./services/supabaseClient').then(m => m.syncDataToCloud('lend_records', lendRecords));
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
      localStorage.setItem('hisaab_sync_word', inputWord.trim());
      setSyncWord(inputWord.trim());
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

  if (!syncWord) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] size-[400px] bg-primary/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-[-10%] left-[-10%] size-[400px] bg-emerald-500/10 blur-[100px] rounded-full" />
        </div>

        <div className="w-full max-w-sm space-y-8 relative z-10 text-center">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl mb-4">
            <span className="material-symbols-outlined text-primary text-4xl">sync</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter">Setup Sync</h1>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest leading-relaxed px-4">
              Enter your secret word to synchronize your data across all your devices.
            </p>
          </div>

          <form onSubmit={handleSetSyncWord} className="space-y-4">
            <input
              type="text"
              placeholder="Enter Secret Word"
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-5 px-6 text-center text-lg font-black tracking-widest outline-none focus:ring-2 focus:ring-primary/40 text-white placeholder:text-slate-700"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
            />
            <button type="submit" className="w-full bg-primary py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/25 active:scale-95 transition-all">
              Start Synchronizing
            </button>
          </form>

          <div className="pt-4">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">No Registration Required</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-white p-8">
        <div className="size-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Fetching Cloud Data...</p>
      </div>
    );
  }

  return (
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
                  <Route path="/lend" element={<Lend lendRecords={lendRecords} onAdd={addLendRecord} onAddBulk={addLendRecords} onUpdate={updateLendRecord} onDelete={deleteLendRecord} />} />
                  <Route path="/menu" element={<Menu lendRecords={lendRecords} />} />
                </Routes>
              </Layout>
            </HashRouter>
          </ErrorBoundary>
        </NotificationContext.Provider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
};

export default App;
