import React, { useState, useEffect } from 'react';
import { View, Task, Event, Book, MeetingNote, GoogleCalendar, User } from './types';
import { Navigation } from './components/Navigation';
import { BrainDump } from './components/BrainDump';
import { WeekView } from './components/WeekView';
import { Library } from './components/Library';
import { MeetingNotes } from './components/MeetingNotes';
import { Settings } from './components/Settings';
import { DetailSidebar } from './components/DetailSidebar';
import { Login } from './components/Login';
import { SetupWizard } from './components/SetupWizard';
import { loadAllData, saveData } from './services/storage';

const App: React.FC = () => {
  // Authentication & Loading State
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // App Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);

  // Navigation & View State
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [viewFilter, setViewFilter] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<Task | Event | null>(null);
  const [focusNoteId, setFocusNoteId] = useState<string | undefined>(undefined);

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      try {
        const data = await loadAllData();
        setTasks(data.tasks);
        setEvents(data.events);
        setBooks(data.books);
        setNotes(data.notes);
        setCalendars(data.calendars);
        
        if (data.user) {
          setUser(data.user);
          setIsSetupComplete(true);
        }
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Persistence Wrappers
  // We explicitly wrap the set functions to ensure we save to the backend immediately
  const updateTasks = (newTasks: React.SetStateAction<Task[]>) => {
    setTasks(prev => {
        const updated = typeof newTasks === 'function' ? newTasks(prev) : newTasks;
        saveData('tasks', updated);
        return updated;
    });
  };

  const updateEvents = (newEvents: React.SetStateAction<Event[]>) => {
    setEvents(prev => {
        const updated = typeof newEvents === 'function' ? newEvents(prev) : newEvents;
        saveData('events', updated);
        return updated;
    });
  };

  const updateBooks = (newBooks: React.SetStateAction<Book[]>) => {
    setBooks(prev => {
        const updated = typeof newBooks === 'function' ? newBooks(prev) : newBooks;
        saveData('books', updated);
        return updated;
    });
  };

  const updateNotes = (newNotes: React.SetStateAction<MeetingNote[]>) => {
    setNotes(prev => {
        const updated = typeof newNotes === 'function' ? newNotes(prev) : newNotes;
        saveData('notes', updated);
        return updated;
    });
  };

  const updateCalendars = (newCalendars: React.SetStateAction<GoogleCalendar[]>) => {
    setCalendars(prev => {
        const updated = typeof newCalendars === 'function' ? newCalendars(prev) : newCalendars;
        saveData('calendars', updated);
        return updated;
    });
  };

  // Auth Handlers
  const handleLogin = () => {
      const mockUser: User = {
          id: '12345',
          name: 'Manager',
          email: 'manager@campground.com',
          avatarUrl: 'https://ui-avatars.com/api/?name=Manager&background=0D8ABC&color=fff'
      };
      setUser(mockUser);
      saveData('user', mockUser);
      setIsSetupComplete(true);
  };

  const handleLogout = () => {
      setUser(null);
      setIsSetupComplete(false);
      localStorage.removeItem('lifeManagerUser'); // Force local clear
      // In a real GAS app, we might handle this differently, but for now we just clear local state
  };

  // --- Main App Logic ---

  const handleNavigation = (view: View) => {
    setCurrentView(view);
    setViewFilter(null);
    if (view !== 'meeting-notes') setFocusNoteId(undefined);
  };

  const handleSaveItem = (updatedItem: Task | Event) => {
    if ('status' in updatedItem) {
        updateTasks(prev => prev.map(t => t.id === updatedItem.id ? updatedItem as Task : t));
    } else {
        updateEvents(prev => prev.map(e => e.id === updatedItem.id ? updatedItem as Event : e));
    }
  };

  const handleCreateNoteFromEvent = (event: Event) => {
      const newNote: MeetingNote = {
          id: Math.random().toString(),
          title: `Notes: ${event.title}`,
          date: new Date().toISOString(),
          content: `<div><strong>Meeting with:</strong> ${event.attendees?.join(', ') || 'N/A'}</div><div><strong>Location:</strong> ${event.where || 'N/A'}</div><br/><div>Start typing minutes...</div>`,
          linkedEventIds: [event.id],
          linkedTaskIds: []
      };

      updateNotes(prev => [newNote, ...prev]);
      setFocusNoteId(newNote.id);
      setCurrentView('meeting-notes');
      setSelectedItem(null);
  };

  // Dashboard Overview Component
  const Dashboard = () => {
    const pendingTasks = tasks.filter(t => t.status !== 'Done').length;
    const urgentTasks = tasks.filter(t => t.urgency === 'Critical' || t.urgency === 'High').length;
    const today = new Date().toLocaleDateString();

    return (
      <div className="p-6 max-w-4xl mx-auto overflow-y-auto no-scrollbar pb-24">
        <div className="mb-8 flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Good Morning, {user?.name}</h1>
                <p className="text-slate-500">{today}</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-500">Sign Out</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div 
                onClick={() => { setViewFilter('todo'); setCurrentView('braindump'); }}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200 cursor-pointer transform hover:scale-105 transition-transform"
            >
                <div className="text-4xl font-bold mb-1">{pendingTasks}</div>
                <div className="text-blue-100 text-sm font-medium uppercase tracking-wider flex justify-between items-center">
                    Pending Tasks <i className="fas fa-arrow-right opacity-50"></i>
                </div>
            </div>
            <div 
                onClick={() => { setViewFilter('urgent'); setCurrentView('braindump'); }}
                className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg shadow-orange-200 cursor-pointer transform hover:scale-105 transition-transform"
            >
                <div className="text-4xl font-bold mb-1">{urgentTasks}</div>
                <div className="text-orange-100 text-sm font-medium uppercase tracking-wider flex justify-between items-center">
                    Urgent / Critical <i className="fas fa-arrow-right opacity-50"></i>
                </div>
            </div>
            <div 
                onClick={() => { setViewFilter('reading'); setCurrentView('library'); }}
                className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg shadow-purple-200 cursor-pointer transform hover:scale-105 transition-transform"
            >
                <div className="text-4xl font-bold mb-1">{books.filter(b => b.status === 'Reading').length}</div>
                <div className="text-purple-100 text-sm font-medium uppercase tracking-wider flex justify-between items-center">
                    Books in Progress <i className="fas fa-arrow-right opacity-50"></i>
                </div>
            </div>
        </div>

        <h3 className="font-bold text-xl text-slate-700 mb-4">Upcoming Events</h3>
        <div className="space-y-3 mb-8">
            {events.map(ev => (
                <div 
                    key={ev.id} 
                    onClick={() => setSelectedItem(ev)}
                    className="bg-white p-4 rounded-lg border-l-4 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ borderLeftColor: calendars.find(c => c.id === ev.calendarId)?.color || '#3b82f6' }}
                >
                    <div>
                        <div className="font-bold text-slate-800">{ev.title}</div>
                        <div className="text-sm text-slate-500">
                             <i className="fas fa-clock mr-1"></i> {new Date(ev.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {ev.where}
                             {ev.calendarId && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                    {calendars.find(c => c.id === ev.calendarId)?.name}
                                </span>
                             )}
                        </div>
                    </div>
                    <i className="fas fa-chevron-right text-slate-300"></i>
                </div>
            ))}
            {events.length === 0 && <p className="text-slate-400 italic">No upcoming events.</p>}
        </div>

        <h3 className="font-bold text-xl text-slate-700 mb-4">Urgent Tasks</h3>
        <div className="space-y-3">
             {tasks.filter(t => t.urgency === 'Critical' || t.urgency === 'High').slice(0, 5).map(task => (
                 <div 
                    key={task.id} 
                    onClick={() => setSelectedItem(task)}
                    className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                 >
                     <div>
                         <div className="font-semibold text-slate-800">{task.shortDescription}</div>
                         <div className="text-xs text-slate-500">{task.forWho} • {task.where || 'No location'}</div>
                     </div>
                     <span className={`text-xs px-2 py-1 rounded font-bold ${task.urgency === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                         {task.urgency}
                     </span>
                 </div>
             ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
        <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400">
            <i className="fas fa-circle-notch fa-spin text-4xl"></i>
        </div>
    );
  }

  if (!user) {
      return <Login onLogin={handleLogin} />;
  }

  if (!isSetupComplete) {
      return <SetupWizard onComplete={() => setIsSetupComplete(true)} />;
  }

  return (
    <div className="flex flex-col h-screen">
        <Navigation currentView={currentView} setView={handleNavigation} />
        
        <main className="flex-1 bg-slate-50 overflow-hidden relative">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'braindump' && <BrainDump tasks={tasks} setTasks={updateTasks} initialFilter={viewFilter || 'all'} onTaskClick={setSelectedItem} />}
            {currentView === 'week' && <WeekView tasks={tasks} setTasks={updateTasks} onEditTask={setSelectedItem} />}
            {currentView === 'library' && <Library books={books} setBooks={updateBooks} initialFilter={viewFilter || 'all'} />}
            {currentView === 'meeting-notes' && <MeetingNotes notes={notes} setNotes={updateNotes} tasks={tasks} setTasks={updateTasks} initialNoteId={focusNoteId} onEditTask={(task) => setSelectedItem(task)} />}
            {currentView === 'settings' && <Settings calendars={calendars} setCalendars={updateCalendars} />}
        </main>

        <DetailSidebar 
            isOpen={!!selectedItem} 
            item={selectedItem} 
            calendars={calendars}
            onClose={() => setSelectedItem(null)} 
            onSave={handleSaveItem}
            onCreateNote={handleCreateNoteFromEvent} 
        />
    </div>
  );
};

export default App;