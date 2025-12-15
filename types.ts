
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

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
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
  forWho?: string; // e.g., "Kid 1", "Campground A"
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
}

export type View = 'dashboard' | 'braindump' | 'week' | 'library' | 'meeting-notes' | 'settings';
