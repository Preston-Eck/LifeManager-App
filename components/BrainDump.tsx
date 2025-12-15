import React, { useState, useRef } from 'react';
import { Task, Importance, Urgency, TaskStatus, Attachment } from '../types';
import { parseBrainDump } from '../services/geminiService';

interface BrainDumpProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  initialFilter?: 'all' | 'todo' | 'urgent';
  onTaskClick?: (task: Task) => void;
}

export const BrainDump: React.FC<BrainDumpProps> = ({ tasks, setTasks, initialFilter = 'all', onTaskClick }) => {
  const [showSmartAdd, setShowSmartAdd] = useState(false);
  const [smartInput, setSmartInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'todo' | 'urgent'>(initialFilter);
  
  // New Task Form State
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAttachments, setManualAttachments] = useState<Attachment[]>([]);
  const [dateSuggestionMessage, setDateSuggestionMessage] = useState<string | null>(null);

  const [newTask, setNewTask] = useState<Partial<Task>>({
    shortDescription: '',
    longDescription: '',
    forWho: '',
    where: '',
    when: '',
    linkedEmail: '',
    importance: Importance.MEDIUM,
    urgency: Urgency.MEDIUM
  });

  // Helpers for numerical values
  const getScaleValue = (val: string) => {
    switch(val) {
      case 'Low': return 1;
      case 'Medium': return 2;
      case 'High': return 3;
      case 'Critical': return 4;
      default: return 1;
    }
  };

  const calculatePriority = (imp: Importance, urg: Urgency) => {
    return getScaleValue(imp) * (2 * getScaleValue(urg));
  };

  const handleSmartSubmit = async () => {
    if (!smartInput.trim()) return;
    setIsProcessing(true);
    try {
      const generatedTasks = await parseBrainDump(smartInput, tasks);
      setTasks(prev => [...prev, ...generatedTasks]);
      setSmartInput('');
      setShowSmartAdd(false);
    } catch (e) {
      alert("Failed to process brain dump. Please check API Key.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = () => {
    if (!newTask.shortDescription) return;
    const task: Task = {
      id: Math.random().toString(36).substr(2, 9),
      shortDescription: newTask.shortDescription || 'Untitled',
      longDescription: newTask.longDescription || '',
      forWho: newTask.forWho || 'Personal',
      where: newTask.where,
      when: newTask.when,
      linkedEmail: newTask.linkedEmail,
      importance: newTask.importance || Importance.MEDIUM,
      urgency: newTask.urgency || Urgency.MEDIUM,
      status: TaskStatus.TODO,
      attachments: manualAttachments,
      boardId: 'manual'
    };
    setTasks(prev => [...prev, task]);
    
    // Reset form
    setNewTask({ 
      shortDescription: '', 
      longDescription: '', 
      forWho: '', 
      where: '', 
      when: '',
      linkedEmail: '',
      importance: Importance.MEDIUM, 
      urgency: Urgency.MEDIUM 
    });
    setManualAttachments([]);
    setShowManualAdd(false);
    setDateSuggestionMessage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, taskId?: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onloadend = () => {
          const result = reader.result as string;
          const newAttachment: Attachment = {
            id: Math.random().toString(),
            name: file.name,
            type: file.type.startsWith('image') ? 'image' : 'file',
            url: result // Stores Base64 string for persistence
          };

          if (taskId) {
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, attachments: [...t.attachments, newAttachment]} : t));
          } else {
            setManualAttachments(prev => [...prev, newAttachment]);
          }
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewTask({...newTask, when: val});
    
    if (val) {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      // Simple check: if date is today or before today
      if (selectedDate <= today) {
        setDateSuggestionMessage("Date is today or past due. Urgency suggested: Critical.");
        setNewTask(prev => ({...prev, when: val, urgency: Urgency.CRITICAL}));
      } else {
        setDateSuggestionMessage(null);
      }
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'todo') return t.status !== TaskStatus.DONE;
    if (filter === 'urgent') return t.urgency === Urgency.CRITICAL || t.urgency === Urgency.HIGH;
    return true;
  });

  // Sort by Priority (High Priority First)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const pA = calculatePriority(a.importance, a.urgency);
    const pB = calculatePriority(b.importance, b.urgency);
    return pB - pA;
  });

  const forWhoOptions = ["Personal", "Amelia", "School Board", "Work: UDRG", "Work: MGC", "Work: ALG"];

  // Styling Constants
  const inputClass = "w-full bg-white text-slate-900 border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none placeholder-slate-400 text-base shadow-sm";
  const labelClass = "block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wide";

  return (
    <div className="p-4 md:p-6 pb-32 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Brain Dump</h2>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowSmartAdd(!showSmartAdd)}
                className="bg-purple-600 text-white px-4 py-2.5 rounded-lg shadow hover:bg-purple-700 transition flex items-center font-medium"
            >
                <i className="fas fa-wand-magic-sparkles mr-2 text-lg"></i> AI Assist
            </button>
            <button 
                onClick={() => setShowManualAdd(!showManualAdd)}
                className="bg-sky-600 text-white px-4 py-2.5 rounded-lg shadow hover:bg-sky-700 transition flex items-center font-medium"
            >
                <i className="fas fa-plus mr-2"></i> New
            </button>
        </div>
      </div>

      {/* Smart Add Area */}
      {showSmartAdd && (
        <div className="bg-purple-50 p-6 rounded-xl mb-6 border border-purple-200 shadow-sm">
          <label className="block text-base font-medium text-purple-900 mb-2">
            Dump your thoughts here. The AI will organize them.
          </label>
          <textarea
            className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-purple-500 mb-4 bg-white text-slate-900 placeholder-slate-400 text-base"
            rows={4}
            placeholder="e.g., Need to fix the roof at Site 5 tomorrow, also buy milk for kids, and prepare facilities report for school board urgent."
            value={smartInput}
            onChange={(e) => setSmartInput(e.target.value)}
          />
          <button
            onClick={handleSmartSubmit}
            disabled={isProcessing}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-bold w-full md:w-auto"
          >
            {isProcessing ? 'Processing...' : 'Generate Tasks'}
          </button>
        </div>
      )}

      {/* Manual Add Form */}
      {showManualAdd && (
        <div className="bg-white text-slate-900 p-6 rounded-xl shadow-xl mb-8 border border-slate-200 relative">
            <h3 className="font-bold text-xl mb-6 border-b pb-4 text-slate-800">Create New Task</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="col-span-1 md:col-span-2">
                  <label className={labelClass}>SHORT DESCRIPTION</label>
                  <input 
                      type="text" 
                      placeholder="What needs to be done?" 
                      className={inputClass} 
                      value={newTask.shortDescription}
                      onChange={e => setNewTask({...newTask, shortDescription: e.target.value})}
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className={labelClass}>LONG DESCRIPTION</label>
                  <textarea 
                      placeholder="Additional details..." 
                      rows={3}
                      className={inputClass} 
                      value={newTask.longDescription}
                      onChange={e => setNewTask({...newTask, longDescription: e.target.value})}
                  />
                </div>

                <div>
                  <label className={labelClass}>FOR WHO/WHAT?</label>
                  <input 
                      list="who-options"
                      type="text" 
                      placeholder="e.g. Work: MGC" 
                      className={inputClass}
                      value={newTask.forWho}
                      onChange={e => setNewTask({...newTask, forWho: e.target.value})}
                  />
                  <datalist id="who-options">
                    {forWhoOptions.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>

                <div>
                  <label className={labelClass}>WHERE?</label>
                  <input 
                      type="text" 
                      placeholder="Location / Address" 
                      className={inputClass}
                      value={newTask.where}
                      onChange={e => setNewTask({...newTask, where: e.target.value})}
                  />
                </div>

                <div>
                  <label className={labelClass}>WHEN?</label>
                  <input 
                      type="date" 
                      className={inputClass}
                      value={newTask.when}
                      onChange={handleDateChange}
                  />
                  {dateSuggestionMessage && (
                    <div className="text-sm text-orange-600 mt-1 font-bold animate-pulse">
                      <i className="fas fa-exclamation-triangle mr-1"></i>
                      {dateSuggestionMessage}
                    </div>
                  )}
                </div>

                <div>
                   <label className={labelClass}>LINKED EMAIL</label>
                   <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-sm">
                      <div className="pl-3 text-slate-500"><i className="fas fa-envelope text-lg"></i></div>
                      <input 
                        type="text"
                        placeholder="Paste Gmail URL or Subject"
                        className="w-full bg-white text-slate-900 p-3 outline-none placeholder-slate-400 text-base"
                        value={newTask.linkedEmail}
                        onChange={e => setNewTask({...newTask, linkedEmail: e.target.value})}
                      />
                   </div>
                </div>

                <div>
                  <label className={labelClass}>URGENCY (1-4)</label>
                  <div className="relative">
                      <select 
                          className={`${inputClass} appearance-none`}
                          value={newTask.urgency}
                          onChange={e => setNewTask({...newTask, urgency: e.target.value as Urgency})}
                      >
                          <option value={Urgency.LOW}>1 - Low</option>
                          <option value={Urgency.MEDIUM}>2 - Medium</option>
                          <option value={Urgency.HIGH}>3 - High</option>
                          <option value={Urgency.CRITICAL}>4 - Critical</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-600">
                            <i className="fas fa-chevron-down"></i>
                      </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>IMPORTANCE (1-4)</label>
                  <div className="relative">
                      <select 
                          className={`${inputClass} appearance-none`}
                          value={newTask.importance}
                          onChange={e => setNewTask({...newTask, importance: e.target.value as Importance})}
                      >
                          <option value={Importance.LOW}>1 - Low</option>
                          <option value={Importance.MEDIUM}>2 - Medium</option>
                          <option value={Importance.HIGH}>3 - High</option>
                          <option value={Importance.CRITICAL}>4 - Critical</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-600">
                            <i className="fas fa-chevron-down"></i>
                      </div>
                  </div>
                </div>
            </div>

            {/* Calculated Priority Preview */}
            <div className="bg-slate-100 p-3 rounded-lg mb-6 flex justify-between items-center border border-slate-200">
               <span className="text-sm font-bold text-slate-600 uppercase">Priority Score</span>
               <span className="text-xl font-bold text-slate-900">
                  {calculatePriority(newTask.importance || Importance.LOW, newTask.urgency || Urgency.LOW)} 
                  <span className="text-sm text-slate-500 font-normal ml-1">/ 32</span>
               </span>
            </div>

            {/* Attachments Section in Form */}
            <div className="mb-6">
               <label className={labelClass}>ATTACHMENTS</label>
               <div className="flex flex-wrap gap-3 items-center">
                  {manualAttachments.map(att => (
                     <div key={att.id} className="relative w-20 h-20 border rounded-lg overflow-hidden shadow-sm">
                        {att.type === 'image' ? (
                          <img src={att.url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100"><i className="fas fa-file text-2xl text-slate-400"></i></div>
                        )}
                        <button 
                          onClick={() => setManualAttachments(prev => prev.filter(p => p.id !== att.id))}
                          className="absolute top-0 right-0 bg-red-500 text-white w-6 h-6 flex items-center justify-center text-xs"
                        >x</button>
                     </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-sky-500 hover:text-sky-500 text-slate-400 transition bg-white">
                     <i className="fas fa-camera mb-1 text-xl"></i>
                     <span className="text-[10px] uppercase font-bold">Add</span>
                     <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        capture="environment" 
                        className="hidden" 
                        onChange={handleFileUpload}
                     />
                  </label>
               </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-6">
                <button onClick={() => setShowManualAdd(false)} className="text-slate-600 px-6 py-3 hover:bg-slate-100 rounded-lg font-medium text-base">Cancel</button>
                <button onClick={handleManualSubmit} className="bg-sky-600 text-white px-8 py-3 rounded-lg hover:bg-sky-700 shadow-md font-bold text-base">Save Task</button>
            </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex space-x-3 mb-6 overflow-x-auto pb-2">
        {(['all', 'todo', 'urgent'] as const).map(f => (
            <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full text-sm font-bold capitalize whitespace-nowrap shadow-sm transition ${
                    filter === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
            >
                {f}
            </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {sortedTasks.map(task => {
          const priorityScore = calculatePriority(task.importance, task.urgency);
          return (
            <div 
                key={task.id} 
                onClick={() => onTaskClick?.(task)}
                className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 cursor-pointer active:bg-slate-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                     <span className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold flex-shrink-0" title="Priority Score">
                        {priorityScore}
                     </span>
                     <h3 className="font-bold text-lg text-slate-800 leading-tight">{task.shortDescription}</h3>
                  </div>
                  <div className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider whitespace-nowrap ml-2 ${
                      task.urgency === Urgency.CRITICAL ? 'bg-red-100 text-red-800' :
                      task.urgency === Urgency.HIGH ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                  }`}>
                      {task.urgency}
                  </div>
                </div>
                <p className="text-base text-slate-600 mt-2 ml-12 line-clamp-2">{task.longDescription || 'No details provided.'}</p>
                
                <div className="flex flex-wrap gap-2 mt-4 ml-12 text-xs font-medium text-slate-600">
                  <span className="bg-slate-100 px-3 py-1.5 rounded-md flex items-center border border-slate-200">
                      <i className="fas fa-user mr-2 text-slate-400"></i> {task.forWho}
                  </span>
                  {task.where && (
                      <span className="bg-slate-100 px-3 py-1.5 rounded-md flex items-center border border-slate-200">
                          <i className="fas fa-map-marker-alt mr-2 text-slate-400"></i> {task.where}
                      </span>
                  )}
                  {task.when && (
                      <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md flex items-center border border-blue-100">
                          <i className="fas fa-calendar mr-2"></i> {new Date(task.when).toLocaleDateString()}
                      </span>
                  )}
                  {task.linkedEmail && (
                      <a 
                          href={task.linkedEmail.startsWith('http') ? task.linkedEmail : `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(task.linkedEmail)}`}
                          target="_blank"
                          rel="noreferrer" 
                          className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-md flex items-center hover:bg-yellow-100 border border-yellow-200 transition-colors group/link"
                          onClick={(e) => e.stopPropagation()}
                      >
                          <i className="fas fa-envelope mr-2"></i> 
                          <span className="truncate max-w-[150px] inline-block align-bottom">
                            {task.linkedEmail.startsWith('http') ? 'View Email' : task.linkedEmail}
                          </span>
                      </a>
                  )}
                </div>

                {/* Attachments Display */}
                {task.attachments.length > 0 && (
                    <div className="mt-4 ml-12 flex gap-3 overflow-x-auto pb-2">
                        {task.attachments.map(att => (
                            <a 
                                key={att.id} 
                                href={att.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 relative shadow-sm flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {att.type === 'image' ? (
                                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                                        <i className="fas fa-file text-2xl"></i>
                                    </div>
                                )}
                            </a>
                        ))}
                    </div>
                )}
              </div>

              <div 
                className="flex md:flex-col justify-end gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4"
                onClick={(e) => e.stopPropagation()}
              >
                  {/* Attachment Button */}
                  <label className="cursor-pointer text-slate-400 hover:text-sky-600 p-2 flex items-center justify-center bg-slate-50 md:bg-transparent rounded">
                      <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*,application/pdf"
                          capture="environment"
                          onChange={(e) => handleFileUpload(e, task.id)}
                      />
                      <i className="fas fa-paperclip fa-lg"></i>
                  </label>
                  
                  <button 
                      onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? {...t, status: TaskStatus.DONE} : t))}
                      className={`p-2 rounded flex items-center justify-center ${task.status === TaskStatus.DONE ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-300 hover:text-green-500'}`}
                  >
                      <i className="fas fa-check-circle fa-lg"></i>
                  </button>
                  <button 
                      className="p-2 text-slate-300 hover:text-red-500 rounded flex items-center justify-center bg-slate-50 md:bg-transparent hover:bg-red-50"
                      onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                  >
                      <i className="fas fa-trash fa-lg"></i>
                  </button>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-slate-400">
                <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-clipboard-check text-4xl text-slate-300"></i>
                </div>
                <p className="text-lg">No tasks found in this view.</p>
            </div>
        )}
      </div>
    </div>
  );
};