import { Task, Event, Book, MeetingNote, GoogleCalendar, User, Person } from '../types';
import { MOCK_TASKS, MOCK_BOOKS, MOCK_EVENTS, MOCK_NOTES, MOCK_CALENDARS, MOCK_PEOPLE } from '../constants';

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
  people: Person[];
  calendars: GoogleCalendar[];
  user?: User;
  userEmail?: string;
}

const isGAS = () => typeof window !== 'undefined' && window.google && window.google.script;

export const loadAllData = (): Promise<AppData> => {
  return new Promise((resolve, reject) => {
    if (isGAS()) {
      window.google!.script.run
        .withSuccessHandler((response: any) => {
          try {
            // Robust parsing: Handle if GAS returns object OR string
            let data: AppData;
            if (typeof response === 'string') {
               data = JSON.parse(response);
            } else {
               data = response;
            }
            resolve(data);
          } catch (e) {
            console.error("Failed to parse server data", e);
            // Don't fallback to mock in production, reject so SetupWizard shows error
            reject(e);
          }
        })
        .withFailureHandler((err: any) => {
          console.error("GAS Error:", err);
          reject(err);
        })
        .loadData();
    } else {
      // Local Development Fallback
      setTimeout(() => resolve(getMockOrLocalData()), 500); 
    }
  });
};

export const saveData = (type: keyof AppData, data: any): void => {
  if (isGAS()) {
    window.google!.script.run.saveData(type, JSON.stringify(data));
  } else {
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
      setTimeout(() => resolve(true), 2000);
    }
  });
}

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
    people: get('people', MOCK_PEOPLE),
    calendars: get('calendars', MOCK_CALENDARS),
    user: localStorage.getItem('lifeManagerUser') ? JSON.parse(localStorage.getItem('lifeManagerUser')!) : undefined,
    userEmail: 'dev@local.test'
  };
};