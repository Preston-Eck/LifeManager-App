
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MeetingNote, Task, Event, TaskStatus, Urgency, Importance, Attachment } from '../types';

// --- Types for Structured Data ---

interface AgendaItem {
  id: string;
  time: string; // Kept for legacy compatibility, but UI will focus on actualDuration
  topic: string;
  owner: string;
  outcome: string;
  notes: string;
  attachments: Attachment[];
  timerStart?: number; // Timestamp when timer started
  actualDuration?: number; // Total duration in ms
}

interface ReportItem {
  id: string;
  title: string;
  owner: string;
  content: string; 
  attachments: Attachment[];
  timerStart?: number;
  duration?: number; // Total duration in ms
}

interface MeetingData {
  missionStatement: string;
  callToOrder: { 
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
    scripture: { 
        reference: string;
        discussion: string;
    };
    prayer: string;
    prayerNotes: string; 
    minutesApproval: string;
    emailMotions: string; 
    parentComments: ReportItem[]; 
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
    exOfficio: string; 
    guests: string; 
  };
  adminReports: ReportItem[]; 
  reports: ReportItem[]; // Committee Reports
  agenda: AgendaItem[]; // "New Business"
  executiveSession: { 
      content: string;
      timerStart?: number;
      duration?: number;
  };
  tabledItems: string;
  parkingLot: string;
  closing: {
    rating: number;
    nextMeetingDate: string;
    adjournmentTime: string; 
    prayerBy: string; 
    submittedBy: string; 
  };
}

interface MeetingStructure {
  version: 1;
  visible: {
    mission: boolean;
    callToOrder: boolean;
    logistics: boolean;
    preliminaries: boolean;
    objective: boolean;
    roles: boolean;
    attendees: boolean;
    adminReports: boolean; 
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
    preliminaries: { 
        scripture: { reference: '', discussion: '' },
        prayer: '', 
        prayerNotes: '',
        minutesApproval: '', 
        emailMotions: '',
        parentComments: [] 
    },
    objective: '',
    roles: { facilitator: '', noteTaker: '', timeKeeper: '' },
    attendees: { present: '', absent: '', exOfficio: '', guests: '' },
    adminReports: [],
    reports: [],
    agenda: [],
    executiveSession: { content: '', timerStart: undefined, duration: 0 },
    tabledItems: '',
    parkingLot: '',
    closing: { rating: 0, nextMeetingDate: '', adjournmentTime: '', prayerBy: '', submittedBy: '' },
  },
};

// --- Reusable Components ---

