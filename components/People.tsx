
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Person, RelationshipType, RelationshipContext, InteractionLog, Attachment, ContactMethod } from '../types';
import { parseGoogleCSV, processImport, mergeContacts, ImportConflict } from '../services/importUtils';
import { generateGoogleCSV, downloadCSV } from '../services/exportUtils';

interface PeopleProps {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
}

// --- Constants & Helpers ---

const DEPT_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#6366f1', '#84cc16', '#06b6d4', '#d946ef'
];

const getRelationshipLabel = (type: RelationshipType, context: RelationshipContext, isReverse: boolean = false): string => {
    if (context === RelationshipContext.WORK) {
        switch (type) {
            case RelationshipType.PARENT: return isReverse ? 'Direct Report' : 'Manager/Owner';
            case RelationshipType.CHILD: return isReverse ? 'Manager/Owner' : 'Direct Report';
            case RelationshipType.SIBLING: return 'Colleague';
            case RelationshipType.SPOUSE: return 'Partner';
        }
    }
    switch (type) {
        case RelationshipType.PARENT: return isReverse ? 'Child' : 'Parent';
        case RelationshipType.CHILD: return isReverse ? 'Parent' : 'Child';
        case RelationshipType.SIBLING: return 'Sibling';
        case RelationshipType.SPOUSE: return 'Spouse';
    }
    return type;
};

// --- Physics Types ---

interface GraphNode extends Person {
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx?: number | null; 
    fy?: number | null; 
}

interface ViewTransform {
    x: number;
    y: number;
    k: number; // Scale
}

// --- Sub-Components ---

