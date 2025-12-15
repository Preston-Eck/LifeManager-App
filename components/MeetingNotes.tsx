import React, { useState, useEffect, useRef } from 'react';
import { MeetingNote, Task, TaskStatus, Urgency, Importance } from '../types';

interface MeetingNotesProps {
  notes: MeetingNote[];
  setNotes: React.Dispatch<React.SetStateAction<MeetingNote[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  initialNoteId?: string;
  onEditTask?: (task: Task) => void;
}

export const MeetingNotes: React.FC<MeetingNotesProps> = ({ notes, setNotes, tasks, setTasks, initialNoteId, onEditTask }) => {
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  
  // Action Item State
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Rich Text Ref
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize selection from props
  useEffect(() => {
    if (initialNoteId) {
        const note = notes.find(n => n.id === initialNoteId);
        if (note) {
            setSelectedNote(note);
            setIsEditing(true); // Auto enter edit mode if deep linked
        }
    }
  }, [initialNoteId, notes]);

  // Sync editor content when selected note changes
  useEffect(() => {
    if (editorRef.current && selectedNote) {
        editorRef.current.innerHTML = selectedNote.content;
    }
  }, [selectedNote?.id]); // Only re-sync on ID change to avoid cursor jumps on every state update

  const createNote = () => {
    const note: MeetingNote = {
      id: Math.random().toString(),
      title: newNoteTitle || 'Untitled Meeting',
      date: new Date().toISOString(),
      content: '<div>Start typing meeting minutes...</div>',
      linkedTaskIds: [],
      linkedEventIds: []
    };
    setNotes([note, ...notes]);
    setSelectedNote(note);
    setIsEditing(true);
    setNewNoteTitle('');
  };

  const handleEditorInput = () => {
    if (editorRef.current && selectedNote) {
        const content = editorRef.current.innerHTML;
        // Debounce or just update local state could be better, but direct update for now
        // We update the notes array, but we DON'T trigger a re-render of the editor content in useEffect to avoid loop
        const updated = { ...selectedNote, content };
        setSelectedNote(updated);
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const createActionItem = () => {
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
        updates: []
    };

    setTasks(prev => [...prev, newTask]);
    
    // Link to note
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

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar List */}
      <div className={`${selectedNote ? 'hidden md:block' : 'block'} md:w-1/3 bg-white border-r border-slate-200 flex flex-col`}>
        <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold mb-3 text-slate-800">Meeting Notes</h2>
            <div className="flex gap-2">
                <input 
                    className="flex-1 border rounded px-2 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                    placeholder="New Note Title..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                />
                <button onClick={createNote} className="bg-sky-600 text-white px-3 py-1 rounded shadow hover:bg-sky-700">
                    <i className="fas fa-plus"></i>
                </button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
            {notes.map(note => (
                <div 
                    key={note.id}
                    onClick={() => { setSelectedNote(note); setIsEditing(false); }}
                    className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedNote?.id === note.id ? 'bg-sky-50 border-l-4 border-l-sky-500' : ''}`}
                >
                    <div className="font-semibold text-slate-800">{note.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(note.date).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400 mt-1 truncate" dangerouslySetInnerHTML={{__html: note.content || 'No content yet...'}}></div>
                </div>
            ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className={`flex-1 flex flex-col bg-slate-50 ${!selectedNote ? 'hidden md:flex' : 'flex'}`}>
        {selectedNote ? (
            <>
                <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shadow-sm">
                    <button onClick={() => setSelectedNote(null)} className="md:hidden text-slate-500">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{selectedNote.title}</h3>
                        <div className="text-xs text-slate-400">
                             {new Date(selectedNote.date).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    {/* Rich Text Toolbar */}
                    <div className="bg-white border border-slate-200 rounded-t p-2 flex gap-1 mb-0 border-b-0 shadow-sm sticky top-0 z-10">
                        <button onClick={() => execCmd('bold')} className="p-2 hover:bg-slate-100 rounded text-slate-600 w-8 h-8 flex items-center justify-center font-bold" title="Bold">B</button>
                        <button onClick={() => execCmd('italic')} className="p-2 hover:bg-slate-100 rounded text-slate-600 w-8 h-8 flex items-center justify-center italic" title="Italic">I</button>
                        <button onClick={() => execCmd('underline')} className="p-2 hover:bg-slate-100 rounded text-slate-600 w-8 h-8 flex items-center justify-center underline" title="Underline">U</button>
                        <div className="w-px bg-slate-300 mx-1"></div>
                        <button onClick={() => execCmd('insertUnorderedList')} className="p-2 hover:bg-slate-100 rounded text-slate-600 w-8 h-8 flex items-center justify-center" title="Bullet List"><i className="fas fa-list-ul"></i></button>
                        <button onClick={() => execCmd('insertOrderedList')} className="p-2 hover:bg-slate-100 rounded text-slate-600 w-8 h-8 flex items-center justify-center" title="Numbered List"><i className="fas fa-list-ol"></i></button>
                    </div>

                    {/* Editor Content */}
                    <div 
                        ref={editorRef}
                        contentEditable
                        onInput={handleEditorInput}
                        className="bg-white w-full min-h-[300px] p-4 rounded-b border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none text-slate-800 prose prose-sm max-w-none shadow-sm mb-6"
                    ></div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Action Items (New Tasks) */}
                        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                             <h4 className="font-bold text-sky-800 mb-3 flex items-center gap-2">
                                <i className="fas fa-check-square"></i> Action Items (Brain Dump)
                             </h4>
                             <div className="flex gap-2 mb-3">
                                <input 
                                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                    placeholder="Add new action item..."
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && createActionItem()}
                                />
                                <button onClick={createActionItem} className="bg-sky-600 text-white px-3 py-1 rounded text-sm hover:bg-sky-700">Add</button>
                             </div>
                             
                             {/* Linked Action Items List */}
                             <div className="space-y-2 max-h-60 overflow-y-auto">
                                {selectedNote.linkedTaskIds.length > 0 ? (
                                    selectedNote.linkedTaskIds.map(taskId => {
                                        const task = tasks.find(t => t.id === taskId);
                                        if (!task) return null;
                                        return (
                                            <div key={taskId} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100 group">
                                                <div className={`w-4 h-4 rounded-full border cursor-pointer flex items-center justify-center ${task.status === TaskStatus.DONE ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-white'}`}
                                                    onClick={() => setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE} : t))}
                                                >
                                                    {task.status === TaskStatus.DONE && <i className="fas fa-check text-white text-[10px]"></i>}
                                                </div>
                                                <span className={`text-sm flex-1 ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.shortDescription}</span>
                                                <button 
                                                    onClick={() => onEditTask?.(task)}
                                                    className="text-slate-300 hover:text-sky-600 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Edit Task Details"
                                                >
                                                    <i className="fas fa-pencil-alt"></i>
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-slate-400 italic">No action items linked.</div>
                                )}
                             </div>
                        </div>

                        {/* Existing Tasks Linker */}
                        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-700 mb-3">Link Existing Tasks</h4>
                            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                                {tasks.filter(t => t.status !== TaskStatus.DONE).map(task => (
                                    <div 
                                        key={task.id} 
                                        onClick={() => toggleTaskLink(task.id)}
                                        className={`p-2 rounded border text-xs cursor-pointer flex items-center gap-2 transition-colors ${
                                            selectedNote.linkedTaskIds.includes(task.id) 
                                            ? 'bg-sky-100 border-sky-300' 
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            selectedNote.linkedTaskIds.includes(task.id) ? 'bg-sky-500 border-sky-500' : 'border-slate-400'
                                        }`}>
                                            {selectedNote.linkedTaskIds.includes(task.id) && <i className="fas fa-check text-white text-[10px]"></i>}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate font-medium text-slate-800">{task.shortDescription}</div>
                                            <div className="text-[10px] text-slate-500">{task.forWho}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex items-center justify-center text-slate-300">
                <div className="text-center">
                    <i className="fas fa-book-open text-5xl mb-4"></i>
                    <p>Select a note to view or edit</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};