import React, { useState } from 'react';

interface LoginProps {
  onLogin: (name: string) => void;
  userEmail?: string;
}

export const Login: React.FC<LoginProps> = ({ onLogin, userEmail }) => {
  const [name, setName] = useState('');

  return (
    <div className="h-screen flex items-center justify-center bg-slate-100 p-4 overflow-y-auto">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center my-8">
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

        <div className="mt-8 text-left bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h4 className="font-bold text-yellow-800 text-xs uppercase mb-2">First Time Setup?</h4>
            <p className="text-xs text-yellow-800 mb-2">
                If you see a screen saying <strong>"This app isn't verified"</strong>:
            </p>
            <ol className="list-decimal list-inside text-xs text-yellow-800 space-y-1 ml-1">
                <li>Click <strong>Advanced</strong> (bottom left).</li>
                <li>Click <strong>Go to LifeManager Pro (unsafe)</strong>.</li>
                <li>Click <strong>Allow</strong> to grant permissions.</li>
            </ol>
            <p className="text-[10px] text-yellow-600 mt-2 italic">
                (This appears because this is a private app you created, not published to the store).
            </p>
        </div>
      </div>
    </div>
  );
};