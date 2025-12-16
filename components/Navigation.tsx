import React from 'react';
import { View } from '../types';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
  accentColor?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, accentColor = 'sky' }) => {
  const navItems: { id: View; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Home', icon: 'fa-home' },
    { id: 'braindump', label: 'Brain Dump', icon: 'fa-brain' },
    { id: 'week', label: 'Week', icon: 'fa-calendar-week' }, 
    { id: 'people', label: 'People', icon: 'fa-users' },
    { id: 'library', label: 'Library', icon: 'fa-book' },
    { id: 'meeting-notes', label: 'Notes', icon: 'fa-sticky-note' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  return (
    <nav className="bg-slate-900 text-white shadow-lg z-50 flex-shrink-0">
      {/* Desktop/Tablet Horizontal Nav */}
      <div className="hidden md:flex justify-between items-center px-6 py-4">
        <div className={`text-xl font-bold tracking-tight text-${accentColor}-400`}>
          <i className="fas fa-mountain mr-2"></i>
          LifeManager
        </div>
        <div className="flex space-x-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                currentView === item.id
                  ? `bg-${accentColor}-600 text-white`
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon}`}></i>
              <span>{item.label === 'Week' ? 'Week View' : item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 pb-safe z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full p-1 active:bg-slate-800 transition-colors ${
                currentView === item.id ? `text-${accentColor}-400` : 'text-slate-400'
              }`}
            >
              <i className={`fas ${item.icon} text-lg mb-1`}></i>
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};