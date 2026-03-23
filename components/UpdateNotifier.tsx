import React, { useState, useEffect } from 'react';
import { checkForUpdates, UpdateInfo } from '../services/updateService';
import { useTranslation } from '../services/LanguageContext';

const APP_VERSION = '1.2.0'; // Manually sync with package.json version

export const UpdateNotifier: React.FC = () => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Session-based dismissal: Don't show again if dismissed in this session
    const isDismissed = sessionStorage.getItem('hisaab_update_dismissed');
    if (isDismissed) return;

    const runCheck = async () => {
      const info = await checkForUpdates(APP_VERSION);
      if (info.isAvailable) {
        setUpdate(info);
        setIsVisible(true);
      }
    };

    // Check on mount with a small delay for smoother UX
    const timer = setTimeout(runCheck, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('hisaab_update_dismissed', 'true');
  };

  const handleUpdate = () => {
    if (update?.updateUrl) {
      window.open(update.updateUrl, '_blank');
    }
  };

  if (!isVisible || !update) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] w-[90%] max-w-sm animate-slideDown">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-primary/20 rounded-3xl p-5 shadow-2xl flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-2xl animate-bounce">downloading</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">{t('updateReady')}</p>
          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
            {t('updateAvailable').replace('%s', update.latestVersion)}
          </h4>
          <div className="flex gap-3 mt-3">
            <button 
              onClick={handleUpdate}
              className="px-4 py-2 bg-primary text-white text-[9px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {t('updateNow')}
            </button>
            <button 
              onClick={handleDismiss}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-wider rounded-xl active:scale-95 transition-all"
            >
              {t('later')}
            </button>
          </div>
        </div>
        
        <button onClick={handleDismiss} className="text-slate-300 hover:text-slate-500 flex-shrink-0 translate-y-[-10px]">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  );
};
