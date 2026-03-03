import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface LoginProps {
    onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [authMode, setAuthMode] = useState<'password' | 'code'>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePasswordAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                if (data.session) onLogin();
                else alert('Account requested! If Confirm Email is OFF, you should be logged in. Otherwise, check your inbox.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onLogin();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOtp({ email });
            if (error) throw error;
            setShowOtpInput(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
            if (error) throw error;
            onLogin();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-white">
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] right-[-10%] size-[500px] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-20%] left-[-10%] size-[500px] bg-emerald-500/10 blur-[150px] rounded-full" />
            </div>

            <div className="w-full max-w-md space-y-8 relative z-10 animate-fadeIn">
                <div className="text-center space-y-2">
                    <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-white/5 border border-white/10 shadow-2xl mb-4">
                        <span className="material-symbols-outlined text-primary text-4xl">account_balance_wallet</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter">Hisaab AI</h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Vault Access</p>
                </div>

                <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-2xl space-y-8">
                    {/* Mode Selector */}
                    <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5">
                        <button onClick={() => setAuthMode('password')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'password' ? 'bg-primary text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Password</button>
                        <button onClick={() => setAuthMode('code')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'code' ? 'bg-primary text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Magic Code</button>
                    </div>

                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black flex items-center gap-3">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {error}
                        </div>
                    )}

                    {authMode === 'password' ? (
                        <form onSubmit={handlePasswordAuth} className="space-y-5">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Email Address</label>
                                    <input type="email" required placeholder="name@example.com" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 px-6 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Master Password</label>
                                    <input type="password" required placeholder="••••••••" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 px-6 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={password} onChange={(e) => setPassword(e.target.value)} />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-[11px] tracking-widest">
                                {loading ? <div className="size-4 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : isSignUp ? 'Create Wallet' : 'Unlock Wallet'}
                            </button>
                            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                                {isSignUp ? 'Back to Sign In' : 'Need a new account? Sign Up'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            {!showOtpInput ? (
                                <form onSubmit={handleSendCode} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Email Address</label>
                                        <input type="email" required placeholder="name@example.com" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 px-6 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={email} onChange={(e) => setEmail(e.target.value)} />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-[11px] tracking-widest">
                                        {loading ? <div className="size-4 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : 'Request Code'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyCode} className="space-y-6 animate-fadeIn">
                                    <div className="space-y-2 text-center text-emerald-500">
                                        <h3 className="text-lg font-black tracking-tighter">Code Sent!</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Check {email}</p>
                                    </div>
                                    <input type="text" required placeholder="000000" maxLength={6} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-5 text-center text-4xl font-black tracking-[0.4em] text-emerald-500 outline-none focus:ring-2 focus:ring-emerald-500/20" value={token} onChange={(e) => setToken(e.target.value)} />
                                    <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-95 transition-all uppercase text-[11px] tracking-widest">
                                        {loading ? <div className="size-4 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : 'Enter Wallet'}
                                    </button>
                                    <button type="button" onClick={() => setShowOtpInput(false)} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Change Email</button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
