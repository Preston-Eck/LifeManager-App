
import React, { useState, useEffect, useRef } from 'react';
import { View, Task, Event, Book, MeetingNote, GoogleCalendar, User, ThemePreferences, Person, TaskStatus } from '../types';
import { Navigation } from './components/Navigation';
import { BrainDump } from './components/BrainDump';
import { WeekView } from './components/WeekView';
import { Library } from './components/Library';
import { MeetingNotes } from './components/MeetingNotes';
import { People } from './components/People';
import { Settings } from './components/Settings';
import { DetailSidebar } from './components/DetailSidebar';
import { Login } from './components/Login';
import { SetupWizard } from './components/SetupWizard';
import { loadAllData, saveData, syncTaskToCalendar, fetchExternalEvents } from './services/storage';
import { MOCK_PEOPLE } from './constants';

const App: React.FC = () => {
  // Authentication & Loading State
  const [user, setUser] = useState<User | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // App Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);

  // Track if initial load is done to prevent overwriting with empty state
  const isLoadedRef = useRef(false);

  // Theme State
  const [theme, setTheme] = useState<ThemePreferences>({
    fontSize: 'normal',
    accentColor: 'sky',
    bgColor: '#f8fafc' // slate-50
  });

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
        
        // --- ENV Injection for GAS ---
        if (data.env && data.env.API_KEY) {
            // Polyfill for client-side API Key usage
            (window as any).GEMINI_API_KEY = data.env.API_KEY;
        }

        // Batch updates
        setTasks(data.tasks);
        setBooks(data.books);
        setNotes(data.notes);
        setPeople(data.people);
        
        // Use system calendars if available (fresh fetch), otherwise fallback to stored
        if (data.systemCalendars && data.systemCalendars.length > 0) {
            setCalendars(data.systemCalendars);
        } else {
            setCalendars(data.calendars);
        }
        
        if (data.userEmail) {
            setCurrentUserEmail(data.userEmail);
        }

        if (data.user) {
          setUser(data.user);
          if (data.user.theme) {
            setTheme(data.user.theme);
          }
          setIsSetupComplete(true);
        }

        // Fetch External Google Events (Last 30 days + Next 60 days)
        const calIds = (data.systemCalendars || data.calendars).map(c => c.id);
        if (calIds.length > 0) {
            const start = new Date(); start.setDate(start.getDate() - 30);
            const end = new Date(); end.setDate(end.getDate() + 60);
            try {
                const externalEvents = await fetchExternalEvents(calIds, start.toISOString(), end.toISOString());
                setEvents([...data.events, ...externalEvents]);
            } catch (err) {
                console.warn("Failed to fetch external events", err);
                setEvents(data.events); // Fallback
            }
        } else {
            setEvents(data.events);
        }

      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsLoading(false);
        setTimeout(() => { isLoadedRef.current = true; }, 500);
      }
    };
    init();
  }, []);

  // Persistence Effects (Auto-Save)
  useEffect(() => { if (isLoadedRef.current) saveData('tasks', tasks); }, [tasks]);
  useEffect(() => { 
      if (isLoadedRef.current) {
          const localEvents = events.filter(e => !e.googleEventId);
          saveData('events', localEvents); 
      }
  }, [events]);
  useEffect(() => { if (isLoadedRef.current) saveData('books', books); }, [books]);
  useEffect(() => { if (isLoadedRef.current) saveData('notes', notes); }, [notes]);
  useEffect(() => { if (isLoadedRef.current) saveData('people', people); }, [people]);
  useEffect(() => { if (isLoadedRef.current) saveData('calendars', calendars); }, [calendars]);
  
  const updateTheme = (newTheme: ThemePreferences) => {
    setTheme(newTheme);
    if (user) {
        const updatedUser = { ...user, theme: newTheme };
        setUser(updatedUser);
        saveData('user', updatedUser);
    }
  };

  // Auth Handlers
  const handleCreateProfile = (name: string) => {
      const newUser: User = {
          id: Math.random().toString(),
          name: name,
          email: currentUserEmail || 'user@example.com',
          avatarUrl: `https://ui-avatars.com/api/?name=${name}&background=0D8ABC&color=fff`,
          theme: theme
      };
      setUser(newUser);
      saveData('user', newUser);
  };

  const handleLogout = () => {
      setUser(null);
      setIsSetupComplete(false);
      isLoadedRef.current = false;
      localStorage.removeItem('lifeManagerUser'); 
  };

  // --- Main App Logic ---

  const handleNavigation = (view: View) => {
    setCurrentView(view);
    setViewFilter(null);
    if (view !== 'meeting-notes') setFocusNoteId(undefined);
  };

  const handleSaveItem = async (updatedItem: Task | Event) => {
    if ('status' in updatedItem) {
        let finalTask = updatedItem as Task;
        
        // Sync to Google Calendar
        if (finalTask.calendarId && finalTask.when) {
            try {
                const gEventId = await syncTaskToCalendar(finalTask);
                finalTask = { ...finalTask, googleEventId: gEventId };
            } catch (error) {
                console.error("Failed to sync to Google Calendar", error);
                alert("Task saved locally, but failed to sync to Google Calendar.");
            }
        }

        setTasks(prev => prev.map(t => t.id === finalTask.id ? finalTask : t));
    } else {
        setEvents(prev => prev.map(e => e.id === updatedItem.id ? updatedItem as Event : e));
    }
  };

  const handleDeleteItem = (item: Task | Event) => {
    if ('status' in item) {
       setTasks(prev => prev.filter(t => t.id !== item.id));
    } else {
       setEvents(prev => prev.filter(e => e.id !== item.id));
    }
    setSelectedItem(null);
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

      setNotes(prev => [newNote, ...prev]);
      setFocusNoteId(newNote.id);
      setCurrentView('meeting-notes');
      setSelectedItem(null);
  };

  const getFontSizeClass = () => {
      if (theme.fontSize === 'small') return 'text-sm';
      if (theme.fontSize === 'large') return 'text-lg';
      return 'text-base';
  };

  // Dashboard Overview Component
  const Dashboard = () => {
    const pendingTasks = tasks.filter(t => t.status !== TaskStatus.DONE).length;
    const urgentTasks = tasks.filter(t => (t.urgency === 'Critical' || t.urgency === 'High') && t.status !== TaskStatus.DONE).length;
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <div className={`p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar pb-32 ${getFontSizeClass()}`}>
        <div className="mb-6 flex justify-between items-end">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Good Morning, {user?.name}</h1>
                <p className="text-slate-500 text-sm md:text-lg mt-1">{today}</p>
            </div>
            <button onClick={handleLogout} className="text-xs md:text-sm text-slate-400 hover:text-red-500 p-2">Sign Out</button>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8">
            <div 
                onClick={() => { setViewFilter('todo'); setCurrentView('braindump'); }}
                className={`bg-${theme.accentColor}-600 rounded-xl p-3 md:p-6 text-white shadow-lg cursor-pointer active:scale-95 transition-transform`}
            >
                <div className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">{pendingTasks}</div>
                <div className="text-white/80 text-[10px] md:text-sm font-medium uppercase tracking-wider">
                    Pending
                </div>
            </div>
            <div 
                onClick={() => { setViewFilter('urgent'); setCurrentView('braindump'); }}
                className="bg-orange-500 rounded-xl p-3 md:p-6 text-white shadow-lg cursor-pointer active:scale-95 transition-transform"
            >
                <div className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">{urgentTasks}</div>
                <div className="text-white/80 text-[10px] md:text-sm font-medium uppercase tracking-wider">
                    Urgent
                </div>
            </div>
            <div 
                onClick={() => { setViewFilter('reading'); setCurrentView('library'); }}
                className="bg-purple-600 rounded-xl p-3 md:p-6 text-white shadow-lg cursor-pointer active:scale-95 transition-transform"
            >
                <div className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">{books.filter(b => b.status === 'Reading').length}</div>
                <div className="text-white/80 text-[10px] md:text-sm font-medium uppercase tracking-wider">
                    Reading
                </div>
            </div>
        </div>

        <h3 className="font-bold text-lg md:text-2xl text-slate-700 mb-2 md:mb-4">Upcoming Events</h3>
        <div className="space-y-2 md:space-y-4 mb-6 md:mb-8">
            {events.slice(0, 5).map(ev => (
                <div 
                    key={ev.id} 
                    onClick={() => setSelectedItem(ev)}
                    className="bg-white p-3 md:p-5 rounded-lg border-l-4 shadow-sm flex justify-between items-center cursor-pointer active:bg-slate-50 transition-colors"
                    style={{ borderLeftColor: calendars.find(c => c.id === ev.calendarId)?.color || '#3b82f6' }}
                >
                    <div className="overflow-hidden">
                        <div className="font-bold text-sm md:text-lg text-slate-900 truncate">{ev.title}</div>
                        <div className="text-xs md:text-base text-slate-500 mt-0.5 flex items-center gap-2 truncate">
                             <span className="font-mono bg-slate-100 px-1 rounded">
                                {new Date(ev.when).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                             </span>
                             {ev.where && <span className="truncate">• {ev.where}</span>}
                        </div>
                    </div>
                    <i className="fas fa-chevron-right text-slate-300 text-sm md:text-xl ml-2"></i>
                </div>
            ))}
            {events.length === 0 && <p className="text-slate-400 italic text-sm text-center py-2 bg-slate-50 rounded-lg border border-slate-100">No upcoming events today.</p>}
        </div>

        <h3 className="font-bold text-lg md:text-2xl text-slate-700 mb-2 md:mb-4">Urgent Tasks</h3>
        <div className="space-y-2 md:space-y-4">
             {tasks.filter(t => (t.urgency === 'Critical' || t.urgency === 'High') && t.status !== TaskStatus.DONE)
                .slice(0, 5)
                .map(task => (
                 <div 
                    key={task.id} 
                    onClick={() => setSelectedItem(task)}
                    className="bg-white p-3 md:p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors"
                 >
                     <div className="flex-1 mr-2 overflow-hidden">
                         <div className="font-bold text-sm md:text-lg text-slate-900 mb-0.5 truncate">{task.shortDescription}</div>
                         <div className="text-xs md:text-sm text-slate-500 flex flex-wrap gap-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium truncate max-w-[100px]">{task.forWho}</span>
                         </div>
                     </div>
                     <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full font-bold uppercase whitespace-nowrap ${task.urgency === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                         {task.urgency}
                     </span>
                 </div>
             ))}
             {tasks.filter(t => (t.urgency === 'Critical' || t.urgency === 'High') && t.status !== TaskStatus.DONE).length === 0 && (
                 <p className="text-slate-400 italic text-sm text-center py-2 bg-slate-50 rounded-lg border border-slate-100">No urgent tasks.</p>
             )}
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
      return <Login onLogin={handleCreateProfile} userEmail={currentUserEmail} />;
  }

  if (!isSetupComplete) {
      return <SetupWizard onComplete={() => setIsSetupComplete(true)} />;
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: theme.bgColor }}>
        <Navigation currentView={currentView} setView={handleNavigation} accentColor={theme.accentColor} />
        
        <main className={`flex-1 overflow-hidden relative w-full ${getFontSizeClass()}`}>
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'braindump' && <BrainDump tasks={tasks} setTasks={setTasks} initialFilter={viewFilter || 'all'} onTaskClick={setSelectedItem} />}
            {currentView === 'week' && <WeekView tasks={tasks} events={events} setTasks={setTasks} onEditTask={setSelectedItem} accentColor={theme.accentColor} calendars={calendars} />}
            {currentView === 'library' && <Library books={books} setBooks={setBooks} initialFilter={viewFilter || 'all'} />}
            {currentView === 'meeting-notes' && <MeetingNotes notes={notes} setNotes={setNotes} tasks={tasks} setTasks={setTasks} events={events} setEvents={setEvents} initialNoteId={focusNoteId} onEditTask={(task) => setSelectedItem(task)} />}
            {currentView === 'people' && <People people={people} setPeople={setPeople} />}
            {currentView === 'settings' && <Settings calendars={calendars} setCalendars={setCalendars} theme={theme} setTheme={updateTheme} />}
        </main>

        <DetailSidebar 
            isOpen={!!selectedItem} 
            item={selectedItem} 
            calendars={calendars}
            onClose={() => setSelectedItem(null)} 
            onSave={handleSaveItem}
            onDelete={handleDeleteItem}
            onCreateNote={handleCreateNoteFromEvent} 
        />
    </div>
  );
};

export default App;
