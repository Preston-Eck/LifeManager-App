
import { Task, Event, Book, MeetingNote, GoogleCalendar, User, Person, ContactMethod } from '../types';
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
  systemCalendars?: GoogleCalendar[]; // From fresh fetch
  env?: {
      API_KEY?: string;
  };
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
               data = JSON.parse(response) || {}; // Guard against null
            } else {
               data = response || {}; // Guard against null
            }
            resolve(data);
          } catch (e) {
            console.error("Failed to parse server data", e);
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

export const syncTaskToCalendar = (task: Task): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (isGAS()) {
      window.google!.script.run
        .withSuccessHandler((eventId: string) => resolve(eventId))
        .withFailureHandler((e: any) => reject(e))
        .exportTaskToGoogleCalendar(JSON.stringify(task));
    } else {
      console.log("Dev: Synced task to calendar", task);
      setTimeout(() => resolve("mock-google-event-id-" + Math.random()), 500);
    }
  });
};

export const fetchExternalEvents = (calendarIds: string[], startDate: string, endDate: string): Promise<Event[]> => {
  return new Promise((resolve, reject) => {
    if (isGAS()) {
      window.google!.script.run
        .withSuccessHandler((response: string) => {
           try {
             const parsed = JSON.parse(response);
             resolve(Array.isArray(parsed) ? parsed : []);
           } catch(e) { reject(e); }
        })
        .withFailureHandler((e: any) => reject(e))
        .getGoogleCalendarEvents(calendarIds, startDate, endDate);
    } else {
      // Mock Data for local dev
      setTimeout(() => resolve([
        { 
          id: 'ext-1', 
          title: 'External Google Meeting', 
          when: new Date().toISOString(), 
          calendarId: calendarIds[0] || 'cal1',
          googleEventId: 'g-123'
        }
      ]), 500);
    }
  });
}

export const importContactsFromGoogle = (): Promise<Person[]> => {
    return new Promise((resolve, reject) => {
        if (isGAS()) {
            window.google!.script.run
                .withSuccessHandler((response: string) => {
                    try {
                        const rawPeople = JSON.parse(response) || [];
                        if (!Array.isArray(rawPeople)) throw new Error("Invalid format");
                        
                        // Normalize raw structure to include contactMethods
                        const people: Person[] = rawPeople.map((p: any) => {
                            const emails: ContactMethod[] = (p.emails || []).map((e: string) => ({ label: 'Work', value: e }));
                            const phones: ContactMethod[] = (p.phones || []).map((ph: string) => ({ label: 'Mobile', value: ph }));
                            
                            return {
                                ...p,
                                contactMethods: {
                                    emails,
                                    phones,
                                    socialProfiles: [],
                                    websites: []
                                }
                            };
                        });
                        resolve(people);
                    } catch (e) { reject(e); }
                })
                .withFailureHandler((e: any) => reject(e))
                .importGoogleContacts();
        } else {
            // Mock for dev
            setTimeout(() => {
                const mockImport: Person = {
                    id: 'g-import-' + Math.random(),
                    contactType: 'person',
                    name: 'Google Contact (Mock)',
                    googleContactId: 'resources/people/123',
                    emails: ['mock@google.com'],
                    phones: ['555-0199'],
                    contactMethods: {
                        emails: [{ label: 'Work', value: 'mock@google.com' }],
                        phones: [{ label: 'Mobile', value: '555-0199' }],
                        socialProfiles: [],
                        websites: []
                    },
                    relationships: []
                };
                resolve([mockImport]);
            }, 1000);
        }
    });
};

const getMockOrLocalData = (): AppData => {
  const get = (key: string, mock: any) => {
    const saved = localStorage.getItem(`lm_${key}`);
    try {
        return saved ? (JSON.parse(saved) || mock) : mock;
    } catch(e) {
        return mock;
    }
  };

  return {
    tasks: get('tasks', MOCK_TASKS),
    events: get('events', MOCK_EVENTS),
    books: get('books', MOCK_BOOKS),
    notes: get('notes', MOCK_NOTES),
    people: get('people', MOCK_PEOPLE),
    calendars: get('calendars', MOCK_CALENDARS),
    user: localStorage.getItem('lifeManagerUser') ? JSON.parse(localStorage.getItem('lifeManagerUser')!) : undefined,
    userEmail: 'dev@local.test',
    env: { API_KEY: 'mock_key' }
  };
};
