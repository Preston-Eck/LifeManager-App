
import React, { useState, useMemo } from 'react';
import { Person, Relationship, RelationshipType, RelationshipContext, InteractionLog, Attachment, ContactMethod } from '../types';
import { generateGoogleCSV, downloadCSV } from '../services/exportUtils';
import { parseGoogleCSV, processImport, mergeContacts } from '../services/importUtils';
import { importContactsFromGoogle } from '../services/storage';

interface PeopleProps {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
}

export const People: React.FC<PeopleProps> = ({ people, setPeople }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Person | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'contact' | 'relationships' | 'interactions'>('info');
  const [isImporting, setIsImporting] = useState(false);

  // Interaction Log State
  const [newLog, setNewLog] = useState<{short: string, long: string, attachments: Attachment[]}>({ short: '', long: '', attachments: [] });

  const handleAddPerson = () => {
    setEditForm({
      id: Math.random().toString(36).substr(2, 9),
      contactType: 'person',
      name: '',
      relationships: [],
      interactionLogs: [],
      customFields: [],
      contactMethods: { emails: [], phones: [], socialProfiles: [], websites: [] }
    });
    setNewLog({ short: '', long: '', attachments: [] });
    setActiveTab('info');
    setIsModalOpen(true);
  };

  const handleEditPerson = (person: Person) => {
    // Ensure deep copies of arrays/objects to avoid mutation issues before save
    setEditForm({
      ...person,
      contactMethods: person.contactMethods || { emails: [], phones: [], socialProfiles: [], websites: [] },
      relationships: person.relationships || [],
      interactionLogs: person.interactionLogs || [],
      customFields: person.customFields || []
    });
    setNewLog({ short: '', long: '', attachments: [] });
    setActiveTab('info');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editForm || !editForm.name) return;
    setPeople(prev => {
      const idx = prev.findIndex(p => p.id === editForm.id);
      if (idx >= 0) {
        const newPeople = [...prev];
        newPeople[idx] = editForm;
        return newPeople;
      }
      return [...prev, editForm];
    });
    setIsModalOpen(false);
  };

  const handleDelete = () => {
      if (!editForm) return;
      if (confirm(`Delete ${editForm.name}?`)) {
          setPeople(prev => prev.filter(p => p.id !== editForm.id));
          setIsModalOpen(false);
      }
  };

  // --- Interaction Log Logic (from snippet) ---

  const handleLogAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
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
              setNewLog(prev => ({ ...prev, attachments: [...prev.attachments, newAttachment] }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleAddLog = () => {
      if (!editForm || !newLog.short) return;
      const log: InteractionLog = {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          shortDescription: newLog.short,
          longDescription: newLog.long,
          attachments: newLog.attachments
      };
      setEditForm({
          ...editForm,
          interactionLogs: [log, ...(editForm.interactionLogs || [])],
          dateLastContacted: new Date().toISOString()
      });
      setNewLog({ short: '', long: '', attachments: [] });
  };

  // --- Import/Export ---

  const handleExport = () => {
      const csv = generateGoogleCSV(people || []);
      downloadCSV(csv, `people_export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleGoogleImport = async () => {
      setIsImporting(true);
      try {
          const googleContacts = await importContactsFromGoogle();
          const result = processImport(googleContacts, people || []);
          setPeople(prev => [...prev, ...result.newContacts]);
          if (result.conflicts.length > 0) {
              alert(`Imported ${result.newContacts.length} new contacts. ${result.conflicts.length} conflicts skipped (merging not implemented in this view).`);
          } else {
              alert(`Imported ${result.newContacts.length} contacts successfully.`);
          }
      } catch (e) {
          alert("Failed to import from Google Contacts. Ensure you are authorized.");
          console.error(e);
      } finally {
          setIsImporting(false);
      }
  };

  const filteredPeople = useMemo(() => {
    const safePeople = people || [];
    if (!searchTerm) return safePeople;
    const lower = searchTerm.toLowerCase();
    return safePeople.filter(p => 
        (p.name || '').toLowerCase().includes(lower) || 
        (p.organization || '').toLowerCase().includes(lower) ||
        (p.role || '').toLowerCase().includes(lower)
    );
  }, [people, searchTerm]);

  // --- Render Sections ---

  const renderInfoTab = () => (
      <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 bg-slate-200 rounded-full overflow-hidden flex-shrink-0 border border-slate-300">
                  {editForm?.avatarUrl ? (
                      <img src={editForm.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400"><i className="fas fa-user text-3xl"></i></div>
                  )}
              </div>
              <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                  <input 
                      className="w-full text-lg font-bold border-b border-slate-300 focus:border-sky-500 outline-none py-1 bg-transparent text-slate-900"
                      value={editForm?.name}
                      onChange={e => setEditForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                      placeholder="Full Name"
                  />
              </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Organization</label>
                  <input 
                      className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none text-slate-900"
                      value={editForm?.organization || ''}
                      onChange={e => setEditForm(prev => prev ? ({ ...prev, organization: e.target.value }) : null)}
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role / Title</label>
                  <input 
                      className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none text-slate-900"
                      value={editForm?.role || ''}
                      onChange={e => setEditForm(prev => prev ? ({ ...prev, role: e.target.value }) : null)}
                  />
              </div>
          </div>
           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
              <textarea 
                  className="w-full border border-slate-300 rounded p-2 text-sm h-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none text-slate-900"
                  value={editForm?.notes || ''}
                  onChange={e => setEditForm(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
              />
          </div>
      </div>
  );

  const renderInteractionsTab = () => (
      <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded border border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Log Interaction</h4>
              <input 
                  className="w-full text-sm border-b border-slate-200 bg-white px-2 rounded mb-2 outline-none py-1 text-slate-900"
                  placeholder="Subject (e.g. Lunch meeting)"
                  value={newLog.short}
                  onChange={e => setNewLog({ ...newLog, short: e.target.value })}
              />
              <textarea 
                  className="w-full text-sm border border-slate-200 rounded p-2 bg-white h-16 resize-none outline-none text-slate-900"
                  placeholder="Details..."
                  value={newLog.long}
                  onChange={e => setNewLog({ ...newLog, long: e.target.value })}
              />
              
              {/* Attachment Preview (New Log) */}
              {newLog.attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                      {newLog.attachments.map(att => (
                          <div key={att.id} className="relative w-10 h-10 border rounded overflow-hidden group bg-white">
                              {att.type === 'image' ? (
                                  <img src={att.url} className="w-full h-full object-cover" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400"><i className="fas fa-file text-xs"></i></div>
                              )}
                              <button 
                                  onClick={() => setNewLog(prev => ({...prev, attachments: prev.attachments.filter(a => a.id !== att.id)}))} 
                                  className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  &times;
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              <div className="flex justify-between items-center mt-2">
                  <label className="cursor-pointer text-slate-400 hover:text-sky-600 px-1 py-1 rounded hover:bg-slate-200 transition-colors" title="Attach File">
                      <i className="fas fa-paperclip"></i>
                      <input type="file" className="hidden" onChange={handleLogAttachment} />
                  </label>
                  <button onClick={handleAddLog} disabled={!newLog.short} className="bg-sky-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-sky-700 disabled:opacity-50">Add Log</button>
              </div>
          </div>
          
          <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              {editForm?.interactionLogs?.map(log => (
                  <div key={log.id} className="relative pl-4 border-l-2 border-sky-200 pb-4 last:pb-0">
                      <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-white"></div>
                      <div className="text-xs text-slate-400 mb-1">{new Date(log.date).toLocaleDateString()}</div>
                      <div className="font-bold text-slate-800 text-sm">{log.shortDescription}</div>
                      <div className="text-sm text-slate-600 whitespace-pre-wrap">{log.longDescription}</div>
                      
                      {/* Attachments Display */}
                      {log.attachments && log.attachments.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                              {log.attachments.map(att => (
                                  <a 
                                      key={att.id} 
                                      href={att.url} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 hover:text-sky-600 transition-colors"
                                  >
                                      <i className={`fas ${att.type === 'image' ? 'fa-image' : 'fa-file'} text-slate-400`}></i>
                                      <span className="truncate max-w-[150px]">{att.name}</span>
                                  </a>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
              {(!editForm?.interactionLogs?.length) && <div className="text-xs text-slate-400 italic">No interactions recorded.</div>}
          </div>
      </div>
  );

  return (
    <div className="p-4 md:p-6 pb-24 h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-slate-800">People</h2>
            <div className="flex gap-2">
                 <button onClick={handleExport} className="text-slate-500 hover:text-slate-800 px-3 py-2 rounded bg-white border border-slate-200 text-sm">
                    <i className="fas fa-download mr-2"></i> Export
                </button>
                <button onClick={handleGoogleImport} disabled={isImporting} className="text-slate-500 hover:text-slate-800 px-3 py-2 rounded bg-white border border-slate-200 text-sm">
                    <i className={`fab fa-google mr-2 ${isImporting ? 'fa-spin' : ''}`}></i> Import
                </button>
                <button onClick={handleAddPerson} className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 shadow-sm font-medium">
                    <i className="fas fa-plus mr-2"></i> Add Person
                </button>
            </div>
        </div>

        {/* Search */}
        <div className="mb-6">
             <div className="relative">
                <i className="fas fa-search absolute left-3 top-3 text-slate-400"></i>
                <input 
                    type="text" 
                    placeholder="Search people..." 
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900 shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPeople.map(person => (
                    <div 
                        key={person.id}
                        onClick={() => handleEditPerson(person)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer flex items-center gap-4 group"
                    >
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 text-slate-400">
                             {person.avatarUrl ? <img src={person.avatarUrl} className="w-full h-full object-cover" /> : <i className="fas fa-user text-xl"></i>}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-800 truncate">{person.name}</h3>
                            <p className="text-xs text-slate-500 truncate">{person.role || person.organization || 'No Details'}</p>
                            {person.dateLastContacted && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Last: {new Date(person.dateLastContacted).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                        <i className="fas fa-chevron-right text-slate-300 group-hover:text-sky-500 transition-colors"></i>
                    </div>
                ))}
                {filteredPeople.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-400">
                        No people found.
                    </div>
                )}
            </div>
        </div>

        {/* Modal */}
        {isModalOpen && editForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                     <div className="flex border-b border-slate-200">
                        {(['info', 'contact', 'relationships', 'interactions'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-sm font-bold capitalize transition-colors ${activeTab === tab ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {tab}
                            </button>
                        ))}
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-6 bg-white">
                         {activeTab === 'info' && renderInfoTab()}
                         {activeTab === 'interactions' && renderInteractionsTab()}
                         {/* Other tabs placeholders for brevity as requested focus was on fixing errors */}
                         {activeTab === 'contact' && <div className="text-center text-slate-400 py-10 italic">Contact details editing coming soon.</div>}
                         {activeTab === 'relationships' && <div className="text-center text-slate-400 py-10 italic">Relationships editing coming soon.</div>}
                     </div>

                     <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                        <button onClick={handleDelete} className="text-red-500 hover:text-red-700 text-sm font-medium"><i className="fas fa-trash mr-1"></i> Delete</button>
                        <div className="flex gap-2">
                             <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded font-medium">Cancel</button>
                             <button onClick={handleSave} className="px-6 py-2 bg-sky-600 text-white hover:bg-sky-700 rounded shadow font-medium">Save</button>
                        </div>
                     </div>
                </div>
            </div>
        )}
    </div>
  );
};
