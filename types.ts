
export enum Urgency {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum Importance {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
  WAITING = 'Waiting'
}

export enum BookStatus {
  WANT_TO_READ = 'Want to Read',
  READING = 'Reading',
  COMPLETED = 'Completed',
  DROPPED = 'Dropped'
}

export interface ThemePreferences {
  fontSize: 'small' | 'normal' | 'large';
  accentColor: 'sky' | 'blue' | 'indigo' | 'purple' | 'emerald' | 'rose' | 'slate';
  bgColor: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  theme?: ThemePreferences;
}

export interface GoogleCalendar {
  id: string;
  name: string;
  color: string;
  accountId: string; // e.g. user@gmail.com
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  url: string; // In a real app, this would be a Drive ID/URL
}

export interface UpdateLog {
  id: string;
  timestamp: string;
  content: string;
  attachments?: Attachment[];
}

export interface Duration {
  hours: number;
  minutes: number;
}

export interface Task {
  id: string;
  shortDescription: string;
  longDescription?: string;
  forWho?: string; // Context: "Work: MGC", "Family"
  assignee?: string; // Delegate: "Me", "John Doe"
  where?: string;
  when?: string; // ISO Date string
  duration?: Duration; // Estimated time to complete
  importance: Importance;
  urgency: Urgency;
  status: TaskStatus;
  linkedEmail?: string;
  attachments: Attachment[];
  boardId?: string; // For "Brain Dump Boards"
  updates?: UpdateLog[];
  calendarId?: string; // Linked Google Calendar
  completedAt?: string; // ISO Date string when status changed to Done
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  when: string; // ISO Date Time
  where?: string;
  attendees?: string[];
  linkedEmail?: string;
  updates?: UpdateLog[];
  calendarId?: string; // Linked Google Calendar
  isHidden?: boolean; // New field for visibility management
}

export interface ReadingLogEntry {
  id: string;
  date: string;
  content: string;
  page?: number;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string; // New
  author: string;
  isbn?: string; // New
  category?: string; // New
  coreFocus?: string; // New: AI Summary
  coverUrl?: string;
  status: BookStatus;
  rating?: number; // 1-5
  review?: string;
  totalPages?: number;
  currentPage?: number;
  readingLogs?: ReadingLogEntry[];
  startDate?: string;
  finishDate?: string;
}

export interface MeetingNote {
  id: string;
  date: string;
  title: string;
  content: string;
  linkedTaskIds: string[];
  linkedEventIds: string[];
  forWho?: string; // Link context to a person/project
  googleDocUrl?: string; // Link to external Google Doc
}

// --- PEOPLE MODULE TYPES ---

export enum RelationshipType {
  PARENT = 'Parent',   // Manager/Owner in Work context
  CHILD = 'Child',     // Report/Subsidiary in Work context
  SIBLING = 'Sibling', // Colleague in Work context
  SPOUSE = 'Spouse'    // Partner in Work context (rare, but possible for co-owners)
}

export enum RelationshipContext {
  FAMILY = 'Family',
  WORK = 'Work',
  CHURCH = 'Church',
  SCHOOL = 'School'
}

export interface Relationship {
  personId: string; // ID of the OTHER person
  type: RelationshipType;
  context: RelationshipContext;
}

export interface AddressEntry {
    id: string;
    type: 'Current' | 'Previous';
    address: string; // Formatted
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    label?: string; // Home, Work
    startDate?: string;
    endDate?: string;
}

export interface JobEntry {
    id: string;
    company: string;
    title: string;
    department?: string;
    startDate?: string;
    endDate?: string;
}

export interface InteractionLog {
    id: string;
    date: string;
    shortDescription: string;
    longDescription: string;
    attachments: Attachment[];
}

export interface CustomField {
    id: string;
    label: string;
    value: string;
}

export interface ContactMethod {
    value: string;
    label: string; // Mobile, Work, Home
}

export interface Person {
  id: string;
  contactType: 'person' | 'business'; 
  googleContactId?: string; // Track original ID
  
  // Names
  name: string; // Display Name
  structuredName?: {
      first: string;
      middle: string;
      last: string;
      prefix: string;
      suffix: string;
      nickname: string;
  };

  avatarUrl?: string;
  
  // Work (Primary display)
  organization?: string; 
  department?: string; 
  role?: string; 
  
  // Relationships
  relationships: Relationship[];
  
  // Detailed Contact Methods (New Robust Structure)
  emails?: string[]; // Legacy/Simple
  phones?: string[]; // Legacy/Simple
  contactMethods?: {
      emails: ContactMethod[];
      phones: ContactMethod[];
      socialProfiles: { network: string; url: string }[];
      websites: { url: string; label: string }[];
  };

  // Dates
  birthday?: string; // ISO Date YYYY-MM-DD
  anniversary?: string; // ISO Date YYYY-MM-DD
  
  // Lists & Preferences
  allergies?: string[];
  favoriteColors?: string[];
  favoriteRestaurants?: string[];
  favoriteScriptures?: string[];
  favoriteFood?: {
      entree?: string;
      dessert?: string;
      other?: string;
  };

  // History
  addressHistory?: AddressEntry[];
  employmentHistory?: JobEntry[];

  // Dynamic
  customFields?: CustomField[];
  
  // Logs
  interactionLogs?: InteractionLog[];
  memorizationTips?: string; // Text field for mnemonic devices
  notes?: string; // General notes from import
  
  // Meta
  dateAdded?: string;
  dateLastContacted?: string;
}

export type View = 'dashboard' | 'braindump' | 'week' | 'library' | 'meeting-notes' | 'people' | 'settings';
