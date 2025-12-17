
import React, { useState, useMemo, useRef } from 'react';
import { Task, TaskStatus, Importance, Urgency, GoogleCalendar, Event } from '../types';

interface WeekViewProps {
  tasks: Task[];
  events?: Event[]; // Added events
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onEditTask: (item: Task | Event) => void;
  accentColor?: string;
  calendars: GoogleCalendar[];
}

export const WeekView: React.FC<WeekViewProps> = ({ tasks, events = [], setTasks, onEditTask, accentColor = 'sky', calendars }) => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  
  // View Configuration State
  const [baseDate, setBaseDate] = useState(new Date());
  const [startDayOfWeek, setStartDayOfWeek] = useState(0); 
  const [isTimeGridView, setIsTimeGridView] = useState(true);
  
  // Calendar Filter State
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string> | null>(null);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  // Zoom / Pinch State
  const [hourHeight, setHourHeight] = useState(60);
  const touchStartDist = useRef<number | null>(null);
  const startHeight = useRef<number>(60);

  // Constants
  const START_HOUR = 6; 
  const END_HOUR = 22; 
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  // --- Filter Logic ---

  const effectiveVisibleCalendars = useMemo(() => {
      if (visibleCalendarIds) return visibleCalendarIds;
      // Default: All visible + Unassigned
      const all = new Set(calendars.map(c => c.id));
      all.add('unassigned');
      return all;
  }, [visibleCalendarIds, calendars]);

  const toggleCalendar = (id: string) => {
      const newSet = new Set(effectiveVisibleCalendars);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setVisibleCalendarIds(newSet);
  };

  const filteredTasks = useMemo(() => {
      return tasks.filter(t => {
          const cId = t.calendarId || 'unassigned';
          return effectiveVisibleCalendars.has(cId);
      });
  }, [tasks, effectiveVisibleCalendars]);

  // Filter events similarly
  const filteredEvents = useMemo(() => {
      return events.filter(e => {
          const cId = e.calendarId || 'unassigned';
          return effectiveVisibleCalendars.has(cId);
      });
  }, [events, effectiveVisibleCalendars]);

  // --- Touch Handlers for Pinch Zoom ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDist.current = dist;
        startHeight.current = hourHeight;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = dist / touchStartDist.current;
        const newHeight = Math.min(Math.max(startHeight.current * scale, 30), 120); // Clamp 30px to 120px
        setHourHeight(newHeight);
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  // Helper: Priority Calculation
  const getScaleValue = (val: string) => {
    switch(val) {
      case 'Low': return 1;
      case 'Medium': return 2;
      case 'High': return 3;
      case 'Critical': return 4;
      default: return 1;
    }
  };
  
  // New Formula: Urgency * (Importance ^ 2). Completed tasks drop to 0 priority.
  const calculatePriority = (t: Task) => {
      if (t.status === TaskStatus.DONE) return 0;
      return getScaleValue(t.urgency) * Math.pow(getScaleValue(t.importance), 2);
  };

  // Sorting Logic
  const sortTasks = (taskList: Task[]) => {
    return taskList.sort((a, b) => {
        const pA = calculatePriority(a);
        const pB = calculatePriority(b);
        if (pA !== pB) return pB - pA;
        const uA = getScaleValue(a.urgency);
        const uB = getScaleValue(b.urgency);
        if (uA !== uB) return uB - uA;
        const iA = getScaleValue(a.importance);
        const iB = getScaleValue(b.importance);
        return iB - iA;
    });
  };

  const days = useMemo(() => {
    const d = [];
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const currentDay = start.getDay(); 
    let diff = currentDay - startDayOfWeek;
    if (diff < 0) diff += 7;
    start.setDate(start.getDate() - diff);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      d.push(date);
    }
    return d;
  }, [baseDate, startDayOfWeek]);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const getTasksForDay = (dateStr: string) => {
    return filteredTasks.filter(t => t.when && t.when.startsWith(dateStr));
  };

  const getEventsForDay = (dateStr: string) => {
    return filteredEvents.filter(e => e.when && e.when.startsWith(dateStr));
  };

  const getQueueTasks = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    // Use filteredTasks here too, so hiding a calendar hides its tasks from queue
    const incomplete = filteredTasks.filter(t => t.status !== TaskStatus.DONE);
    const overdue = incomplete.filter(t => t.when && new Date(t.when) < today);
    const undated = incomplete.filter(t => !t.when);
    return {
        overdue: sortTasks(overdue),
        undated: sortTasks(undated)
    };
  };

  const assignTaskToDay = (taskId: string, date: Date) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      let newDateIso;
      if (t.when && t.when.includes('T')) {
          const oldTime = t.when.split('T')[1];
          newDateIso = `${date.toISOString().split('T')[0]}T${oldTime}`;
      } else {
          const d = new Date(date);
          d.setHours(9, 0, 0, 0); 
          newDateIso = d.toISOString();
      }
      return { ...t, when: newDateIso };
    }));
    setSelectedTask(null);
  };

  const unassignTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, when: undefined } : t
    ));
  };

  const quickAddTask = (date?: Date) => {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        shortDescription: 'New Task',
        status: TaskStatus.TODO,
        importance: Importance.MEDIUM,
        urgency: Urgency.MEDIUM,
        attachments: [],
        boardId: 'manual',
        updates: [],
        when: date ? (()=>{
            const d = new Date(date);
            d.setHours(9,0,0,0);
            return d.toISOString();
        })() : undefined
      };
      setTasks(prev => [...prev, newTask]);
      if (!date) {
        setSelectedTask(newTask.id); 
      } else {
          onEditTask(newTask);
      }
  };

  const createTaskFromEvent = (event: Event) => {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        shortDescription: `Prep: ${event.title}`,
        longDescription: `Task created from event: ${event.title}`,
        status: TaskStatus.TODO,
        importance: Importance.MEDIUM,
        urgency: Urgency.MEDIUM,
        attachments: [],
        boardId: 'manual',
        updates: [],
        when: event.when,
        where: event.where,
        calendarId: event.calendarId
      };
      setTasks(prev => [...prev, newTask]);
      onEditTask(newTask);
  };

  const handlePrevWeek = () => {
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() - 7);
      setBaseDate(newDate);
  };

  const handleNextWeek = () => {
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + 7);
      setBaseDate(newDate);
  };

  const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          const parts = e.target.value.split('-');
          const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          setBaseDate(newDate);
      }
  };

  const getPosition = (isoString: string) => {
      const d = new Date(isoString);
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const minutesFromStart = ((hours - START_HOUR) * 60) + minutes;
      return (minutesFromStart / 60) * hourHeight;
  };

  const getTaskHeight = (task: Task) => {
      const h = task.duration?.hours ?? 0;
      const m = task.duration?.minutes ?? 0;
      let durationMinutes = (h * 60) + m;
      if (durationMinutes <= 0) durationMinutes = 30;
      return (durationMinutes / 60) * hourHeight;
  };

  const getEventHeight = (event: Event) => {
      // Default to 1 hour for events if no end time logic is present
      // In a real app we'd use event.endTime
      return 60 / 60 * hourHeight; 
  };

  const isUntimed = (isoString: string) => {
      const d = new Date(isoString);
      return d.getHours() === 0 && d.getMinutes() === 0;
  };

  const queue = getQueueTasks();

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white">
      {/* Sidebar: Unassigned Tasks */}
      <div className="h-1/3 md:h-full md:w-1/4 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto p-4 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 flex flex-col">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 py-2">
            <h3 className="font-bold text-slate-800 text-lg">Task Queue</h3>
        </div>
        
        <div className="space-y-4 flex-1">
          {queue.overdue.length > 0 && (
             <div>
                <h4 className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i> Overdue
                </h4>
                <div className="space-y-2">
                    {queue.overdue.map(task => (
                         <div
                            key={task.id}
                            onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all relative group/queueitem ${
                                selectedTask === task.id 
                                ? 'bg-red-50 border-red-300 ring-2 ring-red-200' 
                                : 'bg-white border-slate-200 hover:border-red-200'
                            }`}
                        >
                            <div className="font-semibold text-sm text-slate-800 leading-tight">{task.shortDescription}</div>
                            <div className="flex justify-between mt-2 items-center">
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{task.forWho || 'Me'}</span>
                                <span className="text-[10px] text-red-500 font-bold">{new Date(task.when!).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between items-center">
                <span>Undated</span>
                <button onClick={() => quickAddTask()} className={`bg-${accentColor}-50 text-${accentColor}-600 hover:bg-${accentColor}-100 rounded-full w-5 h-5 flex items-center justify-center`}>
                    <i className="fas fa-plus text-[10px]"></i>
                </button>
            </h4>
            <div className="space-y-2">
                {queue.undated.length === 0 && queue.overdue.length === 0 && (
                    <div className="text-center text-slate-400 mt-4 italic text-sm">queue empty</div>
                )}
                {queue.undated.map(task => (
                    <div
                    key={task.id}
                    onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all relative group/queueitem ${
                        selectedTask === task.id 
                        ? `bg-${accentColor}-50 border-${accentColor}-500 ring-2 ring-${accentColor}-500 shadow-lg scale-[1.02]` 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                    >
                    <div className="font-semibold text-sm text-slate-800 leading-tight">{task.shortDescription}</div>
                    <div className="flex justify-between mt-2 items-center">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{task.forWho || 'Me'}</span>
                        <div className="flex gap-1">
                            <span className={`text-[10px] uppercase font-bold px-1 rounded ${task.urgency === 'Critical' ? 'text-red-600 bg-red-50' : 'text-slate-400'}`}>
                                {task.urgency}
                            </span>
                        </div>
                    </div>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                        className={`absolute top-1 right-1 bg-white text-slate-400 hover:text-${accentColor}-600 w-6 h-6 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover/queueitem:opacity-100 transition`}
                    >
                        <i className="fas fa-pencil-alt text-xs"></i>
                    </button>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Header Controls */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm z-10 gap-2">
            <div className="flex items-center gap-2">
                <button onClick={handlePrevWeek} className={`p-2 text-slate-500 hover:text-${accentColor}-600 hover:bg-slate-100 rounded-full transition`}>
                    <i className="fas fa-chevron-left"></i>
                </button>
                <button 
                    onClick={() => setBaseDate(new Date())}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded shadow-sm"
                >
                    Today
                </button>

                {/* Date Picker Button */}
                <div className="relative group/picker">
                    <button className={`px-2 py-1 text-slate-500 hover:text-${accentColor}-600 hover:bg-slate-100 rounded transition flex items-center gap-1`}>
                        <i className="fas fa-calendar-alt"></i>
                    </button>
                    <input 
                        type="date" 
                        onChange={handleJumpToDate}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        title="Jump to date"
                    />
                </div>

                <h2 className="text-sm md:text-lg font-bold text-slate-800 w-28 md:w-48 text-center whitespace-nowrap">
                    {days[0].toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})} - {days[6].toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}
                </h2>
                <button onClick={handleNextWeek} className={`p-2 text-slate-500 hover:text-${accentColor}-600 hover:bg-slate-100 rounded-full transition`}>
                    <i className="fas fa-chevron-right"></i>
                </button>
            </div>
            
            <div className="flex items-center gap-2">
                 {/* Calendar Filter */}
                 <div className="relative">
                     <button 
                        onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                        className={`p-2 rounded hover:bg-slate-100 ${showCalendarMenu ? `text-${accentColor}-600 bg-slate-50` : 'text-slate-500'}`}
                        title="Filter Calendars"
                     >
                         <i className="fas fa-filter"></i>
                     </button>
                     {showCalendarMenu && (
                         <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                             <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase">Visible Calendars</div>
                             <div className="max-h-60 overflow-y-auto">
                                 {/* Unassigned Option */}
                                 <div 
                                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                                    onClick={() => toggleCalendar('unassigned')}
                                 >
                                     <div className={`w-4 h-4 rounded border flex items-center justify-center ${effectiveVisibleCalendars.has('unassigned') ? `bg-${accentColor}-500 border-${accentColor}-500` : 'border-slate-300'}`}>
                                         {effectiveVisibleCalendars.has('unassigned') && <i className="fas fa-check text-white text-[10px]"></i>}
                                     </div>
                                     <div className="flex-1 text-sm text-slate-700">Unassigned / Local</div>
                                 </div>
                                 
                                 {/* Google Calendars */}
                                 {calendars.map(cal => (
                                     <div 
                                        key={cal.id}
                                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                                        onClick={() => toggleCalendar(cal.id)}
                                     >
                                         <div 
                                            className={`w-4 h-4 rounded border flex items-center justify-center`}
                                            style={{ 
                                                backgroundColor: effectiveVisibleCalendars.has(cal.id) ? cal.color : 'white',
                                                borderColor: cal.color 
                                            }}
                                         >
                                             {effectiveVisibleCalendars.has(cal.id) && <i className="fas fa-check text-white text-[10px]"></i>}
                                         </div>
                                         <div className="flex-1 text-sm text-slate-700 truncate">{cal.name}</div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}
                     {showCalendarMenu && (
                         <div className="fixed inset-0 z-40" onClick={() => setShowCalendarMenu(false)}></div>
                     )}
                 </div>

                 {/* Zoom Reset */}
                 {hourHeight !== 60 && (
                     <button onClick={() => setHourHeight(60)} className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Reset Zoom</button>
                 )}

                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setIsTimeGridView(false)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${!isTimeGridView ? `bg-white text-${accentColor}-600 shadow-sm` : 'text-slate-500'}`}
                    >
                        List
                    </button>
                    <button 
                        onClick={() => setIsTimeGridView(true)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${isTimeGridView ? `bg-white text-${accentColor}-600 shadow-sm` : 'text-slate-500'}`}
                    >
                        Grid
                    </button>
                </div>
            </div>
        </div>

        {/* Scrollable Grid Area */}
        <div 
            className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar relative touch-pan-x touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
           <div className="flex min-w-[800px] md:min-w-[1000px] h-full">
               {/* Time Labels Column (Only for Time Grid) */}
               {isTimeGridView && (
                   <div className="w-10 flex-shrink-0 bg-slate-50 border-r border-slate-200 pt-[42px]">
                       {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                           <div key={i} style={{ height: `${hourHeight}px` }} className="text-[10px] text-slate-400 text-right pr-2 relative -top-2 border-b border-transparent">
                               {(START_HOUR + i).toString().padStart(2, '0')}
                           </div>
                       ))}
                   </div>
               )}

               {/* Days Columns */}
               {days.map((day, index) => {
                    const dateStr = formatDate(day);
                    const dailyTasks = getTasksForDay(dateStr);
                    const dailyEvents = getEventsForDay(dateStr);
                    
                    const isToday = new Date().toDateString() === day.toDateString();

                    // Sort Tasks: Untimed first (by priority), then Timed (by time)
                    const untimedTasks = dailyTasks.filter(t => !t.when || isUntimed(t.when)).sort((a,b) => calculatePriority(b) - calculatePriority(a));
                    const timedTasks = dailyTasks.filter(t => t.when && !isUntimed(t.when)).sort((a,b) => new Date(a.when!).getTime() - new Date(b.when!).getTime());
                    
                    // Sort Events: Just by time
                    const sortedEvents = dailyEvents.sort((a,b) => new Date(a.when).getTime() - new Date(b.when).getTime());

                    return (
                        <div 
                            key={dateStr} 
                            className={`flex-1 min-w-[100px] border-r border-slate-200 flex flex-col relative group ${isToday ? `bg-${accentColor}-50/30` : ''}`}
                            onClick={() => selectedTask && assignTaskToDay(selectedTask, day)}
                        >
                            {/* Day Header - Compact with Top-Right Button */}
                            <div className={`text-center py-2 border-b border-slate-200 sticky top-0 z-10 flex flex-col items-center h-[42px] justify-center relative ${isToday ? `bg-${accentColor}-600 text-white` : 'bg-slate-50 text-slate-700'}`}>
                                <div className="text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className={`text-sm font-black leading-none ${isToday ? 'text-white' : 'text-slate-900'}`}>{day.getDate()}</div>
                                
                                <button 
                                    onClick={(e) => { e.stopPropagation(); quickAddTask(day); }}
                                    className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition shadow-sm ${isToday ? 'bg-white text-sky-600' : 'bg-white border border-slate-300 text-slate-400 hover:text-sky-600'}`}
                                    title="Quick Add"
                                >
                                    <i className="fas fa-plus"></i>
                                </button>
                            </div>

                            {/* Drop overlay */}
                            {selectedTask && (
                                <div className={`absolute inset-0 bg-${accentColor}-500/10 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity`}>
                                    <span className={`bg-${accentColor}-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow`}>Assign Here</span>
                                </div>
                            )}

                            {/* List View Content */}
                            {!isTimeGridView && (
                                <div className="p-1 space-y-1 pb-20">
                                    {/* Events First in List View */}
                                    {sortedEvents.map(event => (
                                        <div key={event.id} className="bg-slate-100 p-1.5 rounded shadow-sm border-l-4 border-slate-400 text-xs hover:shadow-md transition cursor-pointer relative group/item">
                                            <div className="text-[9px] font-bold text-slate-600 leading-none mb-0.5">
                                                {new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                            <div className="font-bold leading-tight text-slate-800">{event.title}</div>
                                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/item:opacity-100 transition">
                                                <button onClick={(e) => { e.stopPropagation(); onEditTask(event); }}>
                                                    <i className="fas fa-pencil-alt text-slate-400 hover:text-sky-600"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {[...untimedTasks, ...timedTasks].map(task => {
                                        const isDone = task.status === TaskStatus.DONE;
                                        return (
                                            <div key={task.id} className={`bg-white p-1.5 rounded shadow-sm border border-slate-200 text-xs hover:shadow-md transition cursor-pointer relative group/item ${isDone ? 'opacity-60 bg-slate-100' : ''}`}>
                                                {task.when && !isUntimed(task.when) && (
                                                    <div className={`text-[9px] font-bold ${isDone ? 'text-slate-400' : `text-${accentColor}-600`} leading-none mb-0.5`}>
                                                        {new Date(task.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                )}
                                                <div className={`font-medium leading-tight ${isDone ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                                                    {task.shortDescription}
                                                </div>
                                                <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/item:opacity-100 transition">
                                                    <button onClick={(e) => { e.stopPropagation(); onEditTask(task); }}>
                                                        <i className="fas fa-pencil-alt text-slate-400 hover:text-sky-600"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Grid View Content */}
                            {isTimeGridView && (
                                <div className="flex-1 relative">
                                    {/* Untimed Stack (Top) */}
                                    {untimedTasks.length > 0 && (
                                        <div className="bg-slate-100 p-1 border-b border-slate-200 space-y-1 z-10 relative">
                                            {untimedTasks.map(task => {
                                                const isDone = task.status === TaskStatus.DONE;
                                                return (
                                                    <div key={task.id} className={`bg-white p-1 px-2 rounded border border-slate-300 text-[10px] shadow-sm flex justify-between items-center relative group/item ${isDone ? 'opacity-60 bg-slate-50' : ''}`}>
                                                        <span className={`truncate font-medium ${isDone ? 'line-through text-slate-500' : 'text-slate-700'}`}>{task.shortDescription}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                                className={`text-slate-400 hover:text-${accentColor}-600`}
                                                            >
                                                                <i className="fas fa-pencil-alt"></i>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); unassignTask(task.id); }}
                                                                className="text-slate-400 hover:text-red-500"
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Timed Grid Background Lines */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                                            <div key={i} className="border-b border-slate-100 w-full" style={{ height: `${hourHeight}px`, boxSizing: 'border-box' }}></div>
                                        ))}
                                    </div>

                                    {/* Events Blocks */}
                                    {sortedEvents.map(event => {
                                        const top = getPosition(event.when);
                                        const height = getEventHeight(event);
                                        if (top < 0) return null;

                                        return (
                                            <div 
                                                key={event.id}
                                                className={`absolute left-1 right-1 rounded border-l-4 pl-1 p-1 text-xs overflow-hidden hover:z-20 hover:shadow-lg transition cursor-pointer group/block bg-white text-slate-800 border-slate-400 opacity-90 shadow-sm`}
                                                style={{ top: `${top}px`, height: `${height}px`, zIndex: 10 }}
                                            >
                                                <div className="font-bold text-[9px] leading-3 text-slate-500">
                                                    {new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                                <div className="font-bold leading-tight truncate text-[10px]">{event.title}</div>
                                                
                                                <div className="absolute top-0 right-0 p-1 flex gap-1 opacity-0 group-hover/block:opacity-100">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); createTaskFromEvent(event); }}
                                                        className="text-sky-600 hover:text-sky-800 bg-white/80 rounded px-1 flex items-center gap-1 text-[9px] font-bold border border-sky-100"
                                                        title="Create Task from Event"
                                                    >
                                                        <i className="fas fa-check-square"></i> Task
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onEditTask(event); }}
                                                        className="text-slate-500 hover:text-slate-800 bg-white/80 rounded px-1"
                                                    >
                                                        <i className="fas fa-pencil-alt text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Timed Tasks Blocks */}
                                    {timedTasks.map(task => {
                                        const top = getPosition(task.when!);
                                        const height = getTaskHeight(task);
                                        // Skip if out of bounds (before 6am or after 10pm for now)
                                        if (top < 0) return null;
                                        
                                        const isDone = task.status === TaskStatus.DONE;

                                        return (
                                            <div 
                                                key={task.id}
                                                className={`absolute left-4 right-1 rounded border p-1 text-xs overflow-hidden hover:z-20 hover:shadow-lg transition cursor-pointer group/block 
                                                    ${isDone 
                                                        ? 'border-slate-300 bg-slate-100 text-slate-500 opacity-60' 
                                                        : `border-${accentColor}-200 bg-${accentColor}-100/90 text-${accentColor}-900`
                                                    }`}
                                                style={{ top: `${top}px`, height: `${height}px`, zIndex: 15 }}
                                            >
                                                <div className="font-bold text-[9px] leading-3">{new Date(task.when!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                <div className={`font-medium leading-tight truncate text-[10px] ${isDone ? 'line-through' : ''}`}>{task.shortDescription}</div>
                                                
                                                <div className="absolute top-0 right-0 p-1 flex gap-1 opacity-0 group-hover/block:opacity-100">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                        className={`text-${accentColor}-600 hover:text-${accentColor}-800 bg-white/50 rounded px-1`}
                                                    >
                                                        <i className="fas fa-pencil-alt text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
               })}
           </div>
        </div>
      </div>
    </div>
  );
};
