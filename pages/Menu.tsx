import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useTheme, useNotifications } from '../App';
import { LendRecord } from '../types';

interface MenuProps {
  lendRecords?: LendRecord[];
}

export const Menu: React.FC<MenuProps> = ({ lendRecords = [] }) => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showEdit, setShowEdit] = useState(false);
  const [tempName, setTempName] = useState(profile.name);
  const [tempPhoto, setTempPhoto] = useState(profile.photo);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const syncWord = localStorage.getItem('hisaab_sync_word');

  const handleSaveProfile = () => {
    updateProfile({ ...profile, name: tempName, photo: tempPhoto });
    setShowEdit(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetSync = () => {
    if (window.confirm("Disconnect from cloud sync? This device will stop receiving updates until you enter a word again.")) {
      localStorage.removeItem('hisaab_sync_word');
      window.location.reload();
    }
  };

  // Logical Reminders
  const reminders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return lendRecords.filter(r => {
      if (r.status === 'returned') return false;
      if (!r.dueDate) return false;
      return r.dueDate <= today;
    });
  }, [lendRecords]);

  const menuGroups = [
    {
      title: "Cloud & Syncing",
      items: [
        {
          icon: 'sync',
          label: 'Secret Sync Word',
          sub: syncWord || 'Not Configured',
          action: () => { },
          color: 'text-emerald-500'
        },
        {
          icon: 'cloud_off',
          label: 'Disconnect Cloud',
          sub: 'Stop syncing on this device',
          action: handleResetSync,
          color: 'text-rose-500'
        },
      ]
    },
    {
      title: "Settings & System",
      items: [
        {
          icon: theme === 'dark' ? 'light_mode' : 'dark_mode',
          label: 'Display Mode',
          sub: theme === 'dark' ? 'Current: Dark' : 'Current: Light',
          action: toggleTheme,
          color: 'text-amber-500'
        },
        {
          icon: 'notifications',
          label: 'App Notifications',
          sub: unreadCount > 0 ? `${unreadCount} unread` : 'No new alerts',
          badge: unreadCount > 0,
          action: () => setShowNotifications(!showNotifications),
          color: 'text-primary'
        },
      ]
    }
  ];

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="px-1">
        <h2 className="text-2xl font-black tracking-tighter">System Console</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuration Center</p>
      </header>

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-xl flex items-center gap-5">
        <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden shrink-0">
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
        <div className="flex-1">
          <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{profile.name}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Private Account</p>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-primary transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-xl">edit</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black">Edit Personal Profile</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-8">
              <div className="relative group">
                <div className="size-28 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 overflow-hidden shadow-inner flex items-center justify-center">
                  {tempPhoto ? (
                    <img className="w-full h-full object-cover" src={tempPhoto} alt="Preview" />
                  ) : (
                    <img className="w-full h-full object-cover opacity-50" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.avatarSeed}`} alt="Preview" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 size-10 bg-primary text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">add_a_photo</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="w-full space-y-2 text-center pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Tap the icon to upload logo or picture</p>
              </div>

              <div className="w-full space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Display Name</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white transition-all"
                  placeholder="Your Name"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              className="w-full bg-primary text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/30 active:scale-95 transition-all text-xs uppercase tracking-widest"
            >
              Save Profile Changes
            </button>
          </div>
        </div>
      )}

      {/* Menu Sections */}
      {menuGroups.map((group, idx) => (
        <section key={idx} className="space-y-3">
          <h4 className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{group.title}</h4>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            {group.items.map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-b last:border-0 border-slate-50 dark:border-slate-800 group`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${item.color} group-active:scale-90 transition-transform relative`}>
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    {('badge' in item && item.badge) && (
                      <span className="absolute -top-1 -right-1 size-2.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full animate-bounce"></span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{item.label}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{item.sub}</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-sm group-hover:translate-x-1 transition-transform">arrow_forward_ios</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] pt-10">
        powered by MJK.IT
      </p>
    </div>
  );
};