const ImportWizard = ({ 
    conflicts, decisions, setDecision, onApply, onCancel, setBulk 
}: { 
    conflicts: ImportConflict[], 
    decisions: Record<string, 'merge' | 'keep' | 'create'>, 
    setDecision: (id: string, d: 'merge' | 'keep' | 'create') => void,
    onApply: () => void,
    onCancel: () => void,
    setBulk: (d: 'merge' | 'keep' | 'create') => void
}) => {
    return (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Resolve Import Conflicts</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setBulk('merge')} className="text-xs bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">Merge All</button>
                        <button onClick={() => setBulk('create')} className="text-xs bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">Create All</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {conflicts.map(c => (
                        <div key={c.imported.id} className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                            <div className="flex justify-between mb-2">
                                <span className="text-xs font-bold uppercase text-orange-600 bg-orange-50 px-2 py-1 rounded">Match: {c.matchReason}</span>
                                <div className="flex gap-2 text-sm">
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={decisions[c.imported.id] === 'merge'} onChange={() => setDecision(c.imported.id, 'merge')} /> Merge</label>
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={decisions[c.imported.id] === 'create'} onChange={() => setDecision(c.imported.id, 'create')} /> Create New</label>
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={decisions[c.imported.id] === 'keep'} onChange={() => setDecision(c.imported.id, 'keep')} /> Skip</label>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="font-bold text-slate-500 text-xs mb-1">EXISTING</div>
                                    <div>{c.existing.name}</div>
                                    <div className="text-slate-500">{c.existing.emails?.[0] || 'No Email'}</div>
                                </div>
                                <div>
                                    <div className="font-bold text-sky-500 text-xs mb-1">IMPORTED</div>
                                    <div>{c.imported.name}</div>
                                    <div className="text-slate-500">{c.imported.emails?.[0] || 'No Email'}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                    <button onClick={onApply} className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 shadow">Apply Import</button>
                </div>
            </div>
        </div>
    );
};

const ImportSummary = ({ summary, onClose }: { summary: {created: number, merged: number, skipped: number}, onClose: () => void }) => (
    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                <i className="fas fa-check"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-4">Import Complete</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 p-2 rounded">
                    <div className="text-2xl font-bold text-slate-800">{summary.merged}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Merged</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                    <div className="text-2xl font-bold text-slate-800">{summary.created}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Created</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                    <div className="text-2xl font-bold text-slate-800">{summary.skipped}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Skipped</div>
                </div>
            </div>
            <button onClick={onClose} className="w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-900">Done</button>
        </div>
    </div>
);

const ExportModal = ({ 
    mode, setMode, startDate, setStartDate, endDate, setEndDate, onExport, onCancel 
}: {
    mode: 'all' | 'selected' | 'date-range' | 'since-last',
    setMode: (m: any) => void,
    startDate: string, setStartDate: (s: string) => void,
    endDate: string, setEndDate: (s: string) => void,
    onExport: () => void,
    onCancel: () => void
}) => (
    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Export Contacts</h3>
            
            <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-slate-50">
                    <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
                    <div>
                        <div className="font-bold text-sm text-slate-800">All Contacts</div>
                        <div className="text-xs text-slate-500">Export entire directory</div>
                    </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-slate-50">
                    <input type="radio" checked={mode === 'since-last'} onChange={() => setMode('since-last')} />
                    <div>
                        <div className="font-bold text-sm text-slate-800">Since Last Export</div>
                        <div className="text-xs text-slate-500">Only newly added contacts</div>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-slate-50">
                    <input type="radio" checked={mode === 'date-range'} onChange={() => setMode('date-range')} />
                    <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800 mb-1">Date Range (Date Added)</div>
                        {mode === 'date-range' && (
                            <div className="flex gap-2">
                                <input type="date" className="border rounded px-2 py-1 text-xs w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                <input type="date" className="border rounded px-2 py-1 text-xs w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        )}
                    </div>
                </label>
            </div>

            <div className="flex justify-end gap-3">
                <button onClick={onCancel} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded">Cancel</button>
                <button onClick={onExport} className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 font-bold">Export CSV</button>
            </div>
        </div>
    </div>
);


export const People: React.FC<PeopleProps> = ({ people, setPeople }) => {
  // --- State ---
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'timeline'>('graph'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit & Tab State
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'history' | 'connections' | 'interactions' | 'memorization'>('overview');
  const [editForm, setEditForm] = useState<Partial<Person>>({});
  
  // Interaction Log State
  const [newLog, setNewLog] = useState<{ short: string; long: string; attachments: Attachment[] }>({ short: '', long: '', attachments: [] });
  
  // Graph State
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  
  // Import Wizard State
  const [importStep, setImportStep] = useState<'idle' | 'review' | 'summary'>('idle');
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [newImportedContacts, setNewImportedContacts] = useState<Person[]>([]);
  const [importDecisions, setImportDecisions] = useState<Record<string, 'merge' | 'keep' | 'create'>>({});
  const [importSummary, setImportSummary] = useState({ created: 0, merged: 0, skipped: 0 });

  // Export Wizard State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'selected' | 'date-range' | 'since-last'>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set());
  const [lastExportDate, setLastExportDate] = useState<string | null>(localStorage.getItem('lm_last_export'));

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const draggingRef = useRef<{ isDragging: boolean; node: GraphNode | null; startX: number; startY: number; isViewPan: boolean }>({ 
      isDragging: false, node: null, startX: 0, startY: 0, isViewPan: false 
  });
  const simulationRef = useRef<{ alpha: number }>({ alpha: 1 });

  // --- Derived State ---
  const selectedPerson = useMemo(() => people.find(p => p.id === selectedPersonId) || null, [people, selectedPersonId]);

  // --- Initialization ---

  useEffect(() => {
      if (people.length > 0 && visibleNodeIds.size === 0) {
          const roots = people.filter(p => p.contactType === 'business').map(p => p.id);
          const initialSet = new Set(roots.length > 0 ? roots : people.slice(0, 5).map(p => p.id));
          setVisibleNodeIds(initialSet);
          setTransform({ x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 });
      }
  }, [people]); 

  // Sync Data -> Physics Nodes
  useEffect(() => {
      let targetIds = Array.from(visibleNodeIds);
      if (viewMode === 'timeline') {
          targetIds = targetIds.filter(id => {
              const p = people.find(person => person.id === id);
              return p && p.contactType !== 'business';
          });
      }
      
      const targetIdSet = new Set(targetIds);
      nodesRef.current = nodesRef.current.filter(n => targetIdSet.has(n.id));

      targetIds.forEach(id => {
          if (!nodesRef.current.find(n => n.id === id)) {
              const personData = people.find(p => p.id === id);
              if (personData) {
                  let spawnX = 0, spawnY = 0;
                  if (viewMode === 'timeline') {
                      spawnX = (window.innerWidth / 2 - transform.x) / transform.k + (Math.random() - 0.5) * 100;
                      spawnY = (window.innerHeight / 2 - transform.y) / transform.k;
                  } else {
                      spawnX = (window.innerWidth / 2 - transform.x) / transform.k + (Math.random() - 0.5) * 50;
                      spawnY = (window.innerHeight / 2 - transform.y) / transform.k + (Math.random() - 0.5) * 50;
                  }
                  nodesRef.current.push({ ...personData, x: spawnX, y: spawnY, vx: 0, vy: 0 });
              }
          }
      });
      
      nodesRef.current = nodesRef.current.map(n => {
          const updated = people.find(p => p.id === n.id);
          return updated ? { ...n, ...updated } : n;
      });
      simulationRef.current.alpha = 1;
  }, [visibleNodeIds, people, viewMode]);

  // --- Helpers ---

  const deptColorMap = useMemo(() => {
      const map: Record<string, string> = {};
      const depts = Array.from(new Set(people.map(p => p.department).filter((d): d is string => !!d)));
      depts.forEach((d, i) => map[d] = DEPT_COLORS[i % DEPT_COLORS.length]);
      return map;
  }, [people]);

  const allCustomKeys = useMemo(() => {
      const keys = new Set<string>();
      people.forEach(p => p.customFields?.forEach(f => keys.add(f.label)));
      return Array.from(keys).sort();
  }, [people]);

  // --- IMPORT WIZARD LOGIC ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target?.result as string;
          if (text) {
              const parsed = parseGoogleCSV(text);
              const result = processImport(parsed, people);
              
              if (result.conflicts.length === 0) {
                  setPeople(prev => [...prev, ...result.newContacts]);
                  alert(`Imported ${result.newContacts.length} contacts successfully.`);
              } else {
                  setNewImportedContacts(result.newContacts);
                  setImportConflicts(result.conflicts);
                  const decisions: Record<string, 'merge' | 'keep' | 'create'> = {};
                  result.conflicts.forEach(c => { decisions[c.imported.id] = 'merge'; });
                  setImportDecisions(decisions);
                  setImportStep('review');
              }
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleApplyImport = () => {
      let mergedCount = 0;
      let skippedCount = 0;
      let createdCount = newImportedContacts.length;
      let finalPeople = [...people, ...newImportedContacts];

      importConflicts.forEach((conflict: ImportConflict) => {
          const decision = importDecisions[conflict.imported.id];
          if (decision === 'merge') {
              const merged = mergeContacts(conflict.existing, conflict.imported);
              finalPeople = finalPeople.map(p => p.id === conflict.existing.id ? merged : p);
              mergedCount++;
          } else if (decision === 'create') {
              finalPeople.push(conflict.imported);
              createdCount++;
          } else {
              skippedCount++;
          }
      });

      setPeople(finalPeople);
      setImportSummary({ created: createdCount, merged: mergedCount, skipped: skippedCount });
      setImportStep('summary');
  };

  const setBulkDecision = (decision: 'merge' | 'keep' | 'create') => {
      const newDecisions = { ...importDecisions };
      importConflicts.forEach(c => newDecisions[c.imported.id] = decision);
      setImportDecisions(newDecisions);
  };

  // --- EXPORT LOGIC ---

  const handleExport = () => {
      let contactsToExport: Person[] = [];
      switch (exportMode) {
          case 'all': contactsToExport = people; break;
          case 'selected': contactsToExport = people.filter(p => selectedExportIds.has(p.id)); break;
          case 'date-range':
              const start = exportStartDate ? new Date(exportStartDate).getTime() : 0;
              const end = exportEndDate ? new Date(exportEndDate).getTime() : Infinity;
              contactsToExport = people.filter(p => {
                  const added = p.dateAdded ? new Date(p.dateAdded).getTime() : 0;
                  return added >= start && added <= end;
              });
              break;
          case 'since-last':
              if (lastExportDate) {
                  const last = new Date(lastExportDate).getTime();
                  contactsToExport = people.filter(p => {
                      const added = p.dateAdded ? new Date(p.dateAdded).getTime() : 0;
                      return added > last;
                  });
              } else {
                  contactsToExport = people;
              }
              break;
      }

      if (contactsToExport.length === 0) {
          alert("No contacts match the selected criteria.");
          return;
      }

      const csv = generateGoogleCSV(contactsToExport);
      downloadCSV(csv, `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      
      const now = new Date().toISOString();
      localStorage.setItem('lm_last_export', now);
      setLastExportDate(now);
      setIsExportModalOpen(false);
  };

  // --- Actions ---
  
  const handleSave = () => {
    if (!editForm.id) return;
    setPeople(prev => prev.map(p => p.id === editForm.id ? editForm as Person : p));
    setIsEditing(false);
  };

  const handleDelete = () => {
      if (confirm('Delete this contact?')) {
          const pid = editForm.id!;
          setPeople(prev => prev.filter(p => p.id !== pid));
          setSelectedPersonId(null);
      }
  };

  const handleCreatePerson = () => {
      const newPerson: Person = {
          id: Math.random().toString(),
          contactType: 'person',
          name: 'New Contact',
          relationships: [],
          interactionLogs: [],
          customFields: [],
          addressHistory: [],
          employmentHistory: [],
          emails: [],
          phones: [],
          contactMethods: { emails: [], phones: [], socialProfiles: [], websites: [] },
          dateAdded: new Date().toISOString()
      };
      setPeople(prev => [newPerson, ...prev]);
      setSelectedPersonId(newPerson.id);
      setEditForm(newPerson);
      setIsEditing(true);
      if (!visibleNodeIds.has(newPerson.id)) {
          setVisibleNodeIds(prev => new Set(prev).add(newPerson.id));
      }
  };

  const handleAddLog = () => {
      if (!newLog.short || !editForm.id) return;
      const logEntry: InteractionLog = {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          shortDescription: newLog.short,
          longDescription: newLog.long,
          attachments: newLog.attachments
      };
      const newLogs = [logEntry, ...(editForm.interactionLogs || [])];
      setEditForm({ ...editForm, interactionLogs: newLogs });
      if (!isEditing && selectedPersonId) {
          setPeople(prev => prev.map(p => p.id === selectedPersonId ? { ...p, interactionLogs: newLogs } : p));
      }
      setNewLog({ short: '', long: '', attachments: [] });
  };

  const handleAddRelationship = (newId: string) => {
    if (!newId || !editForm.id) return;
    const target = people.find(p => p.id === newId);
    if (target) {
        const newRels = [...(editForm.relationships || []), { personId: target.id, type: RelationshipType.SIBLING, context: RelationshipContext.WORK }];
        setEditForm({ ...editForm, relationships: newRels });
    }
  };

  const handleCreateAndLink = () => {
      const name = prompt("Enter name for new contact:");
      if (!name) return;
      const newPerson: Person = {
          id: Math.random().toString(),
          name,
          contactType: 'person',
          relationships: [],
          interactionLogs: [],
          customFields: [],
          addressHistory: [],
          employmentHistory: [],
          emails: [],
          phones: [],
          contactMethods: { emails: [], phones: [], socialProfiles: [], websites: [] }
      };
      setPeople(prev => [...prev, newPerson]);
      const newRel = { personId: newPerson.id, type: RelationshipType.SIBLING, context: RelationshipContext.FAMILY };
      setEditForm(prev => ({
          ...prev,
          relationships: [...(prev.relationships || []), newRel]
      }));
  };

  // --- Helpers for Edit Form ---
  const updateContactMethod = (type: 'emails' | 'phones' | 'websites', index: number, field: keyof ContactMethod | 'url', value: string) => {
      const methods = { ...(editForm.contactMethods || { emails: [], phones: [], websites: [], socialProfiles: [] }) };
      const list = [...(methods as any)[type]];
      list[index] = { ...list[index], [field]: value };
      (methods as any)[type] = list;
      setEditForm({ ...editForm, contactMethods: methods });
  };

  const addContactMethod = (type: 'emails' | 'phones' | 'websites') => {
      const methods = { ...(editForm.contactMethods || { emails: [], phones: [], websites: [], socialProfiles: [] }) };
      if (type === 'websites') {
          methods.websites = [...methods.websites, { url: '', label: 'Homepage' }];
      } else {
          (methods as any)[type] = [...(methods as any)[type], { value: '', label: type === 'emails' ? 'Work' : 'Mobile' }];
      }
      setEditForm({ ...editForm, contactMethods: methods });
  };

  const removeContactMethod = (type: 'emails' | 'phones' | 'websites', index: number) => {
      const methods = { ...(editForm.contactMethods || { emails: [], phones: [], websites: [], socialProfiles: [] }) };
      (methods as any)[type] = (methods as any)[type].filter((_: any, i: number) => i !== index);
      setEditForm({ ...editForm, contactMethods: methods });
  };

  // --- Graph Interactions ---

  const handleResetView = () => {
    setTransform({ x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 });
  };

  const handleSearchResultClick = (person: Person) => {
    setSelectedPersonId(person.id);
    setEditForm(person); // Populate form data for viewing
    setIsEditing(false); // Ensure we start in view mode
    
    // Logic to zoom/pan to person can be added here if needed, 
    // for now we just select them which opens sidebar
    if (viewMode !== 'list') {
        const node = nodesRef.current.find(n => n.id === person.id);
        if (node) {
             setTransform(prev => ({
                x: window.innerWidth / 2 - node.x * prev.k,
                y: window.innerHeight / 2 - node.y * prev.k,
                k: prev.k
            }));
        }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
      const mouseY = (e.clientY - rect.top - transform.y) / transform.k;
      const scaleFactor = viewMode === 'timeline' ? 1 / transform.k : 1;
      const hitRadius = 30 * scaleFactor;

      const clickedNode = nodesRef.current.find(n => {
           const dx = n.x - mouseX;
           const dy = n.y - mouseY;
           return Math.sqrt(dx*dx + dy*dy) < hitRadius;
      });

      if (clickedNode) {
          setSelectedPersonId(clickedNode.id);
          setEditForm(clickedNode);
          setIsEditing(true);
      }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }
      
      const mouseX = (clientX - rect.left - transform.x) / transform.k;
      const mouseY = (clientY - rect.top - transform.y) / transform.k;
      const scaleFactor = viewMode === 'timeline' ? 1 / transform.k : 1;
      const hitRadius = 30 * scaleFactor; 

      let clickedNode: GraphNode | undefined;
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
          const n = nodesRef.current[i];
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          if (Math.sqrt(dx*dx + dy*dy) < hitRadius) {
              clickedNode = n;
              break;
          }
      }

      if (clickedNode) {
          draggingRef.current = { isDragging: true, node: clickedNode, startX: mouseX, startY: mouseY, isViewPan: false };
          setSelectedPersonId(clickedNode.id);
          setEditForm(clickedNode); // Load correct data
          setIsEditing(false);
          simulationRef.current.alpha = 1;
      } else {
          draggingRef.current = { isDragging: true, node: null, startX: clientX, startY: clientY, isViewPan: true };
      }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!draggingRef.current.isDragging) return;
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      if (draggingRef.current.isViewPan) {
          const dx = clientX - draggingRef.current.startX;
          const dy = clientY - draggingRef.current.startY;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          draggingRef.current.startX = clientX;
          draggingRef.current.startY = clientY;
      } else if (draggingRef.current.node) {
          const mouseX = (clientX - rect.left - transform.x) / transform.k;
          const mouseY = (clientY - rect.top - transform.y) / transform.k;
          draggingRef.current.node.fx = mouseX;
          draggingRef.current.node.fy = mouseY;
          simulationRef.current.alpha = 1;
      }
  };

  const handleMouseUp = () => {
      if (draggingRef.current.node) {
          draggingRef.current.node.fx = null;
          draggingRef.current.node.fy = null;
      }
      draggingRef.current = { isDragging: false, node: null, startX: 0, startY: 0, isViewPan: false };
  };

  const handleWheel = (e: React.WheelEvent) => {
      const scaleAmount = -e.deltaY * 0.001;
      setTransform(t => ({
          ...t,
          k: Math.max(0.1, Math.min(5, t.k * (1 + scaleAmount)))
      }));
  };

  // --- Render Functions ---

  const renderOverviewTab = () => (
      <div className="space-y-6">
          {/* Header / Avatar */}
          <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-4xl text-slate-400 overflow-hidden relative group">
                  {editForm.avatarUrl ? <img src={editForm.avatarUrl} className="w-full h-full object-cover"/> : (editForm.name?.[0] || '?')}
                  {isEditing && (
                      <button 
                        onClick={() => { const url = prompt("Image URL:"); if (url) setEditForm({...editForm, avatarUrl: url}) }}
                        className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-xs font-bold"
                      >Change</button>
                  )}
              </div>
              <div className="w-full text-center">
                  {isEditing ? (
                      <input 
                        className="w-full text-center font-bold text-lg border-b border-slate-300 focus:border-sky-500 outline-none bg-white text-slate-900 rounded px-2"
                        value={editForm.name} 
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                        placeholder="Full Name"
                      />
                  ) : <div className="font-bold text-xl text-slate-800">{editForm.name}</div>}
              </div>
          </div>

          {/* Professional Info */}
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Organization</label>
                  {isEditing ? (
                      <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white text-slate-900 focus:outline-none focus:border-sky-500" value={editForm.organization || ''} onChange={e => setEditForm({...editForm, organization: e.target.value})} placeholder="Company" />
                  ) : <div className="text-sm text-slate-700">{editForm.organization || '-'}</div>}
              </div>
              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Role / Title</label>
                  {isEditing ? (
                      <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white text-slate-900 focus:outline-none focus:border-sky-500" value={editForm.role || ''} onChange={e => setEditForm({...editForm, role: e.target.value})} placeholder="Job Title" />
                  ) : <div className="text-sm text-slate-700">{editForm.role || '-'}</div>}
              </div>
              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                  {isEditing ? (
                      <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white text-slate-900 focus:outline-none focus:border-sky-500" value={editForm.department || ''} onChange={e => setEditForm({...editForm, department: e.target.value})} placeholder="Dept" />
                  ) : <div className="text-sm text-slate-700">{editForm.department || '-'}</div>}
              </div>
              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                  {isEditing ? (
                      <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white text-slate-900 focus:outline-none focus:border-sky-500" value={editForm.contactType} onChange={e => setEditForm({...editForm, contactType: e.target.value as any})}>
                          <option value="person">Person</option>
                          <option value="business">Business</option>
                      </select>
                  ) : <div className="text-sm text-slate-700 capitalize">{editForm.contactType}</div>}
              </div>
          </div>

          {/* Contact Methods */}
          <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex justify-between items-center">
                  <span>Contact Info</span>
                  {isEditing && (
                      <div className="flex gap-2">
                          <button onClick={() => addContactMethod('emails')} className="text-[10px] bg-sky-50 text-sky-600 px-2 py-1 rounded">+ Email</button>
                          <button onClick={() => addContactMethod('phones')} className="text-[10px] bg-sky-50 text-sky-600 px-2 py-1 rounded">+ Phone</button>
                      </div>
                  )}
              </h4>
              <div className="space-y-3">
                  {/* Emails */}
                  {(editForm.contactMethods?.emails || []).map((email, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm group">
                          <i className="fas fa-envelope text-slate-400 w-4"></i>
                          {isEditing ? (
                              <>
                                <input className="w-16 text-[10px] bg-white border border-slate-300 rounded px-1 text-slate-900" value={email.label} onChange={e => updateContactMethod('emails', i, 'label', e.target.value)} />
                                <input className="flex-1 border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white" value={email.value} onChange={e => updateContactMethod('emails', i, 'value', e.target.value)} />
                                <button onClick={() => removeContactMethod('emails', i)} className="text-red-400">&times;</button>
                              </>
                          ) : (
                              <>
                                <span className="flex-1 text-slate-800">{email.value}</span>
                                <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">{email.label}</span>
                              </>
                          )}
                      </div>
                  ))}
                  {/* Phones */}
                  {(editForm.contactMethods?.phones || []).map((phone, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm group">
                          <i className="fas fa-phone text-slate-400 w-4"></i>
                          {isEditing ? (
                              <>
                                <input className="w-16 text-[10px] bg-white border border-slate-300 rounded px-1 text-slate-900" value={phone.label} onChange={e => updateContactMethod('phones', i, 'label', e.target.value)} />
                                <input className="flex-1 border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white" value={phone.value} onChange={e => updateContactMethod('phones', i, 'value', e.target.value)} />
                                <button onClick={() => removeContactMethod('phones', i)} className="text-red-400">&times;</button>
                              </>
                          ) : (
                              <>
                                <span className="flex-1 text-slate-800">{phone.value}</span>
                                <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">{phone.label}</span>
                              </>
                          )}
                      </div>
                  ))}
                  {/* Websites */}
                  {(editForm.contactMethods?.websites || []).map((web, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm group">
                          <i className="fas fa-globe text-slate-400 w-4"></i>
                          {isEditing ? (
                              <>
                                <input className="w-16 text-[10px] bg-white border border-slate-300 rounded px-1 text-slate-900" value={web.label} onChange={e => updateContactMethod('websites', i, 'label', e.target.value)} />
                                <input className="flex-1 border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white" value={web.url} onChange={e => updateContactMethod('websites', i, 'url', e.target.value)} />
                                <button onClick={() => removeContactMethod('websites', i)} className="text-red-400">&times;</button>
                              </>
                          ) : (
                              <>
                                <a href={web.url} target="_blank" className="flex-1 text-sky-600 hover:underline truncate">{web.url}</a>
                                <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">{web.label}</span>
                              </>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* Dates */}
          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Birthday</label>
                  {isEditing ? (
                      <input type="date" className="w-full border-b border-slate-200 text-sm bg-white text-slate-900" value={editForm.birthday || ''} onChange={e => setEditForm({...editForm, birthday: e.target.value})} />
                  ) : <div className="text-sm text-slate-700">{editForm.birthday ? new Date(editForm.birthday).toLocaleDateString() : '-'}</div>}
              </div>
              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Anniversary</label>
                  {isEditing ? (
                      <input type="date" className="w-full border-b border-slate-200 text-sm bg-white text-slate-900" value={editForm.anniversary || ''} onChange={e => setEditForm({...editForm, anniversary: e.target.value})} />
                  ) : <div className="text-sm text-slate-700">{editForm.anniversary ? new Date(editForm.anniversary).toLocaleDateString() : '-'}</div>}
              </div>
          </div>
      </div>
  );

  const renderDetailsTab = () => (
      <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded border border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Favorites</h4>
              <div className="grid grid-cols-1 gap-3">
                  {['favoriteColors', 'favoriteRestaurants', 'favoriteScriptures', 'allergies'].map(field => (
                      <div key={field}>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">{field.replace('favorite', '').replace(/([A-Z])/g, ' $1').trim()}</label>
                          {isEditing ? (
                              <textarea 
                                  className="w-full border rounded p-2 text-sm bg-white text-slate-900 h-10 resize-none" 
                                  value={((editForm as any)[field] || []).join(', ')}
                                  onChange={e => setEditForm({ ...editForm, [field]: e.target.value.split(',').map((s:string) => s.trim()) })}
                                  placeholder="Comma separated..."
                              />
                          ) : (
                              <div className="text-sm">{((editForm as any)[field] || []).join(', ') || '-'}</div>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* Memorization Tips */}
          <div className="bg-amber-50 p-3 rounded border border-amber-100">
              <h4 className="text-xs font-bold text-amber-800 uppercase mb-2">Memorization Tips</h4>
              {isEditing ? (
                  <textarea 
                      className="w-full bg-white border border-amber-200 p-2 text-sm rounded h-20 text-slate-900"
                      value={editForm.memorizationTips || ''}
                      onChange={e => setEditForm({...editForm, memorizationTips: e.target.value})}
                      placeholder="Mnemonic devices, face features, etc..."
                  />
              ) : (
                  <p className="text-sm text-amber-900 italic">{editForm.memorizationTips || 'No tips added.'}</p>
              )}
          </div>

          <div className="bg-slate-50 p-3 rounded border border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 flex justify-between items-center">
                  <span>Custom Fields</span>
                  {isEditing && (
                      <button 
                        onClick={() => {
                             const key = prompt("Field Name (or select existing):", allCustomKeys[0]);
                             if (key) {
                                 setEditForm({
                                     ...editForm,
                                     customFields: [...(editForm.customFields || []), { id: Math.random().toString(), label: key, value: '' }]
                                 });
                             }
                        }}
                        className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                      >
                          + Add
                      </button>
                  )}
              </h4>
              <div className="space-y-2">
                  {editForm.customFields?.map((field, idx) => (
                      <div key={field.id} className="flex gap-2 items-center">
                          <span className="text-xs font-bold text-slate-500 w-1/3 truncate">{field.label}</span>
                          {isEditing ? (
                              <>
                                <input 
                                    className="flex-1 border rounded p-1 text-sm bg-white text-slate-900" 
                                    value={field.value} 
                                    onChange={e => {
                                        const newFields = [...(editForm.customFields || [])];
                                        newFields[idx] = { ...field, value: e.target.value };
                                        setEditForm({ ...editForm, customFields: newFields });
                                    }}
                                />
                                <button onClick={() => setEditForm({...editForm, customFields: editForm.customFields?.filter(f => f.id !== field.id)})} className="text-red-400">&times;</button>
                              </>
                          ) : (
                              <span className="text-sm flex-1">{field.value}</span>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderHistoryTab = () => (
      <div className="space-y-4">
          <div className="relative border-l-2 border-slate-200 ml-2 space-y-4 pl-4 pb-2">
              <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-300"></div>
              <h4 className="text-xs font-bold text-slate-700 uppercase">Address History</h4>
              
              {isEditing && (
                  <button 
                      onClick={() => setEditForm({...editForm, addressHistory: [{ id: Math.random().toString(), type: 'Current', address: '' }, ...(editForm.addressHistory || [])]})}
                      className="text-xs text-sky-600 mb-2"
                  >+ Add Address</button>
              )}

              {editForm.addressHistory?.map((addr, i) => (
                  <div key={addr.id} className="bg-white p-2 border border-slate-200 rounded text-sm relative group">
                      {isEditing ? (
                          <div className="space-y-1">
                              <select className="border p-1 text-xs bg-white text-slate-900" value={addr.type} onChange={e => {
                                  const list = [...(editForm.addressHistory || [])];
                                  list[i] = { ...addr, type: e.target.value as any };
                                  setEditForm({...editForm, addressHistory: list});
                              }}>
                                  <option>Current</option><option>Previous</option>
                              </select>
                              <input className="w-full border p-1 bg-white text-slate-900" placeholder="Address" value={addr.address} onChange={e => {
                                  const list = [...(editForm.addressHistory || [])];
                                  list[i] = { ...addr, address: e.target.value };
                                  setEditForm({...editForm, addressHistory: list});
                              }}/>
                              <div className="flex gap-2 items-center">
                                  <input type="date" className="border p-1 text-xs bg-white text-slate-900" value={addr.startDate || ''} onChange={e => {
                                      const list = [...(editForm.addressHistory || [])];
                                      list[i] = { ...addr, startDate: e.target.value };
                                      setEditForm({...editForm, addressHistory: list});
                                  }}/>
                                  <span className="text-xs self-center">to</span>
                                  <input 
                                    type="date" 
                                    className="border p-1 text-xs bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400" 
                                    value={addr.endDate || ''} 
                                    disabled={!addr.endDate && addr.type === 'Current'} 
                                    onChange={e => {
                                      const list = [...(editForm.addressHistory || [])];
                                      list[i] = { ...addr, endDate: e.target.value };
                                      setEditForm({...editForm, addressHistory: list});
                                  }}/>
                              </div>
                              <button onClick={() => setEditForm({...editForm, addressHistory: editForm.addressHistory?.filter(a => a.id !== addr.id)})} className="absolute top-1 right-1 text-red-500">&times;</button>
                          </div>
                      ) : (
                          <>
                              <div className="font-bold text-slate-800">{addr.address}</div>
                              <div className="text-xs text-slate-500">
                                  <span className={`px-1.5 py-0.5 rounded mr-2 ${addr.type === 'Current' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>{addr.type}</span>
                                  {addr.startDate || '?'} - {addr.endDate || 'Present'}
                              </div>
                          </>
                      )}
                  </div>
              ))}
          </div>

          <div className="relative border-l-2 border-slate-200 ml-2 space-y-4 pl-4 pb-2">
              <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-300"></div>
              <h4 className="text-xs font-bold text-slate-700 uppercase">Employment History</h4>
              
              {isEditing && (
                  <button 
                      onClick={() => setEditForm({...editForm, employmentHistory: [{ id: Math.random().toString(), company: '', title: '' }, ...(editForm.employmentHistory || [])]})}
                      className="text-xs text-sky-600 mb-2"
                  >+ Add Job</button>
              )}

              {editForm.employmentHistory?.map((job, i) => (
                  <div key={job.id} className="bg-white p-2 border border-slate-200 rounded text-sm relative">
                      {isEditing ? (
                          <div className="space-y-1">
                              <input className="w-full border p-1 bg-white text-slate-900" placeholder="Company" value={job.company} onChange={e => {
                                  const list = [...(editForm.employmentHistory || [])];
                                  list[i] = { ...job, company: e.target.value };
                                  setEditForm({...editForm, employmentHistory: list});
                              }}/>
                              <input className="w-full border p-1 bg-white text-slate-900" placeholder="Title" value={job.title} onChange={e => {
                                  const list = [...(editForm.employmentHistory || [])];
                                  list[i] = { ...job, title: e.target.value };
                                  setEditForm({...editForm, employmentHistory: list});
                              }}/>
                              <button onClick={() => setEditForm({...editForm, employmentHistory: editForm.employmentHistory?.filter(j => j.id !== job.id)})} className="absolute top-1 right-1 text-red-500">&times;</button>
                          </div>
                      ) : (
                          <>
                              <div className="font-bold text-slate-800">{job.title}</div>
                              <div className="text-xs text-slate-600">{job.company}</div>
                              <div className="text-xs text-slate-400 mt-1">{job.startDate || '?'} - {job.endDate || 'Present'}</div>
                          </>
                      )}
                  </div>
              ))}
          </div>
      </div>
  );

  const renderInteractionsTab = () => (
      <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Log Interaction</h4>
            <input 
                className="w-full border border-slate-300 rounded px-2 py-2 mb-3 text-sm focus:outline-none focus:border-sky-500 bg-white text-slate-900"
                placeholder="Topic / Summary"
                value={newLog.short}
                onChange={e => setNewLog({...newLog, short: e.target.value})}
            />
            <textarea 
                className="w-full bg-white border border-slate-300 p-2 text-sm rounded mb-3 h-20 resize-none focus:outline-none text-slate-900 focus:border-sky-500"
                placeholder="Details..."
                value={newLog.long}
                onChange={e => setNewLog({...newLog, long: e.target.value})}
            />
             <div className="flex justify-end">
                <button onClick={handleAddLog} className="bg-sky-600 text-white px-3 py-1 rounded text-sm font-bold">Add Log</button>
            </div>
          </div>
          
          <div className="space-y-6 relative border-l-2 border-slate-200 ml-3 pl-6 py-2">
              {(selectedPerson?.interactionLogs || []).map(log => (
                  <div key={log.id} className="relative">
                      <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>
                      <div className="text-xs text-slate-400 mb-1">{new Date(log.date).toLocaleDateString()}</div>
                      <div className="font-bold text-slate-800 text-sm mb-1">{log.shortDescription}</div>
                      <div className="text-sm text-slate-600 whitespace-pre-wrap">{log.longDescription}</div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderConnectionsTab = () => (
      <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase">Relationships</h4>
              {isEditing && <button onClick={handleCreateAndLink} className="text-[10px] bg-sky-50 text-sky-600 px-2 py-1 rounded">+ New Relation</button>}
          </div>
          
          <div className="space-y-2">
              {editForm.relationships?.map((rel, idx) => {
                  const other = people.find(p => p.id === rel.personId);
                  if (!other) return null;
                  return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded text-sm group">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 overflow-hidden">
                                  {other.avatarUrl ? <img src={other.avatarUrl} className="w-full h-full object-cover"/> : other.name[0]}
                              </div>
                              <div>
                                  <div className="font-bold text-slate-800">{other.name}</div>
                                  <div className="text-xs text-slate-500">
                                      {isEditing ? (
                                          <div className="flex gap-1 mt-1">
                                              <select 
                                                  className="bg-white border rounded text-[10px]" 
                                                  value={rel.type}
                                                  onChange={e => {
                                                      const newRels = [...(editForm.relationships || [])];
                                                      newRels[idx] = { ...rel, type: e.target.value as any };
                                                      setEditForm({ ...editForm, relationships: newRels });
                                                  }}
                                              >
                                                  {Object.values(RelationshipType).map(t => <option key={t} value={t}>{t}</option>)}
                                              </select>
                                              <select 
                                                  className="bg-white border rounded text-[10px]" 
                                                  value={rel.context}
                                                  onChange={e => {
                                                      const newRels = [...(editForm.relationships || [])];
                                                      newRels[idx] = { ...rel, context: e.target.value as any };
                                                      setEditForm({ ...editForm, relationships: newRels });
                                                  }}
                                              >
                                                  {Object.values(RelationshipContext).map(c => <option key={c} value={c}>{c}</option>)}
                                              </select>
                                          </div>
                                      ) : (
                                          <span>{getRelationshipLabel(rel.type, rel.context)} • {rel.context}</span>
                                      )}
                                  </div>
                              </div>
                          </div>
                          {isEditing && (
                              <button onClick={() => setEditForm({...editForm, relationships: editForm.relationships?.filter((_, i) => i !== idx)})} className="text-red-400 opacity-0 group-hover:opacity-100">&times;</button>
                          )}
                      </div>
                  );
              })}
              {(!editForm.relationships || editForm.relationships.length === 0) && (
                  <div className="text-sm text-slate-400 italic text-center py-2">No connections listed.</div>
              )}
          </div>
          
          {isEditing && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Link Existing Person</h4>
                  <select 
                      className="w-full border p-2 text-sm rounded bg-white"
                      onChange={e => {
                          if (e.target.value) {
                              handleAddRelationship(e.target.value);
                              e.target.value = '';
                          }
                      }}
                  >
                      <option value="">Select Person...</option>
                      {people.filter(p => p.id !== editForm.id && !editForm.relationships?.some(r => r.personId === p.id)).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
              </div>
          )}
      </div>
  );

  // Canvas Rendering Logic
  useEffect(() => {
    if (viewMode === 'list') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
        // Resize
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Physics Step (Simulation)
        const nodes = nodesRef.current;
        const alpha = simulationRef.current.alpha;

        if (alpha > 0.01) {
             nodes.forEach(node => {
                 if (node === draggingRef.current.node) return;
                 // Center gravity
                 const dx = 0 - node.x;
                 const dy = 0 - node.y;
                 const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                 node.vx += (dx / dist) * 0.05 * alpha;
                 node.vy += (dy / dist) * 0.05 * alpha;

                 // Repulsion
                 nodes.forEach(other => {
                     if (node === other) return;
                     const rx = node.x - other.x;
                     const ry = node.y - other.y;
                     const rDistSq = rx*rx + ry*ry || 0.1;
                     const force = 1000 / rDistSq * alpha;
                     node.vx += (rx / Math.sqrt(rDistSq)) * force;
                     node.vy += (ry / Math.sqrt(rDistSq)) * force;
                 });
                 
                 // Velocity dampening
                 node.vx *= 0.9;
                 node.vy *= 0.9;
                 node.x += node.vx;
                 node.y += node.vy;
             });
             simulationRef.current.alpha *= 0.98;
        }

        // Draw Links
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        nodes.forEach(node => {
            node.relationships.forEach(rel => {
                const target = nodes.find(n => n.id === rel.personId);
                if (target) {
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                }
            });
        });

        // Draw Nodes
        nodes.forEach(node => {
            const isSelected = node.id === selectedPersonId;
            const radius = node.contactType === 'business' ? 30 : 20;

            // Shadow
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Border
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeStyle = isSelected ? '#0ea5e9' : '#cbd5e1'; // sky-500 : slate-300
            ctx.stroke();
            
            // Dept Color Ring
            if (node.department && deptColorMap[node.department]) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius - 2, 0, Math.PI * 2);
                ctx.strokeStyle = deptColorMap[node.department];
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Text/Avatar Placeholder
            ctx.fillStyle = '#1e293b'; // slate-800
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // If image logic were canvas compatible (requires loading images), we'd draw image. 
            // For now, draw Initials or Name
            const label = node.contactType === 'business' ? node.name : (node.name.split(' ').map(n => n[0]).join('').slice(0,2));
            ctx.fillText(label, node.x, node.y);

            // Name Label below
            if (transform.k > 0.6) {
                ctx.fillStyle = '#475569'; // slate-600
                ctx.font = '10px sans-serif';
                ctx.fillText(node.name.split(' ')[0], node.x, node.y + radius + 12);
            }
        });

        ctx.restore();
        animationRef.current = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationRef.current);
  }, [viewMode, transform, selectedPersonId, visibleNodeIds]); // Dependencies

  // Main Return
  return (
      <div className="h-full relative overflow-hidden bg-slate-50 flex flex-col">
          {/* Top Bar */}
          <div className="bg-white border-b border-slate-200 p-3 flex justify-between items-center z-10 shadow-sm flex-shrink-0">
              <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-slate-800">People & Entities</h2>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>List</button>
                      <button onClick={() => setViewMode('graph')} className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === 'graph' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Graph</button>
                      <button onClick={() => setViewMode('timeline')} className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === 'timeline' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Timeline</button>
                  </div>
              </div>
              
              <div className="flex items-center gap-2">
                  <div className="relative">
                      <i className="fas fa-search absolute left-2 top-2 text-slate-400 text-xs"></i>
                      <input 
                          type="text" 
                          placeholder="Search..." 
                          className="pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm bg-slate-50 focus:bg-white outline-none w-48 transition-all"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                      />
                      {/* Search Results Dropdown */}
                      {searchTerm && (
                          <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                              {people.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                                  <div 
                                      key={p.id} 
                                      onClick={() => { handleSearchResultClick(p); setSearchTerm(''); }}
                                      className="p-2 hover:bg-sky-50 cursor-pointer border-b border-slate-50 flex items-center gap-2"
                                  >
                                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">{p.name[0]}</div>
                                      <div className="text-sm font-medium text-slate-700">{p.name}</div>
                                  </div>
                              ))}
                              {people.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                  <div className="p-3 text-xs text-slate-400 text-center">No results.</div>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="h-6 w-px bg-slate-300 mx-1"></div>

                  {/* Import Button */}
                  <label className="bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs font-bold flex items-center gap-1">
                      <i className="fas fa-file-import"></i> Import
                      <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>

                  {/* Export Button */}
                  <button onClick={() => setIsExportModalOpen(true)} className="bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 text-xs font-bold flex items-center gap-1">
                      <i className="fas fa-file-export"></i> Export
                  </button>

                  <button onClick={handleCreatePerson} className="bg-sky-600 text-white px-3 py-1.5 rounded hover:bg-sky-700 shadow text-xs font-bold flex items-center gap-1">
                      <i className="fas fa-plus"></i> New
                  </button>
              </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 relative overflow-hidden">
              {viewMode === 'list' && (
                  <div className="h-full overflow-y-auto p-4">
                      <div className="max-w-4xl mx-auto space-y-2">
                          {people.map(p => (
                              <div key={p.id} onClick={() => { setSelectedPersonId(p.id); setEditForm(p); setIsEditing(false); }} className="bg-white p-3 rounded shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:border-sky-300 transition-colors">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                                          {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full rounded-full object-cover" /> : p.name[0]}
                                      </div>
                                      <div>
                                          <div className="font-bold text-slate-800">{p.name}</div>
                                          <div className="text-xs text-slate-500">{p.organization} • {p.role}</div>
                                      </div>
                                  </div>
                                  <div className="text-right text-xs text-slate-400">
                                      {p.contactType}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {(viewMode === 'graph' || viewMode === 'timeline') && (
                  <>
                      <canvas 
                          ref={canvasRef}
                          className="block w-full h-full cursor-grab active:cursor-grabbing bg-slate-50"
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onTouchStart={handleMouseDown}
                          onTouchMove={handleMouseMove}
                          onTouchEnd={handleMouseUp}
                          onWheel={handleWheel}
                      />
                      
                      {/* Graph Controls Overlay */}
                      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                          <button onClick={handleResetView} className="bg-white p-2 rounded shadow text-slate-600 hover:text-sky-600" title="Reset View">
                              <i className="fas fa-compress-arrows-alt"></i>
                          </button>
                      </div>

                      {/* Timeline Legend overlay */}
                      {viewMode === 'timeline' && (
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-4 py-1 rounded-full text-xs text-slate-500 border border-slate-200 pointer-events-none">
                              Timeline Visualization (Experimental)
                          </div>
                      )}
                  </>
              )}
          </div>

          {/* Right Sidebar (Details) */}
          <div className={`absolute top-0 right-0 h-full w-full md:w-96 bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 z-20 flex flex-col ${selectedPersonId ? 'translate-x-0' : 'translate-x-full'}`}>
              {/* Sidebar Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                   <div className="flex gap-2">
                       <button onClick={() => setSelectedPersonId(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-lg"></i></button>
                       {isEditing ? (
                           <span className="font-bold text-slate-800">Editing Contact</span>
                       ) : (
                           <button onClick={() => setIsEditing(true)} className="text-sky-600 text-xs font-bold hover:underline"><i className="fas fa-pencil-alt mr-1"></i> Edit</button>
                       )}
                   </div>
                   {isEditing && (
                       <div className="flex gap-2">
                           <button onClick={() => setIsEditing(false)} className="text-slate-500 text-xs hover:text-slate-800">Cancel</button>
                           <button onClick={handleSave} className="bg-sky-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-sky-700">Save</button>
                       </div>
                   )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
                  {[
                      { id: 'overview', icon: 'fa-id-card' },
                      { id: 'details', icon: 'fa-info-circle' },
                      { id: 'history', icon: 'fa-history' },
                      { id: 'connections', icon: 'fa-project-diagram' },
                      { id: 'interactions', icon: 'fa-comments' },
                  ].map(tab => (
                      <button 
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex-1 py-3 text-center transition-colors border-b-2 ${activeTab === tab.id ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                      >
                          <i className={`fas ${tab.icon}`}></i>
                      </button>
                  ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                  {activeTab === 'overview' && renderOverviewTab()}
                  {activeTab === 'details' && renderDetailsTab()}
                  {activeTab === 'history' && renderHistoryTab()}
                  {activeTab === 'connections' && renderConnectionsTab()}
                  {activeTab === 'interactions' && renderInteractionsTab()}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-400 flex justify-between">
                   <span>Added: {selectedPerson && new Date(selectedPerson.dateAdded || Date.now()).toLocaleDateString()}</span>
                   {isEditing && <button onClick={handleDelete} className="text-red-400 hover:text-red-600">Delete Contact</button>}
              </div>
          </div>

          {/* Import/Export Modals */}
          {importStep === 'review' && (
              <ImportWizard 
                  conflicts={importConflicts} 
                  decisions={importDecisions} 
                  setDecision={(id, d) => setImportDecisions(prev => ({...prev, [id]: d}))} 
                  onApply={handleApplyImport}
                  onCancel={() => setImportStep('idle')}
                  setBulk={setBulkDecision}
              />
          )}
          {importStep === 'summary' && (
              <ImportSummary summary={importSummary} onClose={() => setImportStep('idle')} />
          )}
          {isExportModalOpen && (
              <ExportModal 
                  mode={exportMode} setMode={setExportMode}
                  startDate={exportStartDate} setStartDate={setExportStartDate}
                  endDate={exportEndDate} setEndDate={setExportEndDate}
                  onExport={handleExport}
                  onCancel={() => setIsExportModalOpen(false)}
              />
          )}
      </div>
  );
};
