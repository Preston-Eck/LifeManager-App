import React, { useState } from 'react';
import { GoogleCalendar } from '../types';

interface SettingsProps {
  calendars: GoogleCalendar[];
  setCalendars: React.Dispatch<React.SetStateAction<GoogleCalendar[]>>;
}

export const Settings: React.FC<SettingsProps> = ({ calendars, setCalendars }) => {
  const [newAccountEmail, setNewAccountEmail] = useState('');

  // Group calendars by account
  const accounts = Array.from(new Set(calendars.map(c => c.accountId)));

  const handleAddAccount = () => {
    if (!newAccountEmail) return;
    // Simulate adding an account and fetching its calendars
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

  return (
    <div className="p-6 max-w-4xl mx-auto overflow-y-auto no-scrollbar pb-24 h-full">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
      <p className="text-slate-500 mb-8">Manage your Google Accounts and Integrations</p>

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
            <p className="text-xs text-slate-500 mt-2">
                This will redirect you to Google Login to authorize Calendar access.
            </p>
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
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                 <div>
                     <div className="font-semibold text-slate-700">Export Data</div>
                     <div className="text-xs text-slate-500">Download a JSON copy of all tasks and notes</div>
                 </div>
                 <button className="text-slate-600 font-medium text-sm">Download</button>
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