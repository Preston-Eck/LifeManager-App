import React, { useEffect, useState } from 'react';
import { initializeBackend } from '../services/storage';

interface SetupWizardProps {
  onComplete: () => void;
}

interface Step {
  id: number;
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, label: 'Connecting to Google Services...', status: 'pending' },
    { id: 2, label: 'Initializing Spreadsheet Database...', status: 'pending' },
    { id: 3, label: 'Configuring Data Sheets...', status: 'pending' },
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runSetup = async () => {
      // Start Step 1
      updateStep(1, 'loading');
      await new Promise(r => setTimeout(r, 800)); // Visual pause
      updateStep(1, 'done');

      // Start Step 2 & 3 (Backend Call)
      updateStep(2, 'loading');
      updateStep(3, 'pending'); // Wait

      try {
        await initializeBackend();
        updateStep(2, 'done');
        updateStep(3, 'done');
        
        setTimeout(onComplete, 1000);
      } catch (e: any) {
        console.error(e);
        updateStep(2, 'error');
        setError("Failed to connect. If on mobile, try opening in Incognito mode.");
      }
    };

    runSetup();
  }, []);

  const updateStep = (id: number, status: Step['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <i className="fas fa-cogs text-sky-600"></i> 
            Setting Up Workspace
        </h2>
        
        <div className="space-y-4">
            {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center">
                        {step.status === 'pending' && <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
                        {step.status === 'loading' && <i className="fas fa-circle-notch fa-spin text-sky-500"></i>}
                        {step.status === 'done' && <i className="fas fa-check-circle text-green-500 text-lg"></i>}
                        {step.status === 'error' && <i className="fas fa-times-circle text-red-500 text-lg"></i>}
                    </div>
                    <span className={`${step.status === 'done' ? 'text-slate-800 font-medium' : 'text-slate-500'} ${step.status === 'loading' ? 'text-sky-600 font-semibold' : ''} ${step.status === 'error' ? 'text-red-600' : ''} text-sm`}>
                        {step.label}
                    </span>
                </div>
            ))}
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                <p className="font-bold mb-1"><i className="fas fa-exclamation-triangle"></i> Connection Error</p>
                {error}
            </div>
        )}

        <div className="mt-8 bg-blue-50 text-blue-800 p-3 rounded text-xs">
            <i className="fas fa-info-circle mr-1"></i> This initializes your Google Sheet for the first time.
        </div>
      </div>
    </div>
  );
};