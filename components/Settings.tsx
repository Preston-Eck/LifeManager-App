
import React, { useState } from 'react';
import { GoogleCalendar, ThemePreferences } from '../types';

interface SettingsProps {
  calendars: GoogleCalendar[];
  setCalendars: React.Dispatch<React.SetStateAction<GoogleCalendar[]>>;
  theme: ThemePreferences;
  setTheme: (theme: ThemePreferences) => void;
  userEmail?: string;
}

export const Settings: React.FC<SettingsProps> = ({ calendars, setCalendars, theme, setTheme, userEmail }) => {
  const [newAccountEmail, setNewAccountEmail] = useState('');

  // Group calendars by account
  const accounts = Array.from(new Set(calendars.map(c => c.accountId)));
  const hasApiKey = !!(window as any).GEMINI_API_KEY;

  const handleAddAccount = () => {
    if (!newAccountEmail) return;
    const newCals: GoogleCalendar[] = [
        { id: Math.random().toString(), name: 'Primary', color: '#4285F4', accountId: newAccountEmail },
        { id: Math.random().toString(), name: 'Birthdays', color: '#A79B8E', accountId: newAccountEmail }
    ];
    setCalendars([...calendars, ...newCals]);
    setNewAccountEmail('');
    alert(`Connected Google Account: ${newAccountEmail}`);
  };

  const handleResetData = () => {
      if (confirm('Are you sure? This will delete all your local tasks, notes, and books and reset to default.')) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const colors = [
    { name: 'Sky', value: 'sky', hex: '#0ea5e9' },
    { name: 'Blue', value: 'blue', hex: '#3b82f6' },
    { name: 'Indigo', value: 'indigo', hex: '#6366f1' },
    { name: 'Purple', value: 'purple', hex: '#a855f7' },
    { name: 'Emerald', value: 'emerald', hex: '#10b981' },
    { name: 'Rose', value: 'rose', hex: '#f43f5e' },
    { name: 'Slate', value: 'slate', hex: '#64748b' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto overflow-y-auto no-scrollbar pb-24 h-full">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
      
      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-server text-emerald-500"></i> System Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded border border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-500 uppercase">Current Account</span>
                      <span className="text-sm font-medium text-slate-800">{userEmail || 'Unknown'}</span>
                  </div>
                  <i className="fab fa-google text-slate-400 text-lg"></i>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-500 uppercase">AI Features</span>
                      <span className={`text-sm font-medium ${hasApiKey ? 'text-emerald-600' : 'text-red-500'}`}>
                          {hasApiKey ? 'Connected (API Key Detected)' : 'Disconnected (Missing API Key)'}
                      </span>
                  </div>
                  <i className={`fas ${hasApiKey ? 'fa-check-circle text-emerald-500' : 'fa-times-circle text-red-500'} text-lg`}></i>
              </div>
          </div>
          {!hasApiKey && (
              <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded">
                  <i className="fas fa-info-circle mr-1"></i> Add <strong>API_KEY</strong> to Script Properties in GAS Editor.
              </div>
          )}
      </div>

      {/* Appearance Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fas fa-paint-brush text-purple-500"></i> Appearance
        </h2>
        
        <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">Accent Color</label>
            <div className="flex flex-wrap gap-3">
                {colors.map((c) => (
                    <button
                        key={c.value}
                        onClick={() => setTheme({...theme, accentColor: c.value as any})}
                        className={`w-10 h-10 rounded-full shadow-sm transition-transform hover:scale-110 flex items-center justify-center ${theme.accentColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                    >
                        {theme.accentColor === c.value && <i className="fas fa-check text-white"></i>}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Text Size</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['small', 'normal', 'large'].map((size) => (
                        <button
                            key={size}
                            onClick={() => setTheme({...theme, fontSize: size as any})}
                            className={`flex-1 py-2 rounded-md text-sm font-medium capitalize transition ${theme.fontSize === size ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Background Color</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setTheme({...theme, bgColor: '#f8fafc'})} // slate-50
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition ${theme.bgColor === '#f8fafc' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                    >
                        Light
                    </button>
                    <button
                        onClick={() => setTheme({...theme, bgColor: '#f0f9ff'})} // sky-50
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition ${theme.bgColor === '#f0f9ff' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                    >
                        Cool
                    </button>
                     <button
                        onClick={() => setTheme({...theme, bgColor: '#fffbeb'})} // amber-50
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition ${theme.bgColor === '#fffbeb' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                    >
                        Warm
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fab fa-google text-red-500"></i> Google Calendar Sync
        </h2>
        
        <div className="space-y-6">
            {accounts.map(account => (
                <div key={account} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="font-semibold text-slate-700">{account}</div>
                        <button className="text-red-500 text-sm hover:underline">Disconnect</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {calendars.filter(c => c.accountId === account).map(cal => (
                            <div key={cal.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }}></div>
                                <span className="text-sm text-slate-700">{cal.name}</span>
                                <div className="ml-auto">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked className="sr-only peer" readOnly />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-2">Connect New Account</label>
            <div className="flex gap-2">
                <input 
                    type="email" 
                    placeholder="Enter Google Email" 
                    className="flex-1 border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-900"
                    value={newAccountEmail}
                    onChange={(e) => setNewAccountEmail(e.target.value)}
                />
                <button 
                    onClick={handleAddAccount}
                    className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 transition flex items-center gap-2"
                >
                    <i className="fab fa-google"></i> Connect
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fas fa-database text-sky-500"></i> Data & Backup
        </h2>
        <div className="flex flex-col gap-4">
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                 <div>
                     <div className="font-semibold text-slate-700">Drive Backup</div>
                     <div className="text-xs text-slate-500">Last synced: Just now</div>
                 </div>
                 <button className="text-sky-600 font-medium text-sm">Sync Now</button>
             </div>
             <div className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-100">
                 <div>
                     <div className="font-semibold text-red-700">Danger Zone</div>
                     <div className="text-xs text-red-500">Clear all local data and reset app</div>
                 </div>
                 <button onClick={handleResetData} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Reset Data</button>
             </div>
        </div>
      </div>
    </div>
  );
};
