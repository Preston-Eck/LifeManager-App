
import { Task, TaskStatus, Urgency, Importance, Book, BookStatus, Event, MeetingNote, GoogleCalendar, Person, RelationshipType, RelationshipContext } from './types';

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

// --- UDRG Hierarchy Example ---
export const MOCK_PEOPLE: Person[] = [
    // Businesses / Entities
    {
        id: 'b_udrg',
        contactType: 'business',
        name: 'Ugly Duckling Recreation Group (UDRG)',
        role: 'Parent Company',
        relationships: [
            { personId: 'b_mgc', type: RelationshipType.CHILD, context: RelationshipContext.WORK },
            { personId: 'b_alg', type: RelationshipType.CHILD, context: RelationshipContext.WORK },
            { personId: 'p_ben', type: RelationshipType.CHILD, context: RelationshipContext.WORK } // Ben works for UDRG
        ],
        interactionLogs: [],
        customFields: []
    },
    {
        id: 'b_mgc',
        contactType: 'business',
        name: 'Mercer/Grove City KOA (MGC)',
        role: 'Campground',
        relationships: [
            { personId: 'b_udrg', type: RelationshipType.PARENT, context: RelationshipContext.WORK }
        ],
        interactionLogs: [],
        customFields: []
    },
    {
        id: 'b_alg',
        contactType: 'business',
        name: 'Allegheny I-80 Campground (ALG)',
        role: 'Campground',
        relationships: [
            { personId: 'b_udrg', type: RelationshipType.PARENT, context: RelationshipContext.WORK }
        ],
        interactionLogs: [],
        customFields: []
    },

    // People
    {
        id: 'p_ben',
        contactType: 'person',
        name: 'Ben',
        role: 'General Manager',
        organization: 'UDRG',
        relationships: [
            { personId: 'b_udrg', type: RelationshipType.PARENT, context: RelationshipContext.WORK }, // Employer
            { personId: 'p_reg_mgr', type: RelationshipType.CHILD, context: RelationshipContext.WORK } // Manages Regional Mgr
        ],
        addressHistory: [
            { id: 'addr1', type: 'Current', address: '123 Campground Lane', startDate: '2020-01-01' }
        ],
        employmentHistory: [
             { id: 'job1', company: 'UDRG', title: 'General Manager', startDate: '2019-05-01' }
        ],
        favoriteColors: ['Blue', 'Forest Green'],
        favoriteRestaurants: ['Texas Roadhouse'],
        interactionLogs: [],
        customFields: []
    },
    {
        id: 'p_reg_mgr',
        contactType: 'person',
        name: 'Regional Manager (Rachel)',
        role: 'Regional Manager',
        department: 'Operations',
        relationships: [
            { personId: 'p_ben', type: RelationshipType.PARENT, context: RelationshipContext.WORK },
            { personId: 'p_fac_mgr_mgc', type: RelationshipType.CHILD, context: RelationshipContext.WORK }, // Manages Fac Mgr
            { personId: 'p_ops_mgr_mgc', type: RelationshipType.CHILD, context: RelationshipContext.WORK }  // Manages Ops Mgr
        ],
        interactionLogs: [],
        customFields: []
    },
    {
        id: 'p_fac_mgr_mgc',
        contactType: 'person',
        name: 'Facilities Mgr (Frank)',
        role: 'Facilities Manager',
        organization: 'MGC',
        relationships: [
            { personId: 'p_reg_mgr', type: RelationshipType.PARENT, context: RelationshipContext.WORK }, // Reports to Rachel
            { personId: 'b_mgc', type: RelationshipType.PARENT, context: RelationshipContext.WORK }, // Employed by MGC
            { personId: 'p_staff_1', type: RelationshipType.CHILD, context: RelationshipContext.WORK }
        ],
        favoriteFood: { entree: 'Steak', dessert: 'Cheesecake' },
        interactionLogs: [],
        customFields: []
    },
    {
        id: 'p_ops_mgr_mgc',
        contactType: 'person',
        name: 'Operations Mgr (Olive)',
        role: 'Operations Manager',
        organization: 'MGC',
        relationships: [
            { personId: 'p_reg_mgr', type: RelationshipType.PARENT, context: RelationshipContext.WORK },
            { personId: 'b_mgc', type: RelationshipType.PARENT, context: RelationshipContext.WORK }
        ],
        interactionLogs: [],
        customFields: []
    },
    {
        id: 'p_staff_1',
        contactType: 'person',
        name: 'Steve Staff',
        role: 'Maintenance Crew',
        organization: 'MGC',
        relationships: [
            { personId: 'p_fac_mgr_mgc', type: RelationshipType.PARENT, context: RelationshipContext.WORK }
        ],
        interactionLogs: [],
        customFields: []
    }
];
