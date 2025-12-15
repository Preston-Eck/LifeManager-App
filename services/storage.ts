import { Task, Event, Book, MeetingNote, GoogleCalendar, User } from '../types';
import { MOCK_TASKS, MOCK_BOOKS, MOCK_EVENTS, MOCK_NOTES, MOCK_CALENDARS } from '../constants';

// Define the Google Apps Script global object types
declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: (callback: (data: any) => void) => any;
          withFailureHandler: (callback: (error: any) => void) => any;
          [key: string]: any;
        };
      };
    };
  }
}

export interface AppData {
  tasks: Task[];
  events: Event[];
  books: Book[];
  notes: MeetingNote[];
  calendars: GoogleCalendar[];
  user?: User;
  userEmail?: string; // New field to carry the GAS email to frontend
}

const isGAS = () => typeof window !== 'undefined' && window.google && window.google.script;

export const loadAllData = (): Promise<AppData> => {
  return new Promise((resolve, reject) => {
    if (isGAS()) {
      // Call Google Apps Script Backend
      window.google!.script.run
        .withSuccessHandler((response: string) => {
          try {
            const data = JSON.parse(response);
            resolve(data);
          } catch (e) {
            console.error("Failed to parse server data", e);
            resolve(getMockOrLocalData());
          }
        })
        .withFailureHandler((err: any) => {
          console.error("GAS Error:", err);
          reject(err);
        })
        .loadData();
    } else {
      // Local Development Fallback
      setTimeout(() => resolve(getMockOrLocalData()), 500); // Simulate network delay
    }
  });
};

export const saveData = (type: keyof AppData, data: any): void => {
  if (isGAS()) {
    // Send to Google Apps Script
    // We send as a string to avoid weird object passing issues in GAS
    window.google!.script.run.saveData(type, JSON.stringify(data));
  } else {
    // Save locally
    localStorage.setItem(`lm_${type}`, JSON.stringify(data));
  }
};

export const initializeBackend = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (isGAS()) {
      window.google!.script.run
        .withSuccessHandler(() => resolve(true))
        .withFailureHandler((e: any) => reject(e))
        .initializeBackend();
    } else {
      // Mock delay
      setTimeout(() => resolve(true), 2000);
    }
  });
}

// Helper for local dev
const getMockOrLocalData = (): AppData => {
  const get = (key: string, mock: any) => {
    const saved = localStorage.getItem(`lm_${key}`);
    return saved ? JSON.parse(saved) : mock;
  };

  return {
    tasks: get('tasks', MOCK_TASKS),
    events: get('events', MOCK_EVENTS),
    books: get('books', MOCK_BOOKS),
    notes: get('notes', MOCK_NOTES),
    calendars: get('calendars', MOCK_CALENDARS),
    user: localStorage.getItem('lifeManagerUser') ? JSON.parse(localStorage.getItem('lifeManagerUser')!) : undefined,
    userEmail: 'dev@local.test'
  };
};