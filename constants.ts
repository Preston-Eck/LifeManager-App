
import { Task, TaskStatus, Urgency, Importance, Book, BookStatus, Event, MeetingNote, GoogleCalendar } from './types';

export const MOCK_CALENDARS: GoogleCalendar[] = [
  { id: 'cal1', name: 'Personal', color: '#4285F4', accountId: 'dad@gmail.com' },
  { id: 'cal2', name: 'Campground Work', color: '#EA4335', accountId: 'manager@campground.com' },
  { id: 'cal3', name: 'Family Shared', color: '#FBBC05', accountId: 'dad@gmail.com' },
  { id: 'cal4', name: 'School Board', color: '#34A853', accountId: 'board.member@school.edu' }
];

export const MOCK_TASKS: Task[] = [
  {
    id: '1',
    shortDescription: 'Repair water pump at North Site',
    longDescription: 'The pump is making a grinding noise. Check seals.',
    forWho: 'Campground',
    where: 'North Loop',
    importance: Importance.HIGH,
    urgency: Urgency.CRITICAL,
    status: TaskStatus.TODO,
    attachments: [],
    boardId: 'campground',
    calendarId: 'cal2'
  },
  {
    id: '2',
    shortDescription: 'Review budget for School Board',
    longDescription: 'Prepare for the monthly facilities meeting.',
    forWho: 'School Board',
    where: 'Home Office',
    when: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(), // 2 days from now
    importance: Importance.HIGH,
    urgency: Urgency.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    attachments: [],
    boardId: 'personal',
    calendarId: 'cal4'
  },
  {
    id: '3',
    shortDescription: 'Buy new soccer cleats',
    forWho: 'Son (James)',
    importance: Importance.MEDIUM,
    urgency: Urgency.MEDIUM,
    status: TaskStatus.TODO,
    attachments: [],
    boardId: 'family',
    calendarId: 'cal3'
  }
];

export const MOCK_BOOKS: Book[] = [
  {
    id: 'b1',
    title: 'Atomic Habits',
    author: 'James Clear',
    status: BookStatus.READING,
    currentPage: 120,
    totalPages: 320,
    coverUrl: 'https://picsum.photos/100/150'
  },
  {
    id: 'b2',
    title: 'The theology of the Hammer',
    author: 'Millard Fuller',
    status: BookStatus.COMPLETED,
    rating: 5,
    review: 'Great insights on community building.',
    coverUrl: 'https://picsum.photos/101/150'
  }
];

export const MOCK_EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Church Council Meeting',
    when: new Date().toISOString(),
    where: 'Fellowship Hall',
    attendees: ['Pastor', 'Elders'],
    calendarId: 'cal1'
  }
];

export const MOCK_NOTES: MeetingNote[] = [
  {
    id: 'n1',
    title: 'Facilities Committee Kickoff',
    date: new Date().toISOString(),
    content: 'Discussed the new roof project. Budget approval needed by next month.',
    linkedTaskIds: ['2'],
    linkedEventIds: []
  }
];
