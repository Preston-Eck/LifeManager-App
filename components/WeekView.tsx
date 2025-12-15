import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Importance, Urgency } from '../types';

interface WeekViewProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onEditTask: (task: Task) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({ tasks, setTasks, onEditTask }) => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  
  // View Configuration State
  const [baseDate, setBaseDate] = useState(new Date());
  const [startDayOfWeek, setStartDayOfWeek] = useState(0); // 0 = Sunday, 1 = Monday, 6 = Saturday
  const [isTimeGridView, setIsTimeGridView] = useState(true);

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
  const calculatePriority = (t: Task) => getScaleValue(t.importance) * (2 * getScaleValue(t.urgency));

  // Sorting Logic: Priority -> Urgency -> Importance
  const sortTasks = (taskList: Task[]) => {
    return taskList.sort((a, b) => {
        const pA = calculatePriority(a);
        const pB = calculatePriority(b);
        if (pA !== pB) return pB - pA;
        
        // Tie breaker 1: Urgency
        const uA = getScaleValue(a.urgency);
        const uB = getScaleValue(b.urgency);
        if (uA !== uB) return uB - uA;

        // Tie breaker 2: Importance
        const iA = getScaleValue(a.importance);
        const iB = getScaleValue(b.importance);
        return iB - iA;
    });
  };

  // Generate current visible week days based on baseDate and startDayOfWeek
  const days = useMemo(() => {
    const d = [];
    const start = new Date(baseDate);
    
    // Normalize to midnight
    start.setHours(0, 0, 0, 0);

    const currentDay = start.getDay(); // 0-6 (Sun-Sat)
    
    // Calculate difference to get to the previous startDayOfWeek
    // Example: StartDay = 1 (Mon), Current = 3 (Wed). Diff = 2. Start - 2 days.
    // Example: StartDay = 1 (Mon), Current = 0 (Sun). Diff = -1? No, want previous Monday (6 days ago).
    
    let diff = currentDay - startDayOfWeek;
    if (diff < 0) {
        diff += 7;
    }

    start.setDate(start.getDate() - diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      d.push(date);
    }
    return d;
  }, [baseDate, startDayOfWeek]);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  // Group tasks for the week
  const getTasksForDay = (dateStr: string) => {
    return tasks.filter(t => t.when && t.when.startsWith(dateStr));
  };

  const getQueueTasks = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const incomplete = tasks.filter(t => t.status !== TaskStatus.DONE);
    
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

  // Handlers for Week Navigation
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
          // Create date using local time (avoid UTC shift issues)
          const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          setBaseDate(newDate);
      }
  };

  // Time Grid Helpers
  const START_HOUR = 6; // 6 AM
  const END_HOUR = 22; // 10 PM
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const HOUR_HEIGHT = 60; // px

  const getTaskPosition = (isoString: string) => {
      const d = new Date(isoString);
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const minutesFromStart = ((hours - START_HOUR) * 60) + minutes;
      return (minutesFromStart / 60) * HOUR_HEIGHT;
  };

  const getTaskHeight = (task: Task) => {
      const h = task.duration?.hours || 1;
      const m = task.duration?.minutes || 0;
      const durationMinutes = (h * 60) + m;
      return (durationMinutes / 60) * HOUR_HEIGHT;
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
        
        <div className="space-y-6 flex-1">
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
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                className="absolute top-1 right-1 bg-white hover:bg-slate-100 text-slate-400 hover:text-sky-600 w-6 h-6 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover/queueitem:opacity-100 transition"
                            >
                                <i className="fas fa-pencil-alt text-xs"></i>
                            </button>
                        </div>
                    ))}
                </div>
             </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between items-center">
                <span>Undated</span>
                <button onClick={() => quickAddTask()} className="bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-full w-5 h-5 flex items-center justify-center">
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
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500 shadow-lg scale-[1.02]' 
                        : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-md'
                    }`}
                    >
                    <div className="font-semibold text-sm text-slate-800 leading-tight">{task.shortDescription}</div>
                    <div className="flex justify-between mt-2 items-center">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{task.forWho || 'Me'}</span>
                        <div className="flex gap-1">
                            {task.duration && (task.duration.hours > 0 || task.duration.minutes > 0) && (
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 rounded">
                                    {task.duration.hours}h {task.duration.minutes}m
                                </span>
                            )}
                            <span className={`text-[10px] uppercase font-bold px-1 rounded ${task.urgency === 'Critical' ? 'text-red-600 bg-red-50' : 'text-slate-400'}`}>
                                {task.urgency}
                            </span>
                        </div>
                    </div>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                        className="absolute top-1 right-1 bg-white hover:bg-slate-100 text-slate-400 hover:text-sky-600 w-6 h-6 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover/queueitem:opacity-100 transition"
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
        <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-10 gap-2">
            <div className="flex items-center gap-2">
                <button onClick={handlePrevWeek} className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-full transition">
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
                    <button className="px-2 py-1 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded transition flex items-center gap-1">
                        <i className="fas fa-calendar-alt"></i>
                    </button>
                    <input 
                        type="date" 
                        onChange={handleJumpToDate}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        title="Jump to date"
                    />
                </div>

                <h2 className="text-lg font-bold text-slate-800 w-32 md:w-48 text-center whitespace-nowrap">
                    {days[0].toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - {days[6].toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                </h2>
                <button onClick={handleNextWeek} className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-full transition">
                    <i className="fas fa-chevron-right"></i>
                </button>
            </div>
            
            <div className="flex items-center gap-2">
                {/* Start of Week Selector */}
                <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
                    <span>Starts:</span>
                    <select 
                        value={startDayOfWeek}
                        onChange={(e) => setStartDayOfWeek(parseInt(e.target.value))}
                        className="bg-white border border-slate-200 rounded p-1 outline-none focus:border-sky-500 text-slate-900"
                    >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={6}>Saturday</option>
                    </select>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setIsTimeGridView(false)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${!isTimeGridView ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        List
                    </button>
                    <button 
                        onClick={() => setIsTimeGridView(true)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${isTimeGridView ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Time Grid
                    </button>
                </div>
            </div>
        </div>

        {/* Scrollable Grid Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar relative">
           <div className="flex min-w-[1000px] h-full">
               {/* Time Labels Column (Only for Time Grid) */}
               {isTimeGridView && (
                   <div className="w-12 flex-shrink-0 bg-slate-50 border-r border-slate-200 pt-[42px]">
                       {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                           <div key={i} className="h-[60px] text-[10px] text-slate-400 text-right pr-2 relative -top-2">
                               {(START_HOUR + i).toString().padStart(2, '0')}:00
                           </div>
                       ))}
                   </div>
               )}

               {/* Days Columns */}
               {days.map((day, index) => {
                    const dateStr = formatDate(day);
                    const allTasks = getTasksForDay(dateStr);
                    const isToday = new Date().toDateString() === day.toDateString();

                    // Sort: Untimed first (by priority), then Timed (by time)
                    const untimedTasks = allTasks.filter(t => !t.when || isUntimed(t.when)).sort((a,b) => calculatePriority(b) - calculatePriority(a));
                    const timedTasks = allTasks.filter(t => t.when && !isUntimed(t.when)).sort((a,b) => new Date(a.when!).getTime() - new Date(b.when!).getTime());

                    return (
                        <div 
                            key={dateStr} 
                            className={`flex-1 min-w-[140px] border-r border-slate-200 flex flex-col relative group ${isToday ? 'bg-sky-50/30' : ''}`}
                            onClick={() => selectedTask && assignTaskToDay(selectedTask, day)}
                        >
                            {/* Day Header */}
                            <div className={`text-center py-2 border-b border-slate-200 sticky top-0 z-10 flex flex-col items-center ${isToday ? 'bg-sky-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
                                <div className="text-xs font-bold uppercase tracking-wider">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className={`text-xl font-black ${isToday ? 'text-white' : 'text-slate-900'}`}>{day.getDate()}</div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); quickAddTask(day); }}
                                    className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center text-xs hover:scale-110 transition ${isToday ? 'bg-white text-sky-600' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}
                                    title="Quick Add to Day"
                                >
                                    <i className="fas fa-plus"></i>
                                </button>
                            </div>

                            {/* Drop overlay */}
                            {selectedTask && (
                                <div className="absolute inset-0 bg-sky-500/10 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                    <span className="bg-sky-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow">Assign Here</span>
                                </div>
                            )}

                            {/* List View Content */}
                            {!isTimeGridView && (
                                <div className="p-2 space-y-2 pb-20">
                                    {[...untimedTasks, ...timedTasks].map(task => (
                                        <div key={task.id} className="bg-white p-2 rounded shadow-sm border border-slate-200 text-sm hover:shadow-md transition cursor-pointer relative group/item">
                                            {task.when && !isUntimed(task.when) && (
                                                <div className="text-[10px] font-bold text-sky-600 mb-1">
                                                    {new Date(task.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            )}
                                            <div className="font-medium text-slate-800">{task.shortDescription}</div>
                                            <div className="flex justify-between items-center mt-1">
                                                <div className="text-[10px] text-slate-500 truncate max-w-[80px]">{task.where}</div>
                                                {task.urgency === 'Critical' && <i className="fas fa-exclamation-circle text-red-500 text-xs"></i>}
                                            </div>
                                            <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                    className="bg-white hover:bg-slate-100 text-slate-400 hover:text-sky-600 rounded-full w-6 h-6 flex items-center justify-center shadow border border-slate-200"
                                                >
                                                    <i className="fas fa-pencil-alt text-xs"></i>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); unassignTask(task.id); }}
                                                    className="bg-white hover:bg-red-50 text-red-400 hover:text-red-600 rounded-full w-6 h-6 flex items-center justify-center shadow border border-slate-200"
                                                >
                                                    <i className="fas fa-times text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Grid View Content */}
                            {isTimeGridView && (
                                <div className="flex-1 relative">
                                    {/* Untimed Stack (Top) */}
                                    {untimedTasks.length > 0 && (
                                        <div className="bg-slate-100 p-1 border-b border-slate-200 space-y-1 z-10 relative">
                                            {untimedTasks.map(task => (
                                                <div key={task.id} className="bg-white p-1 px-2 rounded border border-slate-300 text-xs shadow-sm flex justify-between items-center relative group/item">
                                                    <span className="truncate font-medium text-slate-700">{task.shortDescription}</span>
                                                     <div className="flex gap-1 opacity-0 group-hover/item:opacity-100">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                            className="text-slate-400 hover:text-sky-600"
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
                                            ))}
                                        </div>
                                    )}

                                    {/* Timed Grid Background Lines */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                                            <div key={i} className="h-[60px] border-b border-slate-100 w-full" style={{ boxSizing: 'border-box' }}></div>
                                        ))}
                                    </div>

                                    {/* Timed Tasks Blocks */}
                                    {timedTasks.map(task => {
                                        const top = getTaskPosition(task.when!);
                                        const height = getTaskHeight(task);
                                        // Skip if out of bounds (before 6am or after 10pm for now)
                                        if (top < 0) return null;

                                        return (
                                            <div 
                                                key={task.id}
                                                className="absolute left-1 right-1 rounded border border-sky-200 bg-sky-100/90 text-sky-900 p-1 text-xs overflow-hidden hover:z-20 hover:shadow-lg transition cursor-pointer group/block"
                                                style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
                                            >
                                                <div className="font-bold text-[10px] leading-3">{new Date(task.when!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                <div className="font-medium leading-tight truncate">{task.shortDescription}</div>
                                                
                                                <div className="absolute top-0 right-0 p-1 flex gap-1 opacity-0 group-hover/block:opacity-100">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                        className="text-sky-600 hover:text-sky-800 bg-white/50 rounded px-1"
                                                    >
                                                        <i className="fas fa-pencil-alt"></i>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); unassignTask(task.id); }}
                                                        className="text-sky-400 hover:text-red-500 bg-white/50 rounded px-1"
                                                    >
                                                        <i className="fas fa-times"></i>
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