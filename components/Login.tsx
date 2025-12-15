import React, { useState } from 'react';

interface LoginProps {
  onLogin: (name: string) => void;
  userEmail?: string;
}

export const Login: React.FC<LoginProps> = ({ onLogin, userEmail }) => {
  const [name, setName] = useState('');

  return (
    <div className="h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
            <div className="bg-sky-100 p-4 rounded-full">
                <i className="fas fa-mountain text-4xl text-sky-600"></i>
            </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome</h1>
        <p className="text-slate-500 mb-8">
            LifeManager Pro uses your Google Account to store data securely.
        </p>

        {userEmail && (
            <div className="mb-6 p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-600">
                Logged in as: <span className="font-bold">{userEmail}</span>
            </div>
        )}
        
        <div className="text-left mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Display Name</label>
            <input 
                type="text" 
                className="w-full border border-slate-300 p-3 rounded outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-900"
                placeholder="e.g. Dad, Manager"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
        </div>

        <button 
            onClick={() => name && onLogin(name)}
            disabled={!name}
            className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
            Get Started
        </button>

        <p className="mt-6 text-xs text-slate-400">
            Clicking "Get Started" will create a spreadsheet in your Google Drive.
        </p>
      </div>
    </div>
  );
};