const InputField = ({ value, onChange, placeholder, className = "" }: any) => (
  <input 
    className={`w-full bg-transparent border-b border-slate-300 hover:border-slate-400 focus:border-sky-500 focus:outline-none py-1 transition-colors text-slate-900 placeholder-slate-400 ${className}`}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
  />
);

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

  // Event Filtering State
  const [eventStartDate, setEventStartDate] = useState(() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3); 
      return d.toISOString().split('T')[0];
  });
  const [eventEndDate, setEventEndDate] = useState(() => new Date().toISOString().split('T')[0]); 

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

  // Timer State
  const [currentTime, setCurrentTime] = useState(Date.now());

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
          if (foundNote.content.trim().startsWith('{')) {
            const parsed = JSON.parse(foundNote.content);
            if (parsed.version === 1) {
              
              // MIGRATION LOGIC: Convert string parentComments to Array if needed
              let parentComments = parsed.data.preliminaries?.parentComments || [];
              if (typeof parentComments === 'string') {
                  parentComments = [{
                      id: 'migrated-comment',
                      title: 'Parent Organization',
                      owner: '',
                      content: parentComments,
                      attachments: [],
                      duration: 0
                  }];
              }

              // MIGRATION LOGIC: Convert string executiveSession to Object if needed
              let execSession = parsed.data.executiveSession || { content: '', timerStart: undefined, duration: 0 };
              if (typeof execSession === 'string') {
                  execSession = { content: execSession, timerStart: undefined, duration: 0 };
              }

              // Merge with default to ensure new fields
              const mergedState = {
                  ...DEFAULT_STRUCTURE,
                  ...parsed,
                  visible: { ...DEFAULT_STRUCTURE.visible, ...parsed.visible },
                  data: { 
                      ...DEFAULT_STRUCTURE.data, 
                      ...parsed.data,
                      callToOrder: { ...DEFAULT_STRUCTURE.data.callToOrder, ...(parsed.data.callToOrder || {}) },
                      attendees: { ...DEFAULT_STRUCTURE.data.attendees, ...(parsed.data.attendees || {}) },
                      closing: { ...DEFAULT_STRUCTURE.data.closing, ...(parsed.data.closing || {}) },
                      preliminaries: { 
                          ...DEFAULT_STRUCTURE.data.preliminaries, 
                          ...(parsed.data.preliminaries || {}),
                          scripture: { ...DEFAULT_STRUCTURE.data.preliminaries.scripture, ...(parsed.data.preliminaries?.scripture || {}) },
                          parentComments: parentComments
                      },
                      adminReports: parsed.data.adminReports || [],
                      executiveSession: execSession
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
            },
            callToOrder: {
                chairman: '',
                time: event ? new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''
            }
          }
        });
        setIsLegacyNote(false);
      }
    } else {
      setSelectedNote(null);
    }
    
    // Reset Date Filters for tasks
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setCompletedEndDate(end.toISOString().split('T')[0]);
    setCompletedStartDate(start.toISOString().split('T')[0]);
  }, [selectedEventId, notes, events]);

  // Update timer tick
  useEffect(() => {
    // Check if ANY timer is running in any section
    const isAgendaRunning = meetingState.data.agenda.some(i => i.timerStart);
    const isAdminRunning = meetingState.data.adminReports.some(i => i.timerStart);
    const isReportRunning = meetingState.data.reports.some(i => i.timerStart);
    const isParentRunning = meetingState.data.preliminaries.parentComments.some(i => i.timerStart);
    const isExecRunning = !!meetingState.data.executiveSession.timerStart;

    let interval: any;
    if (isAgendaRunning || isAdminRunning || isReportRunning || isParentRunning || isExecRunning) {
      interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    }
    return () => clearInterval(interval);
  }, [meetingState]);

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
        },
        callToOrder: {
            chairman: '',
            time: new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
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

  const toggleEventVisibility = (e: React.MouseEvent, eventId: string) => {
      e.stopPropagation();
      setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, isHidden: !ev.isHidden } : ev));
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

  // --- Task Management Logic (Unchanged) ---
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
        forWho: selectedNote.forWho, 
        assignee: 'Unassigned'
    };
    setTasks(prev => [...prev, newTask]);
    const updatedNote = { ...selectedNote, linkedTaskIds: [...selectedNote.linkedTaskIds, newTask.id] };
    setSelectedNote(updatedNote);
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    setNewTaskTitle('');
  };

  const toggleTaskLink = (taskId: string) => {
    if (!selectedNote) return;
    const currentLinks = selectedNote.linkedTaskIds;
    const newLinks = currentLinks.includes(taskId) ? currentLinks.filter(id => id !== taskId) : [...currentLinks, taskId];
    const updated = { ...selectedNote, linkedTaskIds: newLinks };
    setSelectedNote(updated);
    setNotes(notes.map(n => n.id === updated.id ? updated : n));
  };

  const removeLinkedTask = (taskId: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, linkedTaskIds: selectedNote.linkedTaskIds.filter(id => id !== taskId) };
    setSelectedNote(updated);
    setNotes(notes.map(n => n.id === updated.id ? updated : n));
  };

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
          if (selectedNote.linkedTaskIds.includes(t.id)) return false; 
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

  // SYNC Logic for Time (Logistics <-> Call To Order)
  const handleTimeChange = (newTime: string) => {
      const newState = { ...meetingState };
      newState.data.logistics.time = newTime;
      newState.data.callToOrder.time = newTime;
      updateMeetingState(newState);
  };

  // --- Generic List & Timer Logic ---

  // Stop ANY running timer in the entire meeting structure, store the elapsed time in `duration`, and clear start time
  const stopAllTimers = (currentState: MeetingStructure): MeetingStructure => {
      const newState = { ...currentState };
      const now = Date.now();
      
      const processList = (list: any[], durationKey: string) => {
          return list.map(item => {
              if (item.timerStart) {
                  const elapsed = now - item.timerStart;
                  return { 
                      ...item, 
                      timerStart: undefined, 
                      [durationKey]: (item[durationKey] || 0) + elapsed 
                  };
              }
              return item;
          });
      };

      // 1. Lists (Agenda uses 'actualDuration', others use 'duration')
      newState.data.agenda = processList(newState.data.agenda, 'actualDuration');
      newState.data.adminReports = processList(newState.data.adminReports, 'duration');
      newState.data.reports = processList(newState.data.reports, 'duration');
      newState.data.preliminaries.parentComments = processList(newState.data.preliminaries.parentComments, 'duration');

      // 2. Executive Session
      if (newState.data.executiveSession.timerStart) {
          const elapsed = now - newState.data.executiveSession.timerStart;
          newState.data.executiveSession.timerStart = undefined;
          newState.data.executiveSession.duration = (newState.data.executiveSession.duration || 0) + elapsed;
      }

      return newState;
  };

  const handleGlobalTimer = (type: 'agenda' | 'reports' | 'adminReports' | 'parentComments' | 'executiveSession', itemId?: string) => {
      // 1. Check if the specific target is currently running
      let targetWasRunning = false;
      if (type === 'executiveSession') {
          targetWasRunning = !!meetingState.data.executiveSession.timerStart;
      } else {
          let list: any[] = [];
          if (type === 'parentComments') list = meetingState.data.preliminaries.parentComments;
          else list = (meetingState.data as any)[type];
          
          const item = list.find(i => i.id === itemId);
          if (item) targetWasRunning = !!item.timerStart;
      }

      // 2. Stop everything (calculates durations for any running timers)
      let newState = stopAllTimers(meetingState); 

      // 3. If target WAS NOT running, start it now
      if (!targetWasRunning) {
          if (type === 'executiveSession') {
              newState.data.executiveSession.timerStart = Date.now();
          } else {
              let newList: any[] = [];
              if (type === 'parentComments') newList = newState.data.preliminaries.parentComments;
              else newList = (newState.data as any)[type];

              const targetIndex = newList.findIndex(i => i.id === itemId);
              if (targetIndex > -1) {
                  newList[targetIndex].timerStart = Date.now();
              }
          }
      }
      
      updateMeetingState(newState);
  };

  // Agenda Item Handlers
  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      id: Math.random().toString(),
      time: '0m', // Default, though unused visually now
      topic: '',
      owner: '',
      outcome: '',
      notes: '',
      attachments: [],
      actualDuration: 0 // Initialize at 0
    };
    updateData('agenda', null, [...meetingState.data.agenda, newItem]);
  };

  const removeAgendaItem = (id: string) => {
    updateData('agenda', null, meetingState.data.agenda.filter(i => i.id !== id));
  };

  const moveAgendaItem = (index: number, direction: 'up' | 'down') => {
    const newAgenda = [...meetingState.data.agenda];
    if (direction === 'up' && index > 0) {
      [newAgenda[index], newAgenda[index - 1]] = [newAgenda[index - 1], newAgenda[index]];
    } else if (direction === 'down' && index < newAgenda.length - 1) {
      [newAgenda[index], newAgenda[index + 1]] = [newAgenda[index + 1], newAgenda[index]];
    }
    updateData('agenda', null, newAgenda);
  };

  const updateAgendaItem = (id: string, field: keyof AgendaItem, value: any) => {
    const newAgenda = meetingState.data.agenda.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateData('agenda', null, newAgenda);
  };

  // Generic List Item Handlers (Reports, Admin, Parent Org)
  const addListItem = (type: 'reports' | 'adminReports' | 'parentComments') => {
    const newItem: ReportItem = {
        id: Math.random().toString(),
        title: '',
        owner: '',
        content: '',
        attachments: [],
        duration: 0
    };
    if (type === 'parentComments') {
        const newComments = [...meetingState.data.preliminaries.parentComments, newItem];
        updateNestedData('preliminaries', 'parentComments', newComments as any);
    } else {
        updateData(type, null, [...meetingState.data[type], newItem]);
    }
  };

  const removeListItem = (type: 'reports' | 'adminReports' | 'parentComments', id: string) => {
    if (type === 'parentComments') {
        const newComments = meetingState.data.preliminaries.parentComments.filter(i => i.id !== id);
        updateNestedData('preliminaries', 'parentComments', newComments as any);
    } else {
        updateData(type, null, meetingState.data[type].filter(i => i.id !== id));
    }
  };

  const updateListItem = (type: 'reports' | 'adminReports' | 'parentComments', id: string, field: keyof ReportItem, value: any) => {
    if (type === 'parentComments') {
        const newComments = meetingState.data.preliminaries.parentComments.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        );
        updateNestedData('preliminaries', 'parentComments', newComments as any);
    } else {
        const newReports = meetingState.data[type].map(item => 
            item.id === id ? { ...item, [field]: value } : item
        );
        updateData(type, null, newReports);
    }
  };

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, itemId: string, type: 'agenda' | 'reports' | 'adminReports' | 'parentComments') => {
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
              
              let list: any[] = [];
              if (type === 'parentComments') list = meetingState.data.preliminaries.parentComments;
              else list = (meetingState.data as any)[type];

              const item = list.find(i => i.id === itemId);
              if(item) {
                  const updatedAttachments = [...(item.attachments || []), newAttachment];
                  if (type === 'agenda') {
                      updateAgendaItem(itemId, 'attachments', updatedAttachments);
                  } else {
                      updateListItem(type, itemId, 'attachments', updatedAttachments);
                  }
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDriveAttach = (itemId: string, type: 'agenda' | 'reports' | 'adminReports' | 'parentComments') => {
      const url = prompt("Paste Google Drive Link:");
      if (!url) return;
      const name = prompt("Enter File Name (e.g., Q3 Report):", "Drive File");
      if (!name) return;

      const newAttachment: Attachment = {
          id: Math.random().toString(),
          name: name,
          type: 'file', // Treat as generic file
          url: url
      };

      let list: any[] = [];
      if (type === 'parentComments') list = meetingState.data.preliminaries.parentComments;
      else list = (meetingState.data as any)[type];

      const item = list.find(i => i.id === itemId);
      if (item) {
          const updatedAttachments = [...(item.attachments || []), newAttachment];
          if (type === 'agenda') {
              updateAgendaItem(itemId, 'attachments', updatedAttachments);
          } else {
              updateListItem(type, itemId, 'attachments', updatedAttachments);
          }
      }
  };

  const removeAttachment = (itemId: string, attId: string, type: 'agenda' | 'reports' | 'adminReports' | 'parentComments') => {
      let list: any[] = [];
      if (type === 'parentComments') list = meetingState.data.preliminaries.parentComments;
      else list = (meetingState.data as any)[type];

      const item = list.find(i => i.id === itemId);
      if(item) {
          const updatedAttachments = item.attachments.filter((a: any) => a.id !== attId);
           if (type === 'agenda') {
                updateAgendaItem(itemId, 'attachments', updatedAttachments);
            } else {
                updateListItem(type, itemId, 'attachments', updatedAttachments);
            }
      }
  };

  const setTimeNow = (section: 'callToOrder' | 'closing', field: 'time' | 'adjournmentTime') => {
      const now = new Date();
      const timeString = now.toTimeString().substring(0, 5); // HH:MM
      if (section === 'callToOrder' && field === 'time') {
          handleTimeChange(timeString);
      } else {
          updateNestedData(section, field, timeString);
      }
  };

  const formatDuration = (ms: number) => {
      if (!ms) return '0m 0s';
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / 1000 / 60));
      return `${minutes}m ${seconds}s`;
  };

  const filteredEvents = events
    .filter(e => {
        if (!showHidden && e.isHidden) return false;
        const eventDate = new Date(e.when);
        const start = new Date(`${eventStartDate}T00:00:00`);
        const end = new Date(`${eventEndDate}T23:59:59.999`);
        return eventDate >= start && eventDate <= end;
    })
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

  // Reusable List Renderer (Reports, Parent Org)
  const renderListSection = (type: 'reports' | 'adminReports' | 'parentComments', title: string, placeholderTitle: string) => {
      const list = type === 'parentComments' ? meetingState.data.preliminaries.parentComments : meetingState.data[type];
      
      return (
        <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                <span>{title}</span>
                <button onClick={() => addListItem(type)} className="text-sky-600 hover:text-sky-800 text-[10px] font-bold bg-sky-50 px-2 py-1 rounded">
                <i className="fas fa-plus mr-1"></i> ADD ITEM
                </button>
            </h3>
            <div className="space-y-4">
                {list.map((item) => {
                    const isRunning = !!item.timerStart;
                    const accumulated = item.duration || 0;
                    const sessionDuration = isRunning ? (currentTime - (item.timerStart || currentTime)) : 0;
                    const totalDuration = accumulated + sessionDuration;

                    return (
                        <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm group">
                            <div className="flex gap-3 mb-2 items-center">
                                {/* Stopwatch */}
                                <button 
                                    onClick={() => handleGlobalTimer(type, item.id)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isRunning ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-green-600'}`}
                                    title={isRunning ? "Stop Timer" : "Start Timer"}
                                >
                                    <i className={`fas ${isRunning ? 'fa-stop' : 'fa-play'} text-xs`}></i>
                                </button>
                                
                                {/* Duration Display */}
                                <div className={`px-2 py-1 rounded text-xs font-mono font-bold min-w-[70px] text-center ${isRunning ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {formatDuration(totalDuration)}
                                </div>

                                <input 
                                    className="flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                                    placeholder={placeholderTitle}
                                    value={item.title}
                                    onChange={e => updateListItem(type, item.id, 'title', e.target.value)}
                                />
                                <input 
                                    className="w-1/3 text-slate-600 bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                                    placeholder="Presented By"
                                    value={item.owner}
                                    onChange={e => updateListItem(type, item.id, 'owner', e.target.value)}
                                />
                                <button onClick={() => removeListItem(type, item.id)} className="text-slate-300 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                            <textarea 
                                className="w-full text-sm text-slate-700 bg-slate-50 p-2 rounded border border-transparent focus:bg-white focus:border-slate-300 focus:outline-none resize-y"
                                rows={3}
                                placeholder="Details, Actions, Notes..."
                                value={item.content}
                                onChange={e => updateListItem(type, item.id, 'content', e.target.value)}
                            />
                            {/* Attachments */}
                            <div className="flex flex-wrap gap-2 items-center mt-2">
                                {item.attachments?.map(att => (
                                    <div key={att.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded border border-slate-200">
                                        <i className="fas fa-paperclip text-[10px]"></i>
                                        <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline max-w-[100px] truncate">{att.name}</a>
                                        <button onClick={() => removeAttachment(item.id, att.id, type)} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                                    </div>
                                ))}
                                <label className="cursor-pointer text-sky-600 text-xs hover:text-sky-800 flex items-center gap-1 px-1">
                                    <i className="fas fa-file-upload"></i> Local
                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, item.id, type)} />
                                </label>
                                <button onClick={() => handleDriveAttach(item.id, type)} className="cursor-pointer text-green-600 text-xs hover:text-green-800 flex items-center gap-1 px-1">
                                    <i className="fab fa-google-drive"></i> Drive
                                </button>
                            </div>
                        </div>
                    );
                })}
                {list.length === 0 && <div className="text-sm text-slate-400 italic">No items added.</div>}
            </div>
        </section>
      );
  };

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
           
           {/* Date Range Filters */}
           <div className="flex gap-2 mb-3">
               <input 
                   type="date" 
                   className="w-1/2 border rounded px-2 py-1 text-xs bg-white text-slate-900" 
                   value={eventStartDate}
                   onChange={e => setEventStartDate(e.target.value)}
                   title="Start Date"
               />
               <input 
                   type="date" 
                   className="w-1/2 border rounded px-2 py-1 text-xs bg-white text-slate-900" 
                   value={eventEndDate}
                   onChange={e => setEventEndDate(e.target.value)}
                   title="End Date"
               />
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
                  className={`p-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-start group ${selectedEventId === event.id ? 'bg-sky-50 border-l-4 border-l-sky-500' : ''}`}
               >
                   <div className="overflow-hidden">
                       <div className={`font-semibold text-sm truncate ${event.isHidden ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                           {event.title}
                           {event.isHidden && <span className="text-[10px] ml-1">(Hidden)</span>}
                       </div>
                       <div className="text-xs text-slate-500 mt-1">{new Date(event.when).toLocaleDateString()}</div>
                   </div>
                   <button 
                        onClick={(e) => toggleEventVisibility(e, event.id)}
                        className={`text-slate-300 hover:text-slate-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity ${event.isHidden ? 'opacity-100 text-slate-400' : ''}`}
                        title={event.isHidden ? "Unhide" : "Hide"}
                   >
                       <i className={`fas ${event.isHidden ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                   </button>
               </div>
           ))}
           {filteredEvents.length === 0 && (
               <div className="p-4 text-center text-xs text-slate-400">
                   No events in this range.
               </div>
           )}
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
                                 className="w-full bg-slate-50 p-3 rounded-lg border border-slate-100 italic text-sm text-slate-600 focus:outline-none focus:border-sky-500"
                                 placeholder="Paste organization mission here..."
                                 value={meetingState.data.missionStatement}
                                 onChange={e => updateData('missionStatement', null, e.target.value)}
                              />
                           </section>
                        )}

                        {/* Call to Order (New) */}
                        {meetingState.visible.callToOrder && (
                            <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Call to Order</h3>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 block mb-1">Chairman</label>
                                        <InputField 
                                            value={meetingState.data.callToOrder.chairman} 
                                            onChange={(val: string) => updateNestedData('callToOrder', 'chairman', val)}
                                            placeholder="Who called to order?"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">Time</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="time" 
                                                className="bg-transparent border-b border-slate-300 text-sm py-1 outline-none text-slate-900"
                                                value={meetingState.data.callToOrder.time} 
                                                onChange={(e) => handleTimeChange(e.target.value)} // Synced Time
                                            />
                                            <button onClick={() => setTimeNow('callToOrder', 'time')} className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-slate-600 font-bold">Now</button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Logistics */}
                        {meetingState.visible.logistics && (
                            <section className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="col-span-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Logistics</h3>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                                    <InputField value={meetingState.data.logistics.date} onChange={(val: string) => updateNestedData('logistics', 'date', val)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Time</label>
                                    <InputField value={meetingState.data.logistics.time} onChange={(val: string) => handleTimeChange(val)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Location</label>
                                    <InputField value={meetingState.data.logistics.location} onChange={(val: string) => updateNestedData('logistics', 'location', val)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Link</label>
                                    <InputField value={meetingState.data.logistics.link} onChange={(val: string) => updateNestedData('logistics', 'link', val)} placeholder="Zoom / Meet URL" className="text-blue-600" />
                                </div>
                            </section>
                        )}

                        {/* Preliminaries (Updated) */}
                        {meetingState.visible.preliminaries && (
                             <section className="space-y-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preliminaries</h3>
                                
                                {/* Scripture (New) */}
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Scripture Reading</h4>
                                    <InputField 
                                        className="mb-2 font-semibold"
                                        placeholder="Reference (e.g. Psalm 23)"
                                        value={meetingState.data.preliminaries.scripture.reference}
                                        onChange={(val: string) => {
                                            const newState = { ...meetingState };
                                            newState.data.preliminaries.scripture.reference = val;
                                            updateMeetingState(newState);
                                        }}
                                    />
                                    <textarea 
                                        className="w-full bg-white border border-slate-200 rounded p-2 text-sm h-16 resize-none outline-none text-slate-900 focus:border-sky-500"
                                        placeholder="Discussion / Reading notes..."
                                        value={meetingState.data.preliminaries.scripture.discussion}
                                        onChange={(e) => {
                                            const newState = { ...meetingState };
                                            newState.data.preliminaries.scripture.discussion = e.target.value;
                                            updateMeetingState(newState);
                                        }}
                                    />
                                </div>

                                {/* Prayer (Updated with Notes) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Opening Prayer</label>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <InputField 
                                                value={meetingState.data.preliminaries.prayer} 
                                                onChange={(val: string) => updateNestedData('preliminaries', 'prayer', val)} 
                                                placeholder="By whom?" 
                                                className="mb-2"
                                            />
                                            <textarea 
                                                className="w-full bg-white border border-slate-200 rounded p-2 text-sm h-16 resize-none outline-none text-slate-900 focus:border-sky-500"
                                                value={meetingState.data.preliminaries.prayerNotes}
                                                onChange={(e) => updateNestedData('preliminaries', 'prayerNotes', e.target.value)}
                                                placeholder="Prayer notes/requests..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Minutes Approval</label>
                                        <InputField value={meetingState.data.preliminaries.minutesApproval} onChange={(val: string) => updateNestedData('preliminaries', 'minutesApproval', val)} placeholder="Approved? Corrections?" />
                                    </div>
                                </div>

                                {/* Parent Org Comments - NOW A LIST */}
                                {renderListSection('parentComments', 'Parent Organization Comments', 'Commenter / Topic')}

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Email Motions Ratified</label>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm h-16 resize-none outline-none text-slate-900"
                                        value={meetingState.data.preliminaries.emailMotions}
                                        onChange={(e) => updateNestedData('preliminaries', 'emailMotions', e.target.value)}
                                        placeholder="List motions approved via email since last meeting..."
                                    />
                                </div>
                             </section>
                        )}

                        {/* Objective */}
                        {meetingState.visible.objective && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Objective</h3>
                                <textarea 
                                    className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-lg font-medium text-slate-800 placeholder-slate-400 outline-none resize-none focus:border-sky-500 transition-colors"
                                    placeholder="What is the primary goal of this meeting?"
                                    rows={2}
                                    value={meetingState.data.objective}
                                    onChange={e => updateData('objective', null, e.target.value)}
                                />
                            </section>
                        )}

                        {/* Roles */}
                        {meetingState.visible.roles && (
                            <section className="bg-sky-50 p-4 rounded-lg border border-sky-100">
                                <h3 className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-3">Roles</h3>
                                <div className="flex gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[120px]">
                                        <label className="text-[10px] font-bold text-sky-600 uppercase">Facilitator</label>
                                        <InputField value={meetingState.data.roles.facilitator} onChange={(val: string) => updateNestedData('roles', 'facilitator', val)} className="!border-sky-200 focus:!border-sky-500" />
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <label className="text-[10px] font-bold text-sky-600 uppercase">Note Taker</label>
                                        <InputField value={meetingState.data.roles.noteTaker} onChange={(val: string) => updateNestedData('roles', 'noteTaker', val)} className="!border-sky-200 focus:!border-sky-500" />
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <label className="text-[10px] font-bold text-sky-600 uppercase">Time Keeper</label>
                                        <InputField value={meetingState.data.roles.timeKeeper} onChange={(val: string) => updateNestedData('roles', 'timeKeeper', val)} className="!border-sky-200 focus:!border-sky-500" />
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Attendees */}
                        {meetingState.visible.attendees && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attendees</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-green-600 uppercase">Present</label>
                                        <textarea 
                                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm h-16 resize-none outline-none focus:border-green-400 text-slate-900"
                                            value={meetingState.data.attendees.present}
                                            onChange={e => updateNestedData('attendees', 'present', e.target.value)}
                                            placeholder="Names..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-red-500 uppercase">Absent</label>
                                        <input 
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-red-400 placeholder-slate-400 text-slate-900"
                                            value={meetingState.data.attendees.absent}
                                            onChange={e => updateNestedData('attendees', 'absent', e.target.value)}
                                            placeholder="Names..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Ex-Officio</label>
                                            <input 
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-sky-500 placeholder-slate-400 text-slate-900"
                                                value={meetingState.data.attendees.exOfficio}
                                                onChange={e => updateNestedData('attendees', 'exOfficio', e.target.value)}
                                                placeholder="Names..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Guests</label>
                                            <input 
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-sky-500 placeholder-slate-400 text-slate-900"
                                                value={meetingState.data.attendees.guests}
                                                onChange={e => updateNestedData('attendees', 'guests', e.target.value)}
                                                placeholder="Names..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Admin Reports (New) */}
                        {meetingState.visible.adminReports && renderListSection('adminReports', 'Administrative Reports', 'Report Name')}

                        {/* Committee Reports */}
                        {meetingState.visible.reports && renderListSection('reports', 'Committee Reports', 'Committee Name')}

                        {/* Agenda (New Business) */}
                        {meetingState.visible.agenda && (
                             <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                                    <span>New Business / Agenda</span>
                                    <button onClick={addAgendaItem} className="text-sky-600 hover:text-sky-800 text-[10px] font-bold bg-sky-50 px-2 py-1 rounded">
                                        <i className="fas fa-plus mr-1"></i> ADD ITEM
                                    </button>
                                </h3>
                                <div className="space-y-4">
                                    {meetingState.data.agenda.map((item, idx) => {
                                        const isRunning = !!item.timerStart;
                                        const accumulated = item.actualDuration || 0;
                                        const sessionDuration = isRunning ? (currentTime - (item.timerStart || currentTime)) : 0;
                                        const totalDuration = accumulated + sessionDuration;
                                        
                                        return (
                                        <div key={item.id} className="border border-slate-200 rounded-lg p-3 shadow-sm bg-white relative group">
                                            <div className="flex gap-2 mb-2 items-center">
                                                {/* Re-arrange Controls */}
                                                <div className="flex flex-col gap-0.5 mr-1">
                                                    <button 
                                                        onClick={() => moveAgendaItem(idx, 'up')} 
                                                        disabled={idx === 0}
                                                        className="text-slate-300 hover:text-slate-600 disabled:opacity-30 leading-none"
                                                    >
                                                        <i className="fas fa-caret-up"></i>
                                                    </button>
                                                    <button 
                                                        onClick={() => moveAgendaItem(idx, 'down')}
                                                        disabled={idx === meetingState.data.agenda.length - 1} 
                                                        className="text-slate-300 hover:text-slate-600 disabled:opacity-30 leading-none"
                                                    >
                                                        <i className="fas fa-caret-down"></i>
                                                    </button>
                                                </div>

                                                {/* Stopwatch Control */}
                                                <button 
                                                    onClick={() => handleGlobalTimer('agenda', item.id)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isRunning ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-green-600'}`}
                                                    title={isRunning ? "Stop Timer" : "Start Timer"}
                                                >
                                                    <i className={`fas ${isRunning ? 'fa-stop' : 'fa-play'} text-xs`}></i>
                                                </button>

                                                {/* Duration Display */}
                                                <div className={`px-2 py-1 rounded text-xs font-mono font-bold min-w-[70px] text-center ${isRunning ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {formatDuration(totalDuration)}
                                                </div>

                                                <input 
                                                    className="flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-sky-500 focus:outline-none"
                                                    value={item.topic}
                                                    onChange={e => updateAgendaItem(item.id, 'topic', e.target.value)}
                                                    placeholder="Topic"
                                                />
                                                <input 
                                                    className="w-1/4 text-xs text-slate-700 bg-white border border-slate-300 rounded px-2 py-1 text-right focus:border-sky-500 focus:outline-none"
                                                    value={item.owner}
                                                    onChange={e => updateAgendaItem(item.id, 'owner', e.target.value)}
                                                    placeholder="Owner"
                                                />
                                                <button onClick={() => removeAgendaItem(item.id)} className="text-slate-300 hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-y-4">
                                                <textarea 
                                                    className="bg-slate-50 border border-slate-100 rounded p-2 text-xs h-20 resize-none outline-none focus:bg-white focus:border-slate-300 text-slate-900"
                                                    placeholder="Notes & Discussion..."
                                                    value={item.notes}
                                                    onChange={e => updateAgendaItem(item.id, 'notes', e.target.value)}
                                                />
                                                <textarea 
                                                    className="bg-green-50 border border-green-100 rounded p-2 text-xs h-20 resize-none outline-none focus:bg-white focus:border-green-300 text-slate-900"
                                                    placeholder="Outcome / Decision..."
                                                    value={item.outcome}
                                                    onChange={e => updateAgendaItem(item.id, 'outcome', e.target.value)}
                                                />
                                            </div>
                                            {/* Agenda Attachments */}
                                            <div className="flex flex-wrap gap-2 items-center mt-2">
                                                {item.attachments?.map(att => (
                                                    <div key={att.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded border border-slate-200">
                                                        <i className="fas fa-paperclip text-[10px]"></i>
                                                        <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline max-w-[100px] truncate">{att.name}</a>
                                                        <button onClick={() => removeAttachment(item.id, att.id, 'agenda')} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                                                    </div>
                                                ))}
                                                <label className="cursor-pointer text-sky-600 text-xs hover:text-sky-800 flex items-center gap-1 px-1">
                                                    <i className="fas fa-file-upload"></i> Local
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, item.id, 'agenda')} />
                                                </label>
                                                <button onClick={() => handleDriveAttach(item.id, 'agenda')} className="cursor-pointer text-green-600 text-xs hover:text-green-800 flex items-center gap-1 px-1">
                                                    <i className="fab fa-google-drive"></i> Drive
                                                </button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                             </section>
                        )}

                        {/* Linked Action Items (Read Only from this view, managed in sidebar) */}
                        {meetingState.visible.actions && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                                    <span>Action Items</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Manage in Sidebar &rarr;</span>
                                </h3>
                                <div className="space-y-2">
                                    {linkedTasksObjects.map(task => (
                                        <div key={task.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100">
                                            <div onClick={() => {
                                                const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
                                                updateTaskFromDocument(task.id, 'status', newStatus);
                                            }} className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center ${task.status === TaskStatus.DONE ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'}`}>
                                                {task.status === TaskStatus.DONE && <i className="fas fa-check text-white text-[10px]"></i>}
                                            </div>
                                            <div className="flex-1 text-sm font-medium text-slate-800 truncate">{task.shortDescription}</div>
                                            <div className="text-xs text-slate-500">{task.assignee || 'Unassigned'}</div>
                                        </div>
                                    ))}
                                    {linkedTasksObjects.length === 0 && <div className="text-sm text-slate-400 italic">No actions recorded.</div>}
                                </div>
                            </section>
                        )}
                        
                        {/* Executive Session - UPDATED WITH TIMER */}
                        {meetingState.visible.executiveSession && (
                            <section>
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-3">
                                    <span>Executive Session (Confidential)</span>
                                    {/* Timer Controls */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleGlobalTimer('executiveSession')}
                                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${meetingState.data.executiveSession.timerStart ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-green-600'}`}
                                        >
                                            <i className={`fas ${meetingState.data.executiveSession.timerStart ? 'fa-stop' : 'fa-play'} text-[10px]`}></i>
                                        </button>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${meetingState.data.executiveSession.timerStart ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {(() => {
                                                const running = !!meetingState.data.executiveSession.timerStart;
                                                const accumulated = meetingState.data.executiveSession.duration || 0;
                                                const current = running ? (currentTime - meetingState.data.executiveSession.timerStart!) : 0;
                                                return formatDuration(accumulated + current);
                                            })()}
                                        </div>
                                    </div>
                                </h3>
                                <textarea 
                                    className="w-full bg-red-50 border border-red-100 p-3 rounded text-sm text-slate-800 h-24 outline-none resize-none"
                                    placeholder="Confidential notes..."
                                    value={meetingState.data.executiveSession.content}
                                    onChange={e => updateNestedData('executiveSession', 'content', e.target.value)}
                                />
                            </section>
                        )}
                        
                        {/* Tabled Items */}
                        {meetingState.visible.tabledItems && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tabled Items</h3>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-100 p-3 rounded text-sm text-slate-800 h-20 outline-none resize-none"
                                    placeholder="Items for next meeting..."
                                    value={meetingState.data.tabledItems}
                                    onChange={e => updateData('tabledItems', null, e.target.value)}
                                />
                            </section>
                        )}

                        {/* Parking Lot */}
                        {meetingState.visible.parkingLot && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Parking Lot</h3>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-100 p-3 rounded text-sm text-slate-800 h-20 outline-none resize-none"
                                    placeholder="Ideas to revisit later..."
                                    value={meetingState.data.parkingLot}
                                    onChange={e => updateData('parkingLot', null, e.target.value)}
                                />
                            </section>
                        )}

                        {/* Closing - UPDATED TO LIGHT THEME */}
                        {meetingState.visible.closing && (
                            <section className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl space-y-4">
                                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Closing</h3>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm text-indigo-900">Meeting Rating</span>
                                    <div className="flex gap-1">
                                        {[1,2,3,4,5].map(n => (
                                            <button 
                                                key={n} 
                                                onClick={() => updateNestedData('closing', 'rating', n.toString())}
                                                className={`w-8 h-8 rounded-full font-bold transition shadow-sm ${meetingState.data.closing.rating === n ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-900 hover:bg-indigo-100'}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-indigo-100">
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">Next Meeting</label>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={meetingState.data.closing.nextMeetingDate}
                                            onChange={e => updateNestedData('closing', 'nextMeetingDate', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">Adjournment Time</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="time" 
                                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={meetingState.data.closing.adjournmentTime}
                                                onChange={e => updateNestedData('closing', 'adjournmentTime', e.target.value)}
                                            />
                                            <button onClick={() => setTimeNow('closing', 'adjournmentTime')} className="text-xs bg-indigo-200 hover:bg-indigo-300 px-2 py-1 rounded text-indigo-800 font-bold">Now</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">Closing Prayer By</label>
                                        <input 
                                            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={meetingState.data.closing.prayerBy}
                                            onChange={e => updateNestedData('closing', 'prayerBy', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">Submitted By</label>
                                        <input 
                                            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={meetingState.data.closing.submittedBy}
                                            onChange={e => updateNestedData('closing', 'submittedBy', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </section>
                        )}
                        
                     </div>
                  ) : (
                     <div className="flex h-full items-center justify-center text-slate-300">
                        <div className="text-center">
                           <i className="fas fa-file-alt text-4xl mb-4"></i>
                           <p className="mb-4">No notes created for this meeting yet.</p>
                           <button 
                                onClick={() => createNoteForEvent(selectedEvent!)}
                                className="bg-sky-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-sky-700 transition"
                           >
                               <i className="fas fa-plus-circle mr-2"></i> Create Agenda
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </>
         ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
                <div className="text-center">
                    <i className="fas fa-calendar-alt text-4xl mb-4"></i>
                    <p>Select or create an event to start.</p>
                </div>
            </div>
         )}
      </div>

      {/* 3. RIGHT PANE: Assistant & Actions */}
      {selectedEventId && (
          <div className={`${isRightSidebarOpen ? 'w-80 border-l' : 'w-0 overflow-hidden'} bg-white border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-10 hidden md:flex`}>
              <div className="flex border-b border-slate-200">
                  <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'tasks' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}>Tasks</button>
                  <button onClick={() => setActiveTab('template')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'template' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}>Structure</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  {activeTab === 'template' && (
                      <div className="space-y-1">
                          <p className="text-xs text-slate-400 uppercase font-bold mb-3 pl-1">Toggle Sections</p>
                          {Object.keys(DEFAULT_STRUCTURE.visible).map((key) => (
                              <SectionToggle 
                                key={key} 
                                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                                section={key as keyof MeetingStructure['visible']} 
                              />
                          ))}
                      </div>
                  )}

                  {activeTab === 'tasks' && selectedNote && (
                      <div className="space-y-6">
                          {/* Create New Task */}
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Quick Add Action Item</label>
                              <div className="flex gap-2">
                                  <input 
                                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-sky-500 text-slate-900"
                                      placeholder="Task name..."
                                      value={newTaskTitle}
                                      onChange={e => setNewTaskTitle(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                                  />
                                  <button onClick={handleCreateTask} className="bg-sky-600 text-white px-2 rounded hover:bg-sky-700">
                                      <i className="fas fa-plus"></i>
                                  </button>
                              </div>
                          </div>

                          {/* Link Existing */}
                          <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Link Existing Task</label>
                              <input 
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm outline-none mb-2 text-slate-900"
                                  placeholder="Search tasks..."
                                  value={taskLinkSearch}
                                  onChange={e => setTaskLinkSearch(e.target.value)}
                              />
                              {taskLinkSearch && (
                                  <div className="bg-white border border-slate-200 rounded max-h-40 overflow-y-auto shadow-sm">
                                      {tasks.filter(t => t.shortDescription.toLowerCase().includes(taskLinkSearch.toLowerCase()) && !selectedNote.linkedTaskIds.includes(t.id)).map(t => (
                                          <div key={t.id} onClick={() => { toggleTaskLink(t.id); setTaskLinkSearch(''); }} className="p-2 hover:bg-sky-50 cursor-pointer text-xs truncate border-b border-slate-50 last:border-0 text-slate-900">
                                              {t.shortDescription}
                                          </div>
                                      ))}
                                      {tasks.filter(t => t.shortDescription.toLowerCase().includes(taskLinkSearch.toLowerCase())).length === 0 && (
                                          <div className="p-2 text-xs text-slate-400 italic">No matches</div>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* Filters for Review Lists */}
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Filters</label>
                              <div className="space-y-2">
                                  <select className="w-full text-xs border p-1 rounded bg-white text-slate-900" value={taskFilterType} onChange={(e) => setTaskFilterType(e.target.value as any)}>
                                      <option value="all">Everyone</option>
                                      <option value="me">Me Only</option>
                                      <option value="unassigned">Unassigned</option>
                                  </select>
                                  <div className="flex gap-2 items-center">
                                      <span className="text-[10px] text-slate-500 w-12">Lookahead</span>
                                      <select className="flex-1 text-xs border p-1 rounded bg-white text-slate-900" value={futureLookahead} onChange={(e) => setFutureLookahead(parseInt(e.target.value))}>
                                          <option value={7}>1 Week</option>
                                          <option value={14}>2 Weeks</option>
                                          <option value={30}>1 Month</option>
                                          <option value={9999}>All Future</option>
                                      </select>
                                  </div>
                              </div>
                          </div>

                          {/* Linked Action Items List */}
                          <div>
                              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Linked Actions ({selectedNote.linkedTaskIds.length})</h4>
                              <div className="space-y-1">
                                  {linkedTasksObjects.map(task => (
                                      <div key={task.id} className="group flex items-center justify-between bg-white border border-slate-200 p-2 rounded text-xs shadow-sm">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === TaskStatus.DONE ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                              <span className={`truncate ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{task.shortDescription}</span>
                                          </div>
                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => onEditTask?.(task)} className="text-slate-400 hover:text-sky-600"><i className="fas fa-pencil-alt"></i></button>
                                              <button onClick={() => removeLinkedTask(task.id)} className="text-slate-400 hover:text-red-500"><i className="fas fa-unlink"></i></button>
                                          </div>
                                      </div>
                                  ))}
                                  {linkedTasksObjects.length === 0 && <div className="text-xs text-slate-400 italic">No tasks linked.</div>}
                              </div>
                          </div>

                          {/* Review: Incomplete Tasks */}
                          <div>
                              <h4 className="text-xs font-bold text-orange-600 uppercase mb-2 flex justify-between items-center">
                                  <span>Review: Outstanding</span>
                                  <span className="bg-orange-100 text-orange-700 px-1.5 rounded text-[10px]">{relatedIncompleteTasks.length}</span>
                              </h4>
                              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                  {relatedIncompleteTasks.map(task => (
                                      <div key={task.id} className="flex justify-between items-center bg-orange-50 border border-orange-100 p-2 rounded text-xs">
                                          <div className="truncate flex-1 pr-2 text-slate-700" title={task.shortDescription}>{task.shortDescription}</div>
                                          <button onClick={() => toggleTaskLink(task.id)} className="text-sky-600 hover:text-sky-800 text-[10px] font-bold whitespace-nowrap">Link</button>
                                      </div>
                                  ))}
                                  {relatedIncompleteTasks.length === 0 && <div className="text-xs text-slate-400 italic">Nothing outstanding in range.</div>}
                              </div>
                          </div>

                          {/* Review: Completed Tasks */}
                          <div>
                              <h4 className="text-xs font-bold text-green-600 uppercase mb-2 flex justify-between items-center">
                                  <span>Review: Completed</span>
                                  <span className="bg-green-100 text-green-700 px-1.5 rounded text-[10px]">{relatedCompletedTasks.length}</span>
                              </h4>
                              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                  {relatedCompletedTasks.map(task => (
                                      <div key={task.id} className="flex justify-between items-center bg-green-50 border border-green-100 p-2 rounded text-xs opacity-75 hover:opacity-100">
                                          <div className="truncate flex-1 pr-2 text-slate-600 line-through" title={task.shortDescription}>{task.shortDescription}</div>
                                          <button onClick={() => toggleTaskLink(task.id)} className="text-sky-600 hover:text-sky-800 text-[10px] font-bold whitespace-nowrap">Link</button>
                                      </div>
                                  ))}
                                  {relatedCompletedTasks.length === 0 && <div className="text-xs text-slate-400 italic">Nothing completed in range.</div>}
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
