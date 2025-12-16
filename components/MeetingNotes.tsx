import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MeetingNote, Task, Event, TaskStatus, Urgency, Importance, Attachment } from '../types';

// --- Types for Structured Data ---

interface AgendaItem {
  id: string;
  time: string;
  topic: string;
  owner: string;
  outcome: string;
  notes: string;
  attachments: Attachment[];
}

interface ReportItem {
  id: string;
  title: string;
  owner: string;
  content: string; // Combined Status/Actions text
  attachments: Attachment[]; // Added Attachments
}

interface MeetingData {
  missionStatement: string;
  callToOrder: { // New
    chairman: string;
    time: string;
  };
  logistics: {
    date: string;
    time: string;
    location: string;
    link: string;
  };
  preliminaries: {
    parentComments: string;
    prayer: string;
    minutesApproval: string;
    emailMotions: string; // New
  };
  objective: string;
  roles: {
    facilitator: string;
    noteTaker: string;
    timeKeeper: string;
  };
  attendees: {
    present: string;
    absent: string;
    exOfficio: string; // New
    guests: string; // New
  };
  adminReports: ReportItem[]; // New Section
  reports: ReportItem[]; // Committee Reports
  agenda: AgendaItem[]; // "New Business"
  executiveSession: string;
  tabledItems: string;
  parkingLot: string;
  closing: {
    rating: number;
    nextMeetingDate: string;
    adjournmentTime: string; // New
    prayerBy: string; // New
    submittedBy: string; // New
  };
}

interface MeetingStructure {
  version: 1;
  visible: {
    mission: boolean;
    callToOrder: boolean; // New
    logistics: boolean;
    preliminaries: boolean;
    objective: boolean;
    roles: boolean;
    attendees: boolean;
    adminReports: boolean; // New
    reports: boolean;
    agenda: boolean;
    actions: boolean;
    executiveSession: boolean;
    tabledItems: boolean;
    parkingLot: boolean;
    closing: boolean;
  };
  data: MeetingData;
}

const DEFAULT_STRUCTURE: MeetingStructure = {
  version: 1,
  visible: {
    mission: false,
    callToOrder: false,
    logistics: true,
    preliminaries: false,
    objective: true,
    roles: true,
    attendees: true,
    adminReports: false,
    reports: false,
    agenda: true,
    actions: true,
    executiveSession: false,
    tabledItems: false,
    parkingLot: true,
    closing: true,
  },
  data: {
    missionStatement: '',
    callToOrder: { chairman: '', time: '' },
    logistics: { date: '', time: '', location: '', link: '' },
    preliminaries: { parentComments: '', prayer: '', minutesApproval: '', emailMotions: '' },
    objective: '',
    roles: { facilitator: '', noteTaker: '', timeKeeper: '' },
    attendees: { present: '', absent: '', exOfficio: '', guests: '' },
    adminReports: [],
    reports: [],
    agenda: [],
    executiveSession: '',
    tabledItems: '',
    parkingLot: '',
    closing: { rating: 0, nextMeetingDate: '', adjournmentTime: '', prayerBy: '', submittedBy: '' },
  },
};

// --- Component ---

interface MeetingNotesProps {
  notes: MeetingNote[];
  setNotes: React.Dispatch<React.SetStateAction<MeetingNote[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  initialNoteId?: string;
  onEditTask?: (task: Task) => void;
}

export const MeetingNotes: React.FC<MeetingNotesProps> = ({ 
  notes, setNotes, tasks, setTasks, events, setEvents, initialNoteId, onEditTask 
}) => {
  // Navigation State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');

  // Right Sidebar State
  const [activeTab, setActiveTab] = useState<'tasks' | 'template'>('tasks');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskLinkSearch, setTaskLinkSearch] = useState('');
  const [completedStartDate, setCompletedStartDate] = useState<string>('');
  const [completedEndDate, setCompletedEndDate] = useState<string>('');
  const [futureLookahead, setFutureLookahead] = useState<number>(14);
  const [taskFilterType, setTaskFilterType] = useState<'all' | 'me' | 'unassigned'>('all');

