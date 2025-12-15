import React, { useState, useMemo } from 'react';
import { Book, BookStatus, ReadingLogEntry } from '../types';
import { lookupBookDetails, extractISBNFromImage } from '../services/geminiService';

interface LibraryProps {
  books: Book[];
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  initialFilter?: 'all' | 'reading';
}

export const Library: React.FC<LibraryProps> = ({ books, setBooks, initialFilter = 'all' }) => {
  // View State
  const [filterStatus, setFilterStatus] = useState<BookStatus | 'All'>(initialFilter === 'reading' ? BookStatus.READING : 'All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'rating' | 'progress'>('title');

  // Modal / Editing State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isProcessingBook, setIsProcessingBook] = useState(false);

  // New Journal Entry State (inside modal)
  const [newLogContent, setNewLogContent] = useState('');
  const [newLogPage, setNewLogPage] = useState<string>('');

  // --- Helpers ---

  const openNewBookModal = () => {
    setEditingBook({
      id: Math.random().toString(),
      title: '',
      author: '',
      status: BookStatus.WANT_TO_READ,
      totalPages: 0,
      currentPage: 0,
      rating: 0,
      readingLogs: [],
      review: '',
      isbn: '',
      coreFocus: '',
      category: ''
    });
    setNewLogContent('');
    setNewLogPage('');
    setIsModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook({ ...book, readingLogs: book.readingLogs || [] });
    setNewLogContent('');
    setNewLogPage('');
    setIsModalOpen(true);
  };

  const saveBook = () => {
    if (!editingBook || !editingBook.title) return;
    
    setBooks(prev => {
      const exists = prev.find(b => b.id === editingBook.id);
      if (exists) {
        return prev.map(b => b.id === editingBook.id ? editingBook : b);
      } else {
        return [...prev, editingBook];
      }
    });
    setIsModalOpen(false);
  };

  const deleteBook = () => {
      if (!editingBook) return;
      if (confirm('Are you sure you want to remove this book from your library?')) {
          setBooks(prev => prev.filter(b => b.id !== editingBook.id));
          setIsModalOpen(false);
      }
  };

  // --- ISBN Logic ---

  const handleLookupISBN = async () => {
      if (!editingBook?.isbn) return;
      setIsProcessingBook(true);
      try {
          const details = await lookupBookDetails(editingBook.isbn);
          if (details) {
              setEditingBook(prev => prev ? ({ ...prev, ...details }) : null);
          } else {
              alert("Book not found for this ISBN.");
          }
      } catch (e) {
          alert("Error looking up book.");
      } finally {
          setIsProcessingBook(false);
      }
  };

  const handleScanISBN = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsProcessingBook(true);
          const file = e.target.files[0];
          const reader = new FileReader();
          
          reader.onloadend = async () => {
              const base64String = reader.result?.toString().split(',')[1];
              if (base64String) {
                  const extractedIsbn = await extractISBNFromImage(base64String);
                  if (extractedIsbn) {
                      // Automatically look up the book if ISBN is found
                      const details = await lookupBookDetails(extractedIsbn);
                      if (details) {
                           setEditingBook(prev => prev ? ({ ...prev, ...details, isbn: extractedIsbn }) : null);
                      } else {
                           // Set ISBN but notify user details failed
                           setEditingBook(prev => prev ? ({ ...prev, isbn: extractedIsbn }) : null);
                           alert(`Found ISBN: ${extractedIsbn}, but couldn't fetch details from Google Books.`);
                      }
                  } else {
                      alert("Could not detect a valid ISBN in the image. Try getting closer to the barcode.");
                  }
                  setIsProcessingBook(false);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Journal Logic ---

  const addJournalEntry = () => {
      if (!editingBook || !newLogContent) return;
      const entry: ReadingLogEntry = {
          id: Math.random().toString(),
          date: new Date().toISOString(),
          content: newLogContent,
          page: parseInt(newLogPage) || undefined
      };
      setEditingBook({
          ...editingBook,
          readingLogs: [entry, ...(editingBook.readingLogs || [])]
      });
      setNewLogContent('');
      setNewLogPage('');
  };

  const deleteJournalEntry = (entryId: string) => {
      if (!editingBook) return;
      setEditingBook({
          ...editingBook,
          readingLogs: editingBook.readingLogs?.filter(l => l.id !== entryId)
      });
  };

  // --- Filtering & Sorting ---

  const filteredBooks = useMemo(() => {
    let result = books;

    // Filter by Status
    if (filterStatus !== 'All') {
        result = result.filter(b => b.status === filterStatus);
    }

    // Filter by Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(b => b.title.toLowerCase().includes(lower) || b.author.toLowerCase().includes(lower));
    }

    // Sort
    result = [...result].sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'author') return a.author.localeCompare(b.author);
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'progress') {
            const progA = (a.currentPage || 0) / (a.totalPages || 1);
            const progB = (b.currentPage || 0) / (b.totalPages || 1);
            return progB - progA;
        }
        return 0;
    });

    return result;
  }, [books, filterStatus, searchTerm, sortBy]);

  // --- Render Components ---

  const StarRating = ({ rating, onChange, readOnly = false }: { rating: number, onChange?: (r: number) => void, readOnly?: boolean }) => {
      return (
          <div className="flex text-yellow-400">
              {[1, 2, 3, 4, 5].map(star => (
                  <button
                      key={star}
                      disabled={readOnly}
                      onClick={() => !readOnly && onChange && onChange(star)}
                      className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform focus:outline-none`}
                  >
                      <i className={`${star <= rating ? 'fas' : 'far'} fa-star`}></i>
                  </button>
              ))}
          </div>
      );
  };

  return (
    <div className="p-4 pb-24 max-w-7xl mx-auto h-full flex flex-col overflow-hidden">
      {/* Header & Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-shrink-0">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">My Library</h2>
            <div className="text-sm text-slate-500">
                {books.length} Books • {books.filter(b => b.status === BookStatus.READING).length} In Progress
            </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <i className="fas fa-search absolute left-3 top-3 text-slate-400"></i>
                <input 
                    type="text" 
                    placeholder="Search title or author..." 
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <button 
                onClick={openNewBookModal}
                className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 shadow-sm flex items-center gap-2"
            >
                <i className="fas fa-plus"></i> <span className="hidden sm:inline">Add Book</span>
            </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex overflow-x-auto pb-1 gap-1 flex-1 no-scrollbar">
              <button 
                  onClick={() => setFilterStatus('All')}
                  className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                  All Books
              </button>
              {Object.values(BookStatus).map(status => (
                  <button 
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                      {status}
                  </button>
              ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Sort by:</span>
              <select 
                  className="bg-transparent font-semibold focus:outline-none cursor-pointer text-slate-700"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
              >
                  <option value="title">Title (A-Z)</option>
                  <option value="author">Author (A-Z)</option>
                  <option value="rating">Rating (High)</option>
                  <option value="progress">Progress (%)</option>
              </select>
          </div>
      </div>

      {/* Books Grid */}
      <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map(book => {
                const percent = (book.totalPages && book.currentPage) 
                    ? Math.round((book.currentPage / book.totalPages) * 100) 
                    : 0;

                return (
                    <div 
                        key={book.id} 
                        onClick={() => openEditModal(book)}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col group h-[320px]"
                    >
                        <div className="h-32 bg-slate-100 relative overflow-hidden">
                            {book.coverUrl ? (
                                <>
                                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm"></div>
                                    <img src={book.coverUrl} className="absolute top-4 left-4 w-20 h-28 object-cover shadow-md rounded border border-white" alt="cover" />
                                </>
                            ) : (
                                <div className="absolute top-4 left-4 w-20 h-28 bg-slate-300 shadow-md rounded border border-white flex items-center justify-center text-slate-500">
                                    <i className="fas fa-book fa-2x"></i>
                                </div>
                            )}
                            <div className="absolute top-2 right-2">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    book.status === BookStatus.READING ? 'bg-green-100 text-green-700' :
                                    book.status === BookStatus.COMPLETED ? 'bg-blue-100 text-blue-700' :
                                    book.status === BookStatus.DROPPED ? 'bg-red-100 text-red-700' :
                                    'bg-slate-200 text-slate-600'
                                }`}>
                                    {book.status}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 pt-6 flex-1 flex flex-col">
                             <div className="ml-24 -mt-4 mb-2">
                                 <h3 className="font-bold text-slate-800 leading-tight line-clamp-2" title={book.title}>{book.title}</h3>
                                 <p className="text-xs text-slate-500 truncate">{book.author}</p>
                             </div>
                             
                             <div className="flex-1">
                                 {book.status === BookStatus.READING && (
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                                            <span>{percent}% Complete</span>
                                            <span>{book.currentPage} / {book.totalPages} p</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                                            <div className="bg-sky-500 h-1.5 rounded-full transition-all duration-500" style={{width: `${percent}%`}}></div>
                                        </div>
                                    </div>
                                 )}
                                 
                                 {book.coreFocus ? (
                                     <div className="mt-2 text-[10px] bg-indigo-50 text-indigo-700 p-1.5 rounded border border-indigo-100">
                                        <i className="fas fa-bullseye mr-1"></i> {book.coreFocus}
                                     </div>
                                 ) : book.review ? (
                                     <p className="text-xs text-slate-500 italic mt-3 line-clamp-3">"{book.review}"</p>
                                 ) : null}
                             </div>

                             <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                                 <StarRating rating={book.rating || 0} readOnly />
                                 <div className="text-slate-300 group-hover:text-sky-600 transition-colors">
                                     <i className="fas fa-pencil-alt"></i>
                                 </div>
                             </div>
                        </div>
                    </div>
                );
            })}
            {filteredBooks.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 flex flex-col items-center">
                    <div className="bg-slate-100 p-6 rounded-full mb-4">
                        <i className="fas fa-book-open text-3xl"></i>
                    </div>
                    <p className="text-lg font-medium">No books found</p>
                    <p className="text-sm">Try adjusting your filters or add a new book.</p>
                </div>
            )}
          </div>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-800">{editingBook.title ? 'Edit Book' : 'Add New Book'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-800">
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    
                    {/* ISBN Quick Add Section */}
                    {!editingBook.title && (
                        <div className="bg-slate-100 p-4 rounded-lg mb-6 border-l-4 border-indigo-500">
                            <label className="block text-xs font-bold text-indigo-900 uppercase mb-2">Quick Add via ISBN</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        className="w-full border border-slate-300 p-2 pr-10 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                                        placeholder="Enter ISBN (e.g. 9780735211292)"
                                        value={editingBook.isbn || ''}
                                        onChange={e => setEditingBook({...editingBook, isbn: e.target.value})}
                                    />
                                    <label className="absolute right-2 top-2 cursor-pointer text-slate-400 hover:text-indigo-600" title="Scan Barcode">
                                        <i className="fas fa-camera"></i>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            capture="environment" 
                                            className="hidden" 
                                            onChange={handleScanISBN}
                                        />
                                    </label>
                                </div>
                                <button 
                                    onClick={handleLookupISBN}
                                    disabled={isProcessingBook}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 font-medium"
                                >
                                    {isProcessingBook ? <i className="fas fa-spinner fa-spin"></i> : 'Auto-Fill'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                Enter an ISBN or take a photo of the book cover/barcode to automatically fill details and generate an AI summary.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Left Column: Metadata */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Title</label>
                                <input 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                    value={editingBook.title}
                                    onChange={e => setEditingBook({...editingBook, title: e.target.value})}
                                    placeholder="Book Title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Author</label>
                                <input 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                    value={editingBook.author}
                                    onChange={e => setEditingBook({...editingBook, author: e.target.value})}
                                    placeholder="Author Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                                <input 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none text-sm bg-white text-slate-900"
                                    value={editingBook.category || ''}
                                    onChange={e => setEditingBook({...editingBook, category: e.target.value})}
                                    placeholder="e.g. Non-Fiction, Fantasy"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Pages</label>
                                    <input 
                                        type="number"
                                        className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                        value={editingBook.totalPages || ''}
                                        onChange={e => setEditingBook({...editingBook, totalPages: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current Page</label>
                                    <input 
                                        type="number"
                                        className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                        value={editingBook.currentPage || ''}
                                        onChange={e => setEditingBook({...editingBook, currentPage: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cover Image URL</label>
                                <input 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none text-sm bg-white text-slate-900"
                                    value={editingBook.coverUrl || ''}
                                    onChange={e => setEditingBook({...editingBook, coverUrl: e.target.value})}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {/* Right Column: Status & Rating & Review */}
                        <div className="space-y-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status</label>
                                <select 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                                    value={editingBook.status}
                                    onChange={e => setEditingBook({...editingBook, status: e.target.value as BookStatus})}
                                >
                                    {Object.values(BookStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rating</label>
                                <div className="p-2 border border-slate-300 rounded bg-white">
                                    <StarRating 
                                        rating={editingBook.rating || 0} 
                                        onChange={(r) => setEditingBook({...editingBook, rating: r})} 
                                    />
                                </div>
                            </div>
                            
                            {/* Core Focus Section */}
                            <div>
                                <label className="block text-xs font-bold text-indigo-700 uppercase mb-1 flex items-center justify-between">
                                    <span>Core Focus (AI)</span>
                                    <span className="text-[10px] bg-indigo-100 px-1 rounded">5-10 words</span>
                                </label>
                                <textarea 
                                    className="w-full border border-indigo-200 bg-indigo-50/50 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none h-16 resize-none text-sm font-medium text-indigo-900"
                                    value={editingBook.coreFocus || ''}
                                    onChange={e => setEditingBook({...editingBook, coreFocus: e.target.value})}
                                    placeholder="Auto-generated summary..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quick Review / Notes</label>
                                <textarea 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none h-24 resize-none bg-white text-slate-900"
                                    value={editingBook.review || ''}
                                    onChange={e => setEditingBook({...editingBook, review: e.target.value})}
                                    placeholder="Overall thoughts..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Reading Journal Section */}
                    <div className="border-t border-slate-200 pt-6">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i className="fas fa-pen-nib text-sky-600"></i> Reading Journal
                        </h4>
                        
                        {/* Add Entry */}
                        <div className="bg-slate-50 p-4 rounded border border-slate-200 mb-4">
                            <textarea 
                                className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-sky-500 outline-none mb-2 bg-white text-slate-900"
                                placeholder="What did you read today? Thoughts?"
                                rows={2}
                                value={newLogContent}
                                onChange={e => setNewLogContent(e.target.value)}
                            />
                            <div className="flex justify-between items-center">
                                <input 
                                    type="number" 
                                    placeholder="Page #" 
                                    className="w-24 border border-slate-300 p-1 px-2 rounded focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900 text-sm"
                                    value={newLogPage}
                                    onChange={e => setNewLogPage(e.target.value)}
                                />
                                <button 
                                    onClick={addJournalEntry}
                                    disabled={!newLogContent}
                                    className="bg-sky-600 text-white px-3 py-1 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
                                >
                                    Add Entry
                                </button>
                            </div>
                        </div>

                        {/* Log List */}
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {editingBook.readingLogs?.map(log => (
                                <div key={log.id} className="relative bg-white border border-slate-200 p-3 rounded shadow-sm group">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="text-xs font-bold text-slate-500">
                                            {new Date(log.date).toLocaleDateString()} 
                                            {log.page && <span className="ml-2 bg-slate-100 px-1 rounded text-slate-600">p. {log.page}</span>}
                                        </div>
                                        <button 
                                            onClick={() => deleteJournalEntry(log.id)}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{log.content}</p>
                                </div>
                            ))}
                            {(!editingBook.readingLogs || editingBook.readingLogs.length === 0) && (
                                <div className="text-center text-xs text-slate-400 italic py-2">No journal entries yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                    <button 
                        onClick={deleteBook}
                        className="text-red-500 hover:text-red-700 text-sm font-medium px-2"
                    >
                        <i className="fas fa-trash mr-1"></i> Delete
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded font-medium">Cancel</button>
                        <button onClick={saveBook} className="px-6 py-2 bg-sky-600 text-white hover:bg-sky-700 rounded shadow font-medium">Save Book</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};