import React from 'react';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
            <div className="bg-sky-100 p-4 rounded-full">
                <i className="fas fa-mountain text-4xl text-sky-600"></i>
            </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">LifeManager Pro</h1>
        <p className="text-slate-500 mb-8">
            Manage your campground, family, church, and school board responsibilities in one place.
        </p>
        
        <button 
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-lg transition shadow-sm"
        >
            <img 
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                alt="Google" 
                className="w-6 h-6" 
            />
            Sign in with Google
        </button>

        <p className="mt-6 text-xs text-slate-400">
            By signing in, you authorize LifeManager Pro to access your Google Drive, Calendar, and Sheets to store your data.
        </p>
      </div>
    </div>
  );
};