  // Meeting Data State
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);
  const [meetingState, setMeetingState] = useState<MeetingStructure>(DEFAULT_STRUCTURE);
  const [isLegacyNote, setIsLegacyNote] = useState(false);

  // --- Initialization & Data Loading ---

  useEffect(() => {
    if (initialNoteId) {
      const note = notes.find(n => n.id === initialNoteId);
      if (note && note.linkedEventIds.length > 0) {
        setSelectedEventId(note.linkedEventIds[0]);
      }
    }
  }, [initialNoteId]);

  useEffect(() => {
    if (selectedEventId) {
      const foundNote = notes.find(n => n.linkedEventIds.includes(selectedEventId));
      if (foundNote) {
        setSelectedNote(foundNote);
        try {
          // Attempt to parse structured data
          if (foundNote.content.trim().startsWith('{')) {
            const parsed = JSON.parse(foundNote.content);
            if (parsed.version === 1) {
              // Merge with default to ensure new fields (like callToOrder) exist if loading older v1 notes
              const mergedState = {
                  ...DEFAULT_STRUCTURE,
                  ...parsed,
                  visible: { ...DEFAULT_STRUCTURE.visible, ...parsed.visible },
                  data: { 
                      ...DEFAULT_STRUCTURE.data, 
                      ...parsed.data,
                      // Deep merge objects that might be missing in older saves
                      callToOrder: { ...DEFAULT_STRUCTURE.data.callToOrder, ...(parsed.data.callToOrder || {}) },
                      attendees: { ...DEFAULT_STRUCTURE.data.attendees, ...(parsed.data.attendees || {}) },
                      closing: { ...DEFAULT_STRUCTURE.data.closing, ...(parsed.data.closing || {}) },
                      preliminaries: { ...DEFAULT_STRUCTURE.data.preliminaries, ...(parsed.data.preliminaries || {}) },
                      adminReports: parsed.data.adminReports || [],
                  }
              };
              setMeetingState(mergedState);
              setIsLegacyNote(false);
            } else {
              throw new Error("Unknown version");
            }
          } else {
            setIsLegacyNote(true);
          }
        } catch (e) {
          setIsLegacyNote(true);
        }
      } else {
        // No note exists, prepare default state
        setSelectedNote(null);
        const event = events.find(e => e.id === selectedEventId);
        setMeetingState({
          ...DEFAULT_STRUCTURE,
          data: {
            ...DEFAULT_STRUCTURE.data,
            logistics: {
              ...DEFAULT_STRUCTURE.data.logistics,
              date: event ? new Date(event.when).toLocaleDateString() : '',
              time: event ? new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
              location: event?.where || ''
            }
          }
        });
        setIsLegacyNote(false);
      }
    } else {
      setSelectedNote(null);
    }
    
    // Reset Date Filters
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setCompletedEndDate(end.toISOString().split('T')[0]);
    setCompletedStartDate(start.toISOString().split('T')[0]);
  }, [selectedEventId, notes, events]);

  // --- Actions ---

  const createEvent = () => {
    if (!newEventTitle.trim()) return;
    const newEvent: Event = {
      id: Math.random().toString(),
      title: newEventTitle,
      when: new Date().toISOString(),
      isHidden: false
    };
    setEvents([newEvent, ...events]);
    setSelectedEventId(newEvent.id);
    setNewEventTitle('');
    createNoteForEvent(newEvent);
  };

  const createNoteForEvent = (event: Event) => {
    const initialState = {
      ...DEFAULT_STRUCTURE,
      data: {
        ...DEFAULT_STRUCTURE.data,
        logistics: {
          date: new Date(event.when).toLocaleDateString(),
          time: new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          location: event.where || '',
          link: ''
        }
      }
    };
    
    const note: MeetingNote = {
      id: Math.random().toString(),
      title: event.title,
      date: event.when,
      content: JSON.stringify(initialState),
      linkedTaskIds: [],
      linkedEventIds: [event.id],
      forWho: ''
    };
    
    setNotes([note, ...notes]);
    setSelectedNote(note);
    setMeetingState(initialState);
  };

  const updateMeetingState = useCallback((newState: MeetingStructure) => {
    setMeetingState(newState);
    if (selectedNote) {
      const updatedNote = { ...selectedNote, content: JSON.stringify(newState) };
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? updatedNote : n));
    }
  }, [selectedNote, setNotes]);

  const updateNoteForWho = (newForWho: string) => {
      if (!selectedNote) return;
      const updated = { ...selectedNote, forWho: newForWho };
      setSelectedNote(updated);
      setNotes(notes.map(n => n.id === updated.id ? updated : n));
  };

  // --- Task Management Logic ---

  const handleCreateTask = () => {
    if (!newTaskTitle.trim() || !selectedNote) return;

    const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        shortDescription: newTaskTitle,
        longDescription: `Action item from meeting: ${selectedNote.title}`,
        status: TaskStatus.TODO,
        importance: Importance.MEDIUM,
        urgency: Urgency.MEDIUM,
        attachments: [],
        boardId: 'meeting-action-items',
        updates: [],
        forWho: selectedNote.forWho, // Context
        assignee: 'Unassigned'
    };

    setTasks(prev => [...prev, newTask]);
    
    const updatedNote = {
        ...selectedNote,
        linkedTaskIds: [...selectedNote.linkedTaskIds, newTask.id]
    };
    setSelectedNote(updatedNote);
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    setNewTaskTitle('');
  };

  const toggleTaskLink = (taskId: string) => {
    if (!selectedNote) return;
    const currentLinks = selectedNote.linkedTaskIds;
    const newLinks = currentLinks.includes(taskId) 
        ? currentLinks.filter(id => id !== taskId)
        : [...currentLinks, taskId];
    
    const updated = { ...selectedNote, linkedTaskIds: newLinks };
    setSelectedNote(updated);
    setNotes(notes.map(n => n.id === updated.id ? updated : n));
  };

  const removeLinkedTask = (taskId: string) => {
    if (!selectedNote) return;
    const updated = { 
        ...selectedNote, 
        linkedTaskIds: selectedNote.linkedTaskIds.filter(id => id !== taskId) 
    };
    setSelectedNote(updated);
    setNotes(notes.map(n => n.id === updated.id ? updated : n));
  };

  // Sync edits from document Action Items table back to global Tasks
  const updateTaskFromDocument = (taskId: string, field: keyof Task, value: any) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  // --- Derived Data (Filters) ---

  const forWhoOptions = useMemo(() => {
    const options = new Set<string>();
    tasks.forEach(t => { if (t.forWho) options.add(t.forWho); });
    return Array.from(options).sort();
  }, [tasks]);

  const passesAssigneeFilter = (task: Task) => {
      if (taskFilterType === 'all') return true;
      if (taskFilterType === 'unassigned') return !task.assignee || task.assignee.toLowerCase() === 'unassigned';
      if (taskFilterType === 'me') return task.assignee && (task.assignee.toLowerCase() === 'me' || task.assignee.toLowerCase().includes('me'));
      return true;
  };

  const relatedCompletedTasks = useMemo(() => {
      if (!selectedNote?.forWho) return [];
      const start = new Date(completedStartDate); start.setHours(0,0,0,0);
      const end = new Date(completedEndDate); end.setHours(23,59,59,999);
      return tasks.filter(t => {
          if (t.status !== TaskStatus.DONE) return false;
          if (t.forWho !== selectedNote.forWho) return false;
          if (!passesAssigneeFilter(t)) return false;
          const completeDate = t.completedAt ? new Date(t.completedAt) : (t.when ? new Date(t.when) : null);
          if (!completeDate) return false;
          return completeDate >= start && completeDate <= end;
      });
  }, [tasks, selectedNote?.forWho, completedStartDate, completedEndDate, taskFilterType]);

  const relatedIncompleteTasks = useMemo(() => {
      if (!selectedNote?.forWho) return [];
      const today = new Date(); today.setHours(0,0,0,0);
      let futureCutoff = new Date();
      if (futureLookahead === 9999) futureCutoff.setFullYear(today.getFullYear() + 100);
      else futureCutoff.setDate(today.getDate() + futureLookahead);
      futureCutoff.setHours(23,59,59,999);

      return tasks.filter(t => {
          if (t.status === TaskStatus.DONE) return false;
          if (t.forWho !== selectedNote.forWho) return false;
          if (selectedNote.linkedTaskIds.includes(t.id)) return false; // Already linked
          if (!passesAssigneeFilter(t)) return false;
          if (!t.when) return true;
          const dueDate = new Date(t.when);
          if (dueDate < today) return true;
          if (dueDate >= today && dueDate <= futureCutoff) return true;
          return false;
      });
  }, [tasks, selectedNote?.forWho, futureLookahead, selectedNote?.linkedTaskIds, taskFilterType]);

  const linkedTasksObjects = useMemo(() => {
      if (!selectedNote) return [];
      return selectedNote.linkedTaskIds
        .map(id => tasks.find(t => t.id === id))
        .filter((t): t is Task => !!t);
  }, [selectedNote?.linkedTaskIds, tasks]);


  // --- Form Handlers ---

  const toggleSection = (section: keyof MeetingStructure['visible']) => {
    const newState = {
      ...meetingState,
      visible: {
        ...meetingState.visible,
        [section]: !meetingState.visible[section]
      }
    };
    updateMeetingState(newState);
  };

  const updateData = (section: keyof MeetingData, field: string | null, value: any) => {
    const newState = { ...meetingState };
    if (field) {
      (newState.data[section] as any)[field] = value;
    } else {
      (newState.data as any)[section] = value;
    }
    updateMeetingState(newState);
  };

  const updateNestedData = (section: keyof MeetingData, subSection: string, value: string) => {
     const newState = { ...meetingState };
     (newState.data[section] as any)[subSection] = value;
     updateMeetingState(newState);
  };

  // Agenda Item Handlers
  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      id: Math.random().toString(),
      time: '10m',
      topic: '',
      owner: '',
      outcome: '',
      notes: '',
      attachments: []
    };
    updateData('agenda', null, [...meetingState.data.agenda, newItem]);
  };

  const removeAgendaItem = (id: string) => {
    updateData('agenda', null, meetingState.data.agenda.filter(i => i.id !== id));
  };

  const updateAgendaItem = (id: string, field: keyof AgendaItem, value: any) => {
    const newAgenda = meetingState.data.agenda.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateData('agenda', null, newAgenda);
  };

  // Report Item Handlers (Generic for Admin and Committee)
  const addReportItem = (type: 'reports' | 'adminReports') => {
    const newItem: ReportItem = {
        id: Math.random().toString(),
        title: '',
        owner: '',
        content: '',
        attachments: []
    };
    updateData(type, null, [...meetingState.data[type], newItem]);
  };

  const removeReportItem = (type: 'reports' | 'adminReports', id: string) => {
    updateData(type, null, meetingState.data[type].filter(i => i.id !== id));
  };

  const updateReportItem = (type: 'reports' | 'adminReports', id: string, field: keyof ReportItem, value: any) => {
    const newReports = meetingState.data[type].map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateData(type, null, newReports);
  };

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, itemId: string, type: 'agenda' | 'reports' | 'adminReports') => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              const newAttachment: Attachment = {
                  id: Math.random().toString(),
                  name: file.name,
                  type: file.type.startsWith('image') ? 'image' : 'file',
                  url: result
              };
              
              const list = meetingState.data[type];
              const item = list.find(i => i.id === itemId);
              if(item) {
                  const updatedAttachments = [...(item.attachments || []), newAttachment];
                  // TS hack because `agenda` and `reports` share similar structure but diff types
                  if (type === 'agenda') {
                      updateAgendaItem(itemId, 'attachments', updatedAttachments);
                  } else {
                      updateReportItem(type, itemId, 'attachments', updatedAttachments);
                  }
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const removeAttachment = (itemId: string, attId: string, type: 'agenda' | 'reports' | 'adminReports') => {
      const list = meetingState.data[type];
      const item = list.find(i => i.id === itemId);
      if(item) {
          const updatedAttachments = item.attachments.filter(a => a.id !== attId);
           if (type === 'agenda') {
                updateAgendaItem(itemId, 'attachments', updatedAttachments);
            } else {
                updateReportItem(type, itemId, 'attachments', updatedAttachments);
            }
      }
  };

  const filteredEvents = events
    .filter(e => showHidden || !e.isHidden)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // --- Render Helpers ---

  const SectionToggle = ({ label, section }: { label: string, section: keyof MeetingStructure['visible'] }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100">
      <span className="text-sm text-slate-700 font-medium">{label}</span>
      <button 
        onClick={() => toggleSection(section)}
        className={`w-10 h-5 rounded-full relative transition-colors ${meetingState.visible[section] ? 'bg-sky-500' : 'bg-slate-200'}`}
      >
        <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${meetingState.visible[section] ? 'left-6' : 'left-1'}`}></div>
      </button>
    </div>
  );

  const InputField = ({ value, onChange, placeholder, className = "" }: any) => (
    <input 
      className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none py-1 transition-colors text-slate-800 placeholder-slate-400 ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );

  // Reusable Report Renderer
  const renderReports = (type: 'reports' | 'adminReports', title: string) => (
      <section>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
            <span>{title}</span>
            <button onClick={() => addReportItem(type)} className="text-sky-600 hover:text-sky-800 text-[10px] font-bold bg-sky-50 px-2 py-1 rounded">
            <i className="fas fa-plus mr-1"></i> ADD REPORT
            </button>
        </h3>
        <div className="space-y-4">
            {meetingState.data[type].map(item => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm group">
                    <div className="flex gap-3 mb-2">
                        <input 
                        className="flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                        placeholder="Committee / Report Name"
                        value={item.title}
                        onChange={e => updateReportItem(type, item.id, 'title', e.target.value)}
                        />
                        <input 
                        className="w-1/3 text-slate-600 bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                        placeholder="Presented By"
                        value={item.owner}
                        onChange={e => updateReportItem(type, item.id, 'owner', e.target.value)}
                        />
                        <button onClick={() => removeReportItem(type, item.id)} className="text-slate-300 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                    <textarea 
                        className="w-full text-sm text-slate-700 bg-slate-50 p-2 rounded border border-transparent focus:bg-white focus:border-slate-300 focus:outline-none resize-none"
                        rows={3}
                        placeholder="Status, Financials, Actions..."
                        value={item.content}
                        onChange={e => updateReportItem(type, item.id, 'content', e.target.value)}
                    />
                    {/* Report Attachments */}
                    <div className="flex flex-wrap gap-2 items-center mt-2">
                        {item.attachments?.map(att => (
                            <div key={att.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded border border-slate-200">
                                <i className="fas fa-paperclip text-[10px]"></i>
                                <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline max-w-[100px] truncate">{att.name}</a>
                                <button onClick={() => removeAttachment(item.id, att.id, type)} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                            </div>
                        ))}
                        <label className="cursor-pointer text-sky-600 text-xs hover:text-sky-800 flex items-center gap-1 px-1">
                            <i className="fas fa-plus-circle"></i> Attach
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, item.id, type)} />
                        </label>
                    </div>
                </div>
            ))}
            {meetingState.data[type].length === 0 && <div className="text-sm text-slate-400 italic">No reports added.</div>}
        </div>
      </section>
  );

  return (
    <div className="flex h-full flex-col md:flex-row bg-slate-50 overflow-hidden">
      
      {/* 1. LEFT PANE: Navigation */}
      <div 
        className={`${isSidebarOpen ? 'md:w-72 border-r' : 'md:w-0 md:overflow-hidden'} ${selectedEventId ? 'hidden md:flex' : 'flex'} bg-white border-slate-200 flex-col transition-all duration-300 ease-in-out z-10`}
      >
        <div className="p-4 border-b border-slate-200 bg-slate-50">
           <h2 className="text-lg font-bold mb-3 text-slate-800">Events</h2>
           <div className="flex gap-2 mb-3">
              <input 
                  className="flex-1 border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white text-slate-900"
                  placeholder="New Meeting..."
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createEvent()}
              />
              <button onClick={createEvent} className="bg-sky-600 text-white px-2 rounded hover:bg-sky-700">
                  <i className="fas fa-plus"></i>
              </button>
           </div>
           <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="rounded text-sky-600" />
              Show Hidden
           </label>
        </div>
        <div className="flex-1 overflow-y-auto">
           {filteredEvents.map(event => (
               <div 
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`p-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${selectedEventId === event.id ? 'bg-sky-50 border-l-4 border-l-sky-500' : ''}`}
               >
                   <div className="font-semibold text-slate-800 text-sm truncate">{event.title}</div>
                   <div className="text-xs text-slate-500 mt-1">{new Date(event.when).toLocaleDateString()}</div>
               </div>
           ))}
        </div>
      </div>

      {/* 2. CENTER PANE: The Builder */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden relative ${!selectedEventId ? 'hidden md:flex' : 'flex'}`}>
         {selectedEvent ? (
            <>
               {/* Mobile Header */}
               <div className="md:hidden bg-white p-3 border-b flex items-center gap-3">
                  <button onClick={() => setSelectedEventId(null)} className="text-slate-500"><i className="fas fa-arrow-left"></i></button>
                  <h3 className="font-bold truncate">{selectedEvent.title}</h3>
               </div>

               {/* Toolbar */}
               <div className="bg-white border-b border-slate-200 p-3 flex justify-between items-center shadow-sm z-20">
                  <div className="flex items-center gap-3">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:block text-slate-400 hover:text-sky-600">
                        <i className={`fas ${isSidebarOpen ? 'fa-compress' : 'fa-expand'}`}></i>
                     </button>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Meeting Agenda</span>
                  </div>
                  <div className="flex items-center gap-2">
                      {isLegacyNote && (
                        <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          <i className="fas fa-exclamation-triangle mr-1"></i> Legacy Format
                        </div>
                      )}
                      <button 
                        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} 
                        className={`text-slate-500 hover:text-sky-600 p-1 ${!isRightSidebarOpen ? 'text-sky-600' : ''}`}
                        title="Toggle Right Sidebar"
                      >
                          <i className="fas fa-columns"></i>
                      </button>
                  </div>
               </div>

               {/* Document Area */}
               <div className="flex-1 overflow-y-auto p-4 md:p-8">
                  {isLegacyNote ? (
                     <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow border border-slate-200">
                        <h2 className="text-xl font-bold mb-4">Legacy Note</h2>
                        <div dangerouslySetInnerHTML={{ __html: selectedNote?.content || '' }} className="prose prose-sm max-w-none text-slate-800" />
                        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                           <p className="text-sm text-slate-500 mb-2">This note was created with the old editor.</p>
                           <button 
                              onClick={() => {
                                if(confirm("This will overwrite current content with the new builder structure. Continue?")) {
                                   setIsLegacyNote(false);
                                   updateMeetingState(DEFAULT_STRUCTURE);
                                }
                              }} 
                              className="text-xs text-red-500 hover:underline"
                           >
                              Reset to Builder Format
                           </button>
                        </div>
                     </div>
                  ) : selectedNote ? (
                     <div className="max-w-3xl mx-auto bg-white min-h-[800px] shadow-sm border border-slate-200 rounded-xl p-8 md:p-12 space-y-8">
                        
                        {/* Title & Context */}
                        <div className="border-b border-slate-100 pb-4">
                           <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedEvent.title}</h1>
                           <div className="flex flex-wrap items-center gap-4">
                                <div className="h-1 w-20 bg-sky-500 rounded-full"></div>
                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                    <i className="fas fa-tag text-slate-400 text-xs"></i>
                                    <input 
                                        list="note-forwho-options"
                                        className="bg-transparent border-none text-xs font-bold text-slate-600 uppercase tracking-wide focus:ring-0 placeholder-slate-400 w-32"
                                        placeholder="ADD CONTEXT"
                                        value={selectedNote.forWho || ''}
                                        onChange={(e) => updateNoteForWho(e.target.value)}
                                    />
                                    <datalist id="note-forwho-options">
                                        {forWhoOptions.map(opt => <option key={opt} value={opt} />)}
                                    </datalist>
                                </div>
                           </div>
                        </div>

                        {/* Mission Statement (Board Style) */}
                        {meetingState.visible.mission && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mission Statement</h3>
                              <textarea 
                                  className="w-full bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm italic text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                                  rows={3}
                                  placeholder="Enter organization mission..."
                                  value={meetingState.data.missionStatement}
                                  onChange={e => updateData('missionStatement', null, e.target.value)}
                               />
                           </section>
                        )}
                        
                        {/* Call to Order (Board Style) */}
                        {meetingState.visible.callToOrder && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Call to Order</h3>
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Chairman / Called By</label>
                                        <InputField value={meetingState.data.callToOrder.chairman} onChange={(v:string) => updateNestedData('callToOrder', 'chairman', v)} placeholder="Name" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Time Called</label>
                                        <InputField value={meetingState.data.callToOrder.time} onChange={(v:string) => updateNestedData('callToOrder', 'time', v)} placeholder="00:00 PM" />
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Logistics */}
                        {meetingState.visible.logistics && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Logistics</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                                    <InputField value={meetingState.data.logistics.date} onChange={(v:string) => updateData('logistics', 'date', v)} placeholder="YYYY-MM-DD" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Time</label>
                                    <InputField value={meetingState.data.logistics.time} onChange={(v:string) => updateData('logistics', 'time', v)} placeholder="00:00 AM" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Location</label>
                                    <InputField value={meetingState.data.logistics.location} onChange={(v:string) => updateData('logistics', 'location', v)} placeholder="Room or Address" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Link/Conf</label>
                                    <InputField value={meetingState.data.logistics.link} onChange={(v:string) => updateData('logistics', 'link', v)} placeholder="https://..." className="text-blue-600" />
                                 </div>
                              </div>
                           </section>
                        )}

                        {/* Preliminaries (Board Style) */}
                        {meetingState.visible.preliminaries && (
                           <section className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preliminaries</h3>
                               <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Parent/Public Comments</label>
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                                    placeholder="None or summary of comments..."
                                    value={meetingState.data.preliminaries.parentComments}
                                    onChange={e => updateNestedData('preliminaries', 'parentComments', e.target.value)}
                                  />
                               </div>
                               <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Prayer / Scripture</label>
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                                    placeholder="Notes..."
                                    value={meetingState.data.preliminaries.prayer}
                                    onChange={e => updateNestedData('preliminaries', 'prayer', e.target.value)}
                                  />
                               </div>
                               <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Agenda Adoption & Minutes Approval</label>
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                                    placeholder="Approved minutes from [Date]..."
                                    value={meetingState.data.preliminaries.minutesApproval}
                                    onChange={e => updateNestedData('preliminaries', 'minutesApproval', e.target.value)}
                                  />
                               </div>
                               <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Email Motions (Since Last Meeting)</label>
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                                    placeholder="List motions approved via email..."
                                    value={meetingState.data.preliminaries.emailMotions}
                                    onChange={e => updateNestedData('preliminaries', 'emailMotions', e.target.value)}
                                  />
                               </div>
                           </section>
                        )}

                        {/* Objective */}
                        {meetingState.visible.objective && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Objective (Definition of Done)</h3>
                              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                 <textarea 
                                    className="w-full bg-transparent border-none focus:ring-0 resize-none text-slate-800 placeholder-slate-400"
                                    rows={2}
                                    placeholder="We will leave this meeting with..."
                                    value={meetingState.data.objective}
                                    onChange={e => updateData('objective', null, e.target.value)}
                                 />
                              </div>
                           </section>
                        )}

                        {/* Roles */}
                        {meetingState.visible.roles && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Roles</h3>
                              <div className="grid grid-cols-3 gap-4">
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Facilitator</label>
                                    <InputField value={meetingState.data.roles.facilitator} onChange={(v:string) => updateData('roles', 'facilitator', v)} placeholder="Name" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Note Taker</label>
                                    <InputField value={meetingState.data.roles.noteTaker} onChange={(v:string) => updateData('roles', 'noteTaker', v)} placeholder="Name" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Timekeeper</label>
                                    <InputField value={meetingState.data.roles.timeKeeper} onChange={(v:string) => updateData('roles', 'timeKeeper', v)} placeholder="Name" />
                                 </div>
                              </div>
                           </section>
                        )}

                        {/* Attendees */}
                        {meetingState.visible.attendees && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Attendance</h3>
                              <div className="space-y-3">
                                 <div className="flex gap-4 items-baseline">
                                    <span className="text-xs font-bold text-green-600 w-24">Present:</span>
                                    <InputField value={meetingState.data.attendees.present} onChange={(v:string) => updateData('attendees', 'present', v)} placeholder="List names..." />
                                 </div>
                                 <div className="flex gap-4 items-baseline">
                                    <span className="text-xs font-bold text-slate-500 w-24">Ex-Officio:</span>
                                    <InputField value={meetingState.data.attendees.exOfficio} onChange={(v:string) => updateData('attendees', 'exOfficio', v)} placeholder="Head of School, Principal..." />
                                 </div>
                                 <div className="flex gap-4 items-baseline">
                                    <span className="text-xs font-bold text-red-400 w-24">Absent:</span>
                                    <InputField value={meetingState.data.attendees.absent} onChange={(v:string) => updateData('attendees', 'absent', v)} placeholder="List names..." />
                                 </div>
                                 <div className="flex gap-4 items-baseline">
                                    <span className="text-xs font-bold text-slate-400 w-24">Guests:</span>
                                    <InputField value={meetingState.data.attendees.guests} onChange={(v:string) => updateData('attendees', 'guests', v)} placeholder="List guests..." />
                                 </div>
                              </div>
                           </section>
                        )}

                        {/* Admin Reports */}
                        {meetingState.visible.adminReports && renderReports('adminReports', 'Administration Reports')}

                        {/* Committee Reports */}
                        {meetingState.visible.reports && renderReports('reports', 'Committee Reports')}

                        {/* Agenda Items (New Business) */}
                        {meetingState.visible.agenda && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                                 <span>{meetingState.visible.reports ? 'New Business' : 'Agenda Items'}</span>
                                 <button onClick={addAgendaItem} className="text-sky-600 hover:text-sky-800 text-[10px] font-bold bg-sky-50 px-2 py-1 rounded">
                                    <i className="fas fa-plus mr-1"></i> ADD TOPIC
                                 </button>
                              </h3>
                              <div className="space-y-4">
                                 {meetingState.data.agenda.length === 0 && <div className="text-sm text-slate-400 italic">No items yet.</div>}
                                 {meetingState.data.agenda.map((item) => (
                                    <div key={item.id} className="group border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors bg-white shadow-sm">
                                        <div className="flex gap-2 mb-2 items-start">
                                            <input 
                                              className="w-16 text-xs font-bold text-slate-500 text-center bg-slate-50 rounded py-1 border border-transparent focus:border-sky-500 focus:outline-none"
                                              placeholder="10m"
                                              value={item.time}
                                              onChange={e => updateAgendaItem(item.id, 'time', e.target.value)}
                                            />
                                            {/* Stylized Input: Dark text on light BG with border */}
                                            <input 
                                              className="flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                                              placeholder="Topic Title..."
                                              value={item.topic}
                                              onChange={e => updateAgendaItem(item.id, 'topic', e.target.value)}
                                            />
                                            {/* Stylized Input: Dark text on light BG with border */}
                                            <input 
                                              className="w-24 text-xs text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 focus:border-sky-500 focus:outline-none text-right"
                                              placeholder="Owner"
                                              value={item.owner}
                                              onChange={e => updateAgendaItem(item.id, 'owner', e.target.value)}
                                            />
                                            <button onClick={() => removeAgendaItem(item.id)} className="text-slate-300 hover:text-red-500 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                               <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                        <div className="pl-20 space-y-2">
                                            <div className="flex gap-2 items-baseline text-xs">
                                                <span className="font-bold text-slate-400">Outcome:</span>
                                                <input 
                                                   className="flex-1 bg-transparent focus:outline-none text-slate-600 border-b border-dotted border-slate-300 focus:border-sky-500"
                                                   placeholder="Decision, Info, etc."
                                                   value={item.outcome}
                                                   onChange={e => updateAgendaItem(item.id, 'outcome', e.target.value)}
                                                />
                                            </div>
                                            <textarea 
                                                className="w-full text-sm text-slate-700 bg-slate-50 p-2 rounded border-none focus:ring-1 focus:ring-slate-300 resize-none"
                                                rows={2}
                                                placeholder="Discussion notes..."
                                                value={item.notes}
                                                onChange={e => updateAgendaItem(item.id, 'notes', e.target.value)}
                                            />
                                            
                                            {/* Agenda Attachments */}
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {item.attachments?.map(att => (
                                                    <div key={att.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded border border-slate-200">
                                                        <i className="fas fa-paperclip text-[10px]"></i>
                                                        <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline max-w-[100px] truncate">{att.name}</a>
                                                        <button onClick={() => removeAttachment(item.id, att.id, 'agenda')} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                                                    </div>
                                                ))}
                                                <label className="cursor-pointer text-sky-600 text-xs hover:text-sky-800 flex items-center gap-1 px-1">
                                                    <i className="fas fa-plus-circle"></i> Attach
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, item.id, 'agenda')} />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                 ))}
                              </div>
                           </section>
                        )}

                        {/* Linked Action Items (Synced to Global Tasks) */}
                        {meetingState.visible.actions && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                                 <span>Action Items (Linked Tasks)</span>
                                 <span className="text-[10px] text-slate-400 font-normal">Manage in sidebar &rarr;</span>
                              </h3>
                              <div className="bg-slate-50 rounded-lg border border-slate-100 p-2">
                                 <table className="w-full text-sm text-left">
                                     <thead className="text-xs text-slate-500 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="pb-2 pl-2 w-1/3">Task</th>
                                            <th className="pb-2 w-1/4">Owner (Assignee)</th>
                                            <th className="pb-2 w-1/4">Context (For Who)</th>
                                            <th className="pb-2 w-1/6">Due</th>
                                            <th className="pb-2 w-12"></th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                         {linkedTasksObjects.map(task => (
                                             <tr key={task.id} className="group hover:bg-white transition-colors">
                                                 <td className="py-1 pr-2">
                                                     <div className="flex items-center gap-2">
                                                         <button 
                                                            onClick={() => updateTaskFromDocument(task.id, 'status', task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)}
                                                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${task.status === TaskStatus.DONE ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'}`}
                                                         >
                                                             {task.status === TaskStatus.DONE && <i className="fas fa-check text-white text-[10px]"></i>}
                                                         </button>
                                                         <input 
                                                            className={`w-full bg-transparent py-1 border-b border-transparent focus:border-sky-500 focus:outline-none ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : 'text-slate-800'}`}
                                                            value={task.shortDescription}
                                                            onChange={e => updateTaskFromDocument(task.id, 'shortDescription', e.target.value)}
                                                         />
                                                     </div>
                                                 </td>
                                                 <td className="py-1 pr-2">
                                                     <input 
                                                        className="w-full bg-transparent py-1 border-b border-transparent focus:border-sky-500 focus:outline-none text-xs text-slate-500"
                                                        value={task.assignee || ''}
                                                        onChange={e => updateTaskFromDocument(task.id, 'assignee', e.target.value)}
                                                        placeholder="Unassigned"
                                                     />
                                                 </td>
                                                 <td className="py-1 pr-2">
                                                     <input 
                                                        className="w-full bg-transparent py-1 border-b border-transparent focus:border-sky-500 focus:outline-none text-xs text-slate-500"
                                                        value={task.forWho || ''}
                                                        onChange={e => updateTaskFromDocument(task.id, 'forWho', e.target.value)}
                                                        placeholder="Context"
                                                     />
                                                 </td>
                                                 <td className="py-1">
                                                     <input 
                                                        type="date"
                                                        className="w-full bg-transparent py-1 border-b border-transparent focus:border-sky-500 focus:outline-none text-xs text-slate-500"
                                                        value={task.when ? task.when.split('T')[0] : ''}
                                                        onChange={e => updateTaskFromDocument(task.id, 'when', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                                                     />
                                                 </td>
                                                 <td className="py-1 text-right flex gap-1 justify-end">
                                                     <button onClick={() => onEditTask?.(task)} className="text-slate-300 hover:text-sky-600 opacity-0 group-hover:opacity-100">
                                                         <i className="fas fa-pencil-alt"></i>
                                                     </button>
                                                     <button onClick={() => removeLinkedTask(task.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100" title="Unlink Task">
                                                        <i className="fas fa-unlink"></i>
                                                     </button>
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                                 {linkedTasksObjects.length === 0 && (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">
                                        No linked tasks. Use the sidebar to add action items.
                                    </div>
                                 )}
                              </div>
                           </section>
                        )}

                        {/* Executive Session & Tabled Items (Board Style) */}
                        {(meetingState.visible.executiveSession || meetingState.visible.tabledItems) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {meetingState.visible.executiveSession && (
                                    <section className="bg-red-50 p-4 rounded-lg border border-red-100">
                                        <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <i className="fas fa-user-secret"></i> Executive Session
                                        </h3>
                                        <textarea 
                                            className="w-full bg-white/50 border border-red-200 rounded p-2 text-sm text-red-900 focus:outline-none focus:ring-1 focus:ring-red-500 h-24 resize-none"
                                            placeholder="Confidential notes..."
                                            value={meetingState.data.executiveSession}
                                            onChange={e => updateData('executiveSession', null, e.target.value)}
                                        />
                                    </section>
                                )}
                                {meetingState.visible.tabledItems && (
                                    <section className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Tabled / Pending Items</h3>
                                        <textarea 
                                            className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500 h-24 resize-none"
                                            placeholder="Items for next meeting..."
                                            value={meetingState.data.tabledItems}
                                            onChange={e => updateData('tabledItems', null, e.target.value)}
                                        />
                                    </section>
                                )}
                            </div>
                        )}

                        {/* Parking Lot */}
                        {meetingState.visible.parkingLot && (
                           <section>
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Parking Lot</h3>
                              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                 <textarea 
                                    className="w-full bg-transparent border-none focus:ring-0 resize-none text-slate-800 placeholder-slate-400 text-sm"
                                    rows={3}
                                    placeholder="Off-topic items to discuss later..."
                                    value={meetingState.data.parkingLot}
                                    onChange={e => updateData('parkingLot', null, e.target.value)}
                                 />
                              </div>
                           </section>
                        )}

                        {/* Closing */}
                        {meetingState.visible.closing && (
                           <section className="border-t border-slate-100 pt-6">
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Closing / Adjournment</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Adjourned At</label>
                                      <InputField value={meetingState.data.closing.adjournmentTime} onChange={(v:string) => updateNestedData('closing', 'adjournmentTime', v)} placeholder="Time" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Closing Prayer By</label>
                                      <InputField value={meetingState.data.closing.prayerBy} onChange={(v:string) => updateNestedData('closing', 'prayerBy', v)} placeholder="Name" />
                                  </div>
                                   <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Submitted By</label>
                                      <InputField value={meetingState.data.closing.submittedBy} onChange={(v:string) => updateNestedData('closing', 'submittedBy', v)} placeholder="Secretary Name" />
                                  </div>
                              </div>
                              <div className="flex flex-wrap gap-8">
                                 <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-700">Effectiveness Rating:</span>
                                    <div className="flex gap-1">
                                        {[1,2,3,4,5].map(star => (
                                            <button 
                                              key={star}
                                              onClick={() => updateData('closing', 'rating', star)}
                                              className={`text-lg ${star <= meetingState.data.closing.rating ? 'text-yellow-400' : 'text-slate-200'} hover:scale-110 transition`}
                                            >
                                                <i className="fas fa-star"></i>
                                            </button>
                                        ))}
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     <span className="text-sm font-bold text-slate-700">Next Meeting:</span>
                                     <InputField 
                                        className="w-40"
                                        value={meetingState.data.closing.nextMeetingDate} 
                                        onChange={(v:string) => updateData('closing', 'nextMeetingDate', v)} 
                                        placeholder="Date & Time" 
                                     />
                                 </div>
                              </div>
                           </section>
                        )}
                        
                     </div>
                  ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <i className="fas fa-calendar-alt text-4xl mb-4 text-slate-300"></i>
                        <p>Select an event to start planning</p>
                        <button onClick={() => selectedEventId && createNoteForEvent(selectedEvent)} className="mt-4 text-sky-600 font-bold hover:underline">
                           Create Agenda
                        </button>
                     </div>
                  )}
               </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
               <i className="fas fa-calendar-day text-5xl mb-4"></i>
               <p className="text-lg">Select a meeting from the list</p>
            </div>
         )}
      </div>

      {/* 3. RIGHT PANE: Tabs for Tasks / Config */}
      {selectedNote && !isLegacyNote && isRightSidebarOpen && (
         <div className="w-80 bg-white border-l border-slate-200 flex-col hidden xl:flex shadow-sm z-30 flex-shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('tasks')}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'tasks' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Tasks & Context
                </button>
                <button 
                    onClick={() => setActiveTab('template')}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'template' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Template
                </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50">
                
                {/* --- TAB: TASKS --- */}
                {activeTab === 'tasks' && (
                    <div className="p-4 space-y-6">
                        {/* Task Content (Unchanged) */}
                        
                        {/* Quick Add */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-sky-900 text-xs uppercase mb-2">Quick Add Action Item</h4>
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                    placeholder="Task description..."
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                                />
                                <button onClick={handleCreateTask} className="bg-sky-600 text-white px-3 rounded hover:bg-sky-700 font-bold">
                                    <i className="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>

                        {/* Filter Controls */}
                        <div className="flex items-center justify-between text-xs px-1">
                             <span className="font-bold text-slate-500">Filter By:</span>
                             <select 
                                className="bg-white border border-slate-300 rounded p-1 text-slate-700 outline-none"
                                value={taskFilterType}
                                onChange={(e) => setTaskFilterType(e.target.value as any)}
                             >
                                 <option value="all">All Assignees</option>
                                 <option value="me">Assigned to Me</option>
                                 <option value="unassigned">Unassigned</option>
                             </select>
                        </div>

                        {/* Link Existing */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-700 text-xs uppercase mb-2">Link Existing Task</h4>
                            <input 
                                type="text" 
                                placeholder="Search tasks..." 
                                className="w-full text-xs p-2 border border-slate-300 rounded bg-slate-50 text-slate-800 outline-none focus:ring-1 focus:ring-sky-500 mb-2"
                                value={taskLinkSearch}
                                onChange={(e) => setTaskLinkSearch(e.target.value)}
                            />
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {tasks.filter(t => t.status !== TaskStatus.DONE && !selectedNote.linkedTaskIds.includes(t.id)).filter(t => 
                                    (!taskLinkSearch || 
                                    t.shortDescription.toLowerCase().includes(taskLinkSearch.toLowerCase()) || 
                                    (t.forWho && t.forWho.toLowerCase().includes(taskLinkSearch.toLowerCase()))) &&
                                    passesAssigneeFilter(t)
                                ).map(task => (
                                    <div 
                                        key={task.id} 
                                        onClick={() => toggleTaskLink(task.id)}
                                        className="p-2 rounded border border-slate-100 hover:bg-sky-50 cursor-pointer flex items-center justify-between group"
                                    >
                                        <div className="truncate text-xs text-slate-700 flex-1">{task.shortDescription}</div>
                                        <i className="fas fa-link text-slate-300 group-hover:text-sky-500 text-xs"></i>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Related Incomplete */}
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-orange-800 text-xs uppercase">Related Pending</h4>
                                <select 
                                    className="text-[10px] border border-orange-300 rounded bg-white p-0.5 text-slate-700 outline-none"
                                    value={futureLookahead}
                                    onChange={(e) => setFutureLookahead(parseInt(e.target.value))}
                                >
                                    <option value={7}>1 Week</option>
                                    <option value={30}>1 Month</option>
                                    <option value={9999}>All</option>
                                </select>
                            </div>
                            {selectedNote.forWho ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {relatedIncompleteTasks.map(task => (
                                        <div key={task.id} className="bg-white p-2 rounded border border-orange-100 flex gap-2">
                                            <div className="flex-1">
                                                <div className="text-xs font-medium text-slate-800 leading-tight">{task.shortDescription}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    {task.when ? new Date(task.when).toLocaleDateString() : 'Undated'} • {task.assignee || 'Unassigned'}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                 <button onClick={() => toggleTaskLink(task.id)} className="text-sky-500 hover:text-sky-700" title="Link to Meeting">
                                                     <i className="fas fa-link text-xs"></i>
                                                 </button>
                                                 <button onClick={() => onEditTask?.(task)} className="text-slate-300 hover:text-orange-500">
                                                     <i className="fas fa-pencil-alt text-xs"></i>
                                                 </button>
                                            </div>
                                        </div>
                                    ))}
                                    {relatedIncompleteTasks.length === 0 && <div className="text-xs text-orange-400 italic text-center">No related tasks found.</div>}
                                </div>
                            ) : (
                                <div className="text-xs text-orange-400 italic">Add 'Context' to header to see related tasks.</div>
                            )}
                        </div>

                         {/* Related Completed */}
                         <div className="bg-green-50 p-3 rounded-lg border border-green-200 shadow-sm">
                            <h4 className="font-bold text-green-800 text-xs uppercase mb-2">History (Completed)</h4>
                             <div className="flex gap-1 mb-2">
                                <input type="date" className="w-1/2 text-[10px] p-1 border rounded text-slate-900 bg-white" value={completedStartDate} onChange={e => setCompletedStartDate(e.target.value)} />
                                <input type="date" className="w-1/2 text-[10px] p-1 border rounded text-slate-900 bg-white" value={completedEndDate} onChange={e => setCompletedEndDate(e.target.value)} />
                             </div>
                            {selectedNote.forWho ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {relatedCompletedTasks.map(task => (
                                        <div key={task.id} className="bg-white p-2 rounded border border-green-100 opacity-75 text-xs">
                                            <div className="line-through text-slate-600">{task.shortDescription}</div>
                                            <div className="text-[10px] text-green-600 mt-0.5">Done: {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Unknown'}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-green-400 italic">Add 'Context' to header to see history.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB: TEMPLATE --- */}
                {activeTab === 'template' && (
                    <div className="p-4 space-y-1">
                        <SectionToggle label="Mission Statement" section="mission" />
                        <SectionToggle label="Call to Order" section="callToOrder" />
                        <SectionToggle label="Logistics" section="logistics" />
                        <SectionToggle label="Preliminaries" section="preliminaries" />
                        <SectionToggle label="Objective" section="objective" />
                        <SectionToggle label="Roles" section="roles" />
                        <SectionToggle label="Attendance" section="attendees" />
                        <SectionToggle label="Admin Reports" section="adminReports" />
                        <SectionToggle label="Committee Reports" section="reports" />
                        <SectionToggle label="Agenda / New Business" section="agenda" />
                        <SectionToggle label="Action Items" section="actions" />
                        <SectionToggle label="Executive Session" section="executiveSession" />
                        <SectionToggle label="Tabled Items" section="tabledItems" />
                        <SectionToggle label="Parking Lot" section="parkingLot" />
                        <SectionToggle label="Closing" section="closing" />
                    </div>
                )}
            </div>
         </div>
      )}
    </div>
  );
};