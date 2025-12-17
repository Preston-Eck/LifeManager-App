
import React, { useState, useEffect } from 'react';
import { Task, Event, TaskStatus, Urgency, Importance, UpdateLog, Attachment, GoogleCalendar } from '../types';

interface DetailSidebarProps {
  isOpen: boolean;
  item: Task | Event | null;
  calendars: GoogleCalendar[];
  onClose: () => void;
  onSave: (updatedItem: Task | Event) => void;
  onCreateNote?: (event: Event) => void;
  onDelete?: (item: Task | Event) => void;
}

export const DetailSidebar: React.FC<DetailSidebarProps> = ({ isOpen, item, calendars, onClose, onSave, onCreateNote, onDelete }) => {
  const [formData, setFormData] = useState<Task | Event | null>(null);
  const [newUpdate, setNewUpdate] = useState('');
  const [newUpdateAttachments, setNewUpdateAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    setFormData(item);
    setNewUpdate('');
    setNewUpdateAttachments([]);
  }, [item]);

  if (!isOpen || !formData) return null;

  const isTask = (i: any): i is Task => 'status' in i;

  const handleSave = () => {
    if (formData) {
        onSave(formData);
        onClose();
    }
  };

  const handleDelete = () => {
      if (onDelete && formData) {
          if (confirm('Are you sure you want to delete this item?')) {
              onDelete(formData);
              onClose();
          }
      }
  }

  const addUpdate = () => {
    if (!newUpdate.trim() && newUpdateAttachments.length === 0) return;
    const update: UpdateLog = {
        id: Math.random().toString(),
        timestamp: new Date().toISOString(),
        content: newUpdate,
        attachments: newUpdateAttachments
    };
    const currentUpdates = formData.updates || [];
    setFormData({ ...formData, updates: [update, ...currentUpdates] });
    setNewUpdate('');
    setNewUpdateAttachments([]);
  };

  const validateFileSize = (file: File) => {
      if (file.size > 1024 * 1024) { // 1MB Limit
          alert("File is too large for synchronization (Limit: 1MB). Please use a smaller file or host it externally.");
          return false;
      }
      return true;
  };

  const handleUpdateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!validateFileSize(file)) {
          e.target.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          const result = reader.result as string;
          const newAttachment: Attachment = {
            id: Math.random().toString(),
            name: file.name,
            type: file.type.startsWith('image') ? 'image' : 'file',
            url: result // Stores Base64 string for persistence
          };
          setNewUpdateAttachments(prev => [...prev, newAttachment]);
      };
      
      reader.readAsDataURL(file);
    }
  };

  // Handle main attachments (for Tasks mostly)
  const handleMainFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && isTask(formData)) {
        const file = e.target.files[0];
        if (!validateFileSize(file)) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const newAttachment: Attachment = {
                id: Math.random().toString(),
                name: file.name,
                type: file.type.startsWith('image') ? 'image' : 'file',
                url: result
            };
            const currentAttachments = (formData as Task).attachments || [];
            setFormData({ ...formData, attachments: [...currentAttachments, newAttachment] });
        };
        reader.readAsDataURL(file);
    }
  };

  const removeMainAttachment = (attId: string) => {
      if (isTask(formData)) {
          const currentAttachments = formData.attachments || [];
          setFormData({ ...formData, attachments: currentAttachments.filter(a => a.id !== attId) });
      }
  };

  const handleChange = (field: string, value: any) => {
    // If status changes to DONE, set completedAt and reset priority
    if (field === 'status' && isTask(formData)) {
        const newStatus = value as TaskStatus;
        const completedAt = newStatus === TaskStatus.DONE ? new Date().toISOString() : undefined;
        // When completed, set importance/urgency to LOW (effectively null in our logic)
        setFormData({ 
            ...formData, 
            [field]: value, 
            completedAt,
            importance: newStatus === TaskStatus.DONE ? Importance.LOW : formData.importance,
            urgency: newStatus === TaskStatus.DONE ? Urgency.LOW : formData.urgency
        });
    } else {
        setFormData({ ...formData, [field]: value });
    }
  };

  const handleDurationChange = (type: 'hours' | 'minutes', val: string) => {
      if (!isTask(formData)) return;
      const num = val === '' ? 0 : parseInt(val);
      const currentDuration = formData.duration || { hours: 0, minutes: 0 };
      setFormData({
          ...formData,
          duration: { ...currentDuration, [type]: num }
      });
  };

  const commonInputClass = "w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 bg-white text-base shadow-sm";
  const labelClass = "block text-sm font-bold text-slate-700 uppercase mb-1.5 tracking-wide";

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      {/* Sidebar */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 flex justify-between items-center bg-white">
            <h2 className="font-bold text-xl md:text-2xl text-slate-900">
                {isTask(formData) ? 'Edit Task' : 'Edit Event'}
            </h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-2 rounded-full hover:bg-slate-100">
                <i className="fas fa-times fa-lg text-xl"></i>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-white">
            {/* Event Specific Actions */}
            {!isTask(formData) && onCreateNote && (
                <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl flex flex-col gap-2">
                    <h3 className="font-bold text-sky-900 text-sm uppercase">Meeting Actions</h3>
                    <button 
                        onClick={() => onCreateNote(formData as Event)}
                        className="flex items-center justify-center gap-2 bg-sky-600 text-white p-3 rounded-lg hover:bg-sky-700 transition font-medium"
                    >
                        <i className="fas fa-pen-fancy"></i> Create Meeting Note
                    </button>
                </div>
            )}

            {/* Title / Short Desc */}
            <div>
                <label className={labelClass}>
                    {isTask(formData) ? 'TASK NAME' : 'EVENT TITLE'}
                </label>
                <input 
                    className={`${commonInputClass} font-bold text-lg`}
                    value={isTask(formData) ? formData.shortDescription : formData.title}
                    onChange={(e) => isTask(formData) 
                        ? handleChange('shortDescription', e.target.value) 
                        : handleChange('title', e.target.value)
                    }
                />
            </div>

            {/* Task Specific Fields */}
            {isTask(formData) && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Status</label>
                            <div className="relative">
                                <select 
                                    className={`${commonInputClass} appearance-none`}
                                    value={formData.status}
                                    onChange={(e) => handleChange('status', e.target.value)}
                                >
                                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-600">
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>CONTEXT (Work/Home)</label>
                            <input 
                                className={commonInputClass}
                                value={formData.forWho || ''}
                                onChange={(e) => handleChange('forWho', e.target.value)}
                                placeholder="e.g. Work: MGC"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>ASSIGNEE (Who)</label>
                            <input 
                                className={commonInputClass}
                                value={formData.assignee || ''}
                                onChange={(e) => handleChange('assignee', e.target.value)}
                                placeholder="e.g. Me, John"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Urgency</label>
                            <div className="relative">
                                <select 
                                    className={`${commonInputClass} appearance-none`}
                                    value={formData.urgency}
                                    onChange={(e) => handleChange('urgency', e.target.value)}
                                >
                                     {Object.values(Urgency).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-600">
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Importance</label>
                            <div className="relative">
                                <select 
                                    className={`${commonInputClass} appearance-none`}
                                    value={formData.importance}
                                    onChange={(e) => handleChange('importance', e.target.value)}
                                >
                                     {Object.values(Importance).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-600">
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Date & Location (Common) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className={labelClass}>When</label>
                    <input 
                        type="datetime-local"
                        className={commonInputClass}
                        value={formData.when ? formData.when.slice(0, 16) : ''}
                        onChange={(e) => handleChange('when', new Date(e.target.value).toISOString())}
                    />
                 </div>
                 <div>
                    <label className={labelClass}>Where</label>
                    <input 
                        className={commonInputClass}
                        value={formData.where || ''}
                        onChange={(e) => handleChange('where', e.target.value)}
                        placeholder="Location"
                    />
                 </div>
            </div>

            {/* Duration (Tasks Only) */}
            {isTask(formData) && (
                <div>
                     <label className={labelClass}>Est. Duration</label>
                     <div className="flex gap-4">
                        <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg px-2 shadow-sm focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent">
                             <input 
                                type="number" 
                                min="0" 
                                className="w-full p-3 outline-none text-slate-900 bg-transparent text-base rounded-lg"
                                value={formData.duration?.hours === 0 ? '' : formData.duration?.hours}
                                onChange={(e) => handleDurationChange('hours', e.target.value)}
                                placeholder="0"
                             />
                             <span className="text-slate-500 text-xs font-bold px-2">HRS</span>
                        </div>
                        <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg px-2 shadow-sm focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent">
                             <input 
                                type="number" 
                                min="0" 
                                max="59"
                                className="w-full p-3 outline-none text-slate-900 bg-transparent text-base rounded-lg"
                                value={formData.duration?.minutes === 0 ? '' : formData.duration?.minutes}
                                onChange={(e) => handleDurationChange('minutes', e.target.value)}
                                placeholder="0"
                             />
                             <span className="text-slate-500 text-xs font-bold px-2">MIN</span>
                        </div>
                     </div>
                </div>
            )}
            
            {/* Task Linked Email */}
            {isTask(formData) && (
                <div>
                    <label className={labelClass}>Linked Email</label>
                    <div className="flex items-center gap-2">
                        <input 
                            className={commonInputClass}
                            value={formData.linkedEmail || ''}
                            onChange={(e) => handleChange('linkedEmail', e.target.value)}
                            placeholder="Gmail URL or Subject"
                        />
                        {formData.linkedEmail && (
                             <a 
                                href={formData.linkedEmail.startsWith('http') ? formData.linkedEmail : `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(formData.linkedEmail)}`}
                                target="_blank"
                                rel="noreferrer" 
                                className="bg-slate-200 p-3 rounded-lg hover:bg-slate-300 text-slate-700 transition"
                                title="Open"
                             >
                                <i className="fas fa-external-link-alt text-lg"></i>
                             </a>
                        )}
                    </div>
                </div>
            )}

            {/* Description (Common) */}
            <div>
                <label className={labelClass}>DESCRIPTION</label>
                <textarea 
                    className={`${commonInputClass} h-32`}
                    value={isTask(formData) ? (formData.longDescription || '') : (formData.description || '')}
                    onChange={(e) => isTask(formData) 
                        ? handleChange('longDescription', e.target.value)
                        : handleChange('description', e.target.value)
                    }
                    placeholder="Add detailed notes here..."
                />
            </div>

            {/* Attachments Section (Main) */}
            {isTask(formData) && (
                <div>
                    <label className={labelClass}>Attachments</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                         {formData.attachments?.map((att) => (
                             <div key={att.id} className="relative w-24 h-24 border rounded-lg overflow-hidden flex-shrink-0 group">
                                {att.type === 'image' ? (
                                    <img src={att.url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500"><i className="fas fa-file text-2xl"></i></div>
                                )}
                                <button 
                                    onClick={() => removeMainAttachment(att.id)}
                                    className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >&times;</button>
                             </div>
                         ))}
                         
                         <label className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-sky-500 hover:text-sky-500 text-slate-400 transition bg-white">
                             <i className="fas fa-plus text-xl mb-1"></i>
                             <span className="text-[10px] uppercase font-bold">Upload</span>
                             <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,application/pdf"
                                capture="environment"
                                onChange={handleMainFileUpload}
                             />
                         </label>
                    </div>
                </div>
            )}

            {/* Calendar Sync Selection */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-900 uppercase mb-2 flex items-center gap-2">
                    <i className="fab fa-google text-slate-500 text-lg"></i> Google Calendar Sync
                </label>
                <div className="relative">
                    <select 
                        className={`${commonInputClass} appearance-none`}
                        value={formData.calendarId || ''}
                        onChange={(e) => handleChange('calendarId', e.target.value)}
                    >
                        <option value="">-- Do Not Sync --</option>
                        {calendars.map(cal => (
                            <option key={cal.id} value={cal.id}>
                                {cal.name} ({cal.accountId})
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-600">
                        <i className="fas fa-chevron-down text-xs"></i>
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    {formData.calendarId ? 'Updates will be synced to Google Calendar.' : 'Select a calendar to sync this item.'}
                </p>
            </div>

            {/* Updates Section */}
            <div className="border-t border-slate-200 pt-6 mt-2">
                <h3 className="font-bold text-lg text-slate-900 mb-3">Updates & Notes</h3>
                
                {/* Staged Attachments Preview */}
                {newUpdateAttachments.length > 0 && (
                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                        {newUpdateAttachments.map((att) => (
                            <div key={att.id} className="relative w-20 h-20 border rounded-lg overflow-hidden flex-shrink-0">
                                {att.type === 'image' ? (
                                    <img src={att.url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500"><i className="fas fa-file text-xl"></i></div>
                                )}
                                <button 
                                    onClick={() => setNewUpdateAttachments(prev => prev.filter(p => p.id !== att.id))}
                                    className="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 flex items-center justify-center text-xs"
                                >&times;</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2 mb-4 items-end">
                    <div className="flex-1 relative">
                        <input 
                            className="w-full border border-slate-300 p-3 pr-10 rounded-lg text-base text-slate-900 bg-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none shadow-sm"
                            placeholder="Add a quick update..."
                            value={newUpdate}
                            onChange={(e) => setNewUpdate(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addUpdate()}
                        />
                        <label className="absolute right-2 top-2.5 cursor-pointer text-slate-400 hover:text-sky-600 p-1">
                             <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,application/pdf"
                                capture="environment"
                                onChange={handleUpdateFileUpload}
                             />
                             <i className="fas fa-camera fa-lg"></i>
                        </label>
                    </div>
                    
                    <button onClick={addUpdate} className="bg-sky-600 hover:bg-sky-700 px-4 py-3 rounded-lg text-white shadow">
                        <i className="fas fa-paper-plane text-lg"></i>
                    </button>
                </div>

                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {formData.updates?.map(u => (
                        <div key={u.id} className="bg-slate-50 p-4 rounded-xl text-base border border-slate-200 shadow-sm">
                            <div className="text-xs text-slate-500 mb-1 font-semibold">{new Date(u.timestamp).toLocaleString()}</div>
                            <div className="text-slate-900 mb-2 leading-relaxed">{u.content}</div>
                            
                            {/* Attachments in history */}
                            {u.attachments && u.attachments.length > 0 && (
                                <div className="flex gap-2 mt-2 overflow-x-auto">
                                    {u.attachments.map(att => (
                                        <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                                            {att.type === 'image' ? (
                                                <img src={att.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-white flex items-center justify-center text-slate-400"><i className="fas fa-file text-xl"></i></div>
                                            )}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {(!formData.updates || formData.updates.length === 0) && (
                        <p className="text-sm text-slate-500 italic text-center py-4">No updates yet.</p>
                    )}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-slate-200 bg-slate-50 flex justify-between items-center pb-safe">
            {onDelete ? (
                <button 
                    onClick={handleDelete}
                    className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 px-2"
                >
                    <i className="fas fa-trash"></i> Delete
                </button>
            ) : (
                <div></div>
            )}
            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-3 text-slate-700 hover:bg-slate-200 rounded-lg font-medium text-base">Cancel</button>
                <button onClick={handleSave} className="px-6 py-3 bg-sky-600 text-white hover:bg-sky-700 rounded-lg shadow-lg font-bold text-base">Save Changes</button>
            </div>
        </div>
      </div>
    </div>
  );
};
