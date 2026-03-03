
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTheme, useUser, useNotifications } from '../App';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { profile } = useUser();

  return (
    <div className="flex flex-col min-h-screen transition-colors duration-300">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 no-print">
        <div
          onClick={() => navigate('/menu')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden group-hover:scale-105 transition-transform">
            {profile.photo ? (
              <img className="w-full h-full object-cover" src={profile.photo} alt="User" />
            ) : (
              <img
                className="w-full h-full object-cover"
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.avatarSeed}`}
                alt="User"
              />
            )}
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none">Hisaab AI</p>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors mt-0.5">{profile.name}</h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-28">
        <div className="max-w-md mx-auto px-4 pt-6">
          {children}
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-slate-900/95 backdrop-blur-3xl border-t border-white/5 px-4 pt-3 pb-12 no-print shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto flex items-center justify-between h-16">
          <NavLink to="/" className={({ isActive }) => `flex-1 flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className="material-symbols-outlined font-black text-[22px]">home</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `flex-1 flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className="material-symbols-outlined font-black text-[22px]">account_balance_wallet</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Ledger</span>
          </NavLink>

          <div className="relative -mt-16 px-4">
            <NavLink to="/analytics" className="size-16 rounded-[2rem] bg-gradient-to-br from-primary to-primary-dark text-white shadow-2xl shadow-primary/40 flex items-center justify-center border-4 border-slate-900 active:scale-90 transition-all">
              <span className="material-symbols-outlined text-3xl font-black">auto_awesome</span>
            </NavLink>
          </div>

          <NavLink to="/lend" className={({ isActive }) => `flex-1 flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className="material-symbols-outlined font-black text-[22px]">payments</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Receiv</span>
          </NavLink>
          <NavLink to="/menu" className={({ isActive }) => `flex-1 flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className="material-symbols-outlined font-black text-[22px]">grid_view</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Menu</span>
          </NavLink>
        </div>
      </nav>
    </div >
  );
};
