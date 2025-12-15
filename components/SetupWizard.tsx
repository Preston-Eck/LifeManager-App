import React, { useEffect, useState } from 'react';

interface SetupWizardProps {
  onComplete: () => void;
}

interface Step {
  id: number;
  label: string;
  status: 'pending' | 'loading' | 'done';
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, label: 'Connecting to Google Drive...', status: 'pending' },
    { id: 2, label: 'Creating folder "LifeManager Pro Data"...', status: 'pending' },
    { id: 3, label: 'Initializing "Tasks & Events" Spreadsheet...', status: 'pending' },
    { id: 4, label: 'Initializing "Library & Notes" Spreadsheet...', status: 'pending' },
    { id: 5, label: 'Syncing Google Calendar Configuration...', status: 'pending' },
  ]);

  useEffect(() => {
    let currentStepIndex = 0;

    const processStep = () => {
      if (currentStepIndex >= steps.length) {
        setTimeout(onComplete, 800);
        return;
      }

      setSteps(prev => prev.map((step, idx) => {
        if (idx === currentStepIndex) return { ...step, status: 'loading' };
        return step;
      }));

      // Simulate async API call duration (random between 800ms and 1500ms)
      const duration = Math.random() * 700 + 800;

      setTimeout(() => {
        setSteps(prev => prev.map((step, idx) => {
          if (idx === currentStepIndex) return { ...step, status: 'done' };
          return step;
        }));
        currentStepIndex++;
        processStep();
      }, duration);
    };

    processStep();
  }, []); // Run once on mount

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
                    </div>
                    <span className={`${step.status === 'done' ? 'text-slate-800 font-medium' : 'text-slate-500'} ${step.status === 'loading' ? 'text-sky-600 font-semibold' : ''} text-sm`}>
                        {step.label}
                    </span>
                </div>
            ))}
        </div>

        <div className="mt-8 bg-blue-50 text-blue-800 p-3 rounded text-xs">
            <i className="fas fa-info-circle mr-1"></i> This only happens the first time you log in.
        </div>
      </div>
    </div>
  );
};