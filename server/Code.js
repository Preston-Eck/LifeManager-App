
// This script runs on Google's servers.

const DATA_FOLDER_NAME = "LifeManagerData";
const DATA_FILES = ['tasks', 'events', 'books', 'notes', 'people', 'calendars', 'user'];

function doGet(e) {
  // Use a template to allow for future variable injection if needed
  const template = HtmlService.createTemplateFromFile('index.html');
  return template.evaluate()
      .setTitle('LifeManager Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- Data Management ---

function initializeBackend() {
  const folders = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(DATA_FOLDER_NAME);
  }
  
  // Ensure all data files exist
  DATA_FILES.forEach(type => {
    const files = folder.getFilesByName(`${type}.json`);
    if (!files.hasNext()) {
      folder.createFile(`${type}.json`, JSON.stringify([]));
    }
  });
  
  return true;
}

function loadData() {
  // 1. Load Data Files from Drive
  const folders = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  
  // Default empty state
  const data = {
    tasks: [], events: [], books: [], notes: [], people: [], calendars: [], user: null,
    userEmail: Session.getActiveUser().getEmail(),
    systemCalendars: [],
    env: {}
  };

  if (folders.hasNext()) {
    const folder = folders.next();
    DATA_FILES.forEach(type => {
      const files = folder.getFilesByName(`${type}.json`);
      if (files.hasNext()) {
        const file = files.next();
        try {
          const content = file.getBlob().getDataAsString();
          const parsed = content ? JSON.parse(content) : [];
          // Ensure array types are actually arrays (protect against "null" in file)
          if (type !== 'user' && !Array.isArray(parsed)) {
              data[type] = [];
          } else {
              data[type] = parsed || (type === 'user' ? null : []);
          }
        } catch (e) {
          console.error(`Error parsing ${type}: ${e}`);
          data[type] = type === 'user' ? null : [];
        }
      }
    });
  }
  
  // Flatten user object if necessary (legacy fix)
  if (Array.isArray(data.user)) {
      data.user = data.user.length > 0 ? data.user[0] : null;
  }

  // 2. Fetch System Calendars
  try {
    const googleCalendars = CalendarApp.getAllCalendars();
    data.systemCalendars = googleCalendars.map(cal => ({
      id: cal.getId(),
      name: cal.getName(),
      color: cal.getColor(),
      accountId: Session.getActiveUser().getEmail()
    }));
  } catch (e) {
    console.warn("Could not fetch system calendars", e);
  }

  // 3. Inject Script Properties (API Keys)
  try {
    const scriptProperties = PropertiesService.getScriptProperties().getProperties();
    data.env = {
      API_KEY: scriptProperties['API_KEY'] || '' // Gemini API Key
    };
  } catch (e) {
    console.warn("Could not fetch script properties", e);
  }

  return JSON.stringify(data);
}

function saveData(type, jsonData) {
  if (!DATA_FILES.includes(type)) throw new Error("Invalid data type");
  
  const folders = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  if (!folders.hasNext()) return false;
  
  const folder = folders.next();
  const files = folder.getFilesByName(`${type}.json`);
  
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(jsonData);
  } else {
    folder.createFile(`${type}.json`, jsonData);
  }
  return true;
}

// --- Integrations ---

function importGoogleContacts() {
  try {
    // Requires 'People' Advanced Service enabled in Resources
    const connections = People.People.Connections.list('people/me', {
      personFields: 'names,emailAddresses,phoneNumbers,organizations,birthdays,photos',
      pageSize: 1000
    });

    const contacts = [];
    if (connections.connections && connections.connections.length > 0) {
      connections.connections.forEach(person => {
        const name = person.names && person.names.length > 0 ? person.names[0].displayName : null;
        if (!name) return;

        const emails = person.emailAddresses ? person.emailAddresses.map(e => e.value) : [];
        const phones = person.phoneNumbers ? person.phoneNumbers.map(p => p.value) : [];
        
        let organization = '';
        let role = '';
        if (person.organizations && person.organizations.length > 0) {
          organization = person.organizations[0].name || '';
          role = person.organizations[0].title || '';
        }

        let birthday = '';
        if (person.birthdays && person.birthdays.length > 0 && person.birthdays[0].date) {
          const d = person.birthdays[0].date;
          if (d.year && d.month && d.day) {
             birthday = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
          }
        }
        
        const avatarUrl = person.photos && person.photos.length > 0 ? person.photos[0].url : '';

        contacts.push({
          id: Math.random().toString(36).substr(2, 9),
          contactType: organization && !role ? 'business' : 'person',
          name: name,
          emails: emails,
          phones: phones,
          organization: organization,
          role: role,
          birthday: birthday,
          avatarUrl: avatarUrl,
          relationships: [],
          interactionLogs: [],
          customFields: [],
          googleContactId: person.resourceName
        });
      });
    }
    
    return JSON.stringify(contacts);
  } catch (e) {
    throw new Error("Failed to fetch contacts: " + e.message);
  }
}

function exportTaskToGoogleCalendar(taskJson) {
  const task = JSON.parse(taskJson);
  
  if (!task.calendarId) throw new Error("No calendar ID provided.");
  if (!task.when) throw new Error("No date/time provided.");

  const calendar = CalendarApp.getCalendarById(task.calendarId);
  if (!calendar) throw new Error("Calendar not found: " + task.calendarId);

  const startTime = new Date(task.when);
  const durationMinutes = (task.duration && (task.duration.hours * 60 + task.duration.minutes)) || 30;
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  let event;
  if (task.googleEventId) {
    try {
      event = calendar.getEventById(task.googleEventId);
    } catch (e) {}
  }

  const title = task.shortDescription;
  const description = task.longDescription || "";
  const location = task.where || "";

  if (event) {
    event.setTitle(title);
    event.setDescription(description);
    event.setLocation(location);
    event.setTime(startTime, endTime);
  } else {
    event = calendar.createEvent(title, startTime, endTime, {
      description: description,
      location: location
    });
  }

  return event.getId();
}

function getGoogleCalendarEvents(calendarIds, startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const allEvents = [];

  // Limit range to prevent timeout
  if (end.getTime() - start.getTime() > 90 * 24 * 60 * 60 * 1000) {
      // Cap at 90 days if requested range is huge
      end.setTime(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  }

  calendarIds.forEach(calId => {
    try {
      const cal = CalendarApp.getCalendarById(calId);
      if (!cal) return;
      
      const events = cal.getEvents(start, end);
      events.forEach(ev => {
        allEvents.push({
          id: 'gcal-' + ev.getId(), // Prefix to avoid ID collisions
          title: ev.getTitle(),
          description: ev.getDescription(),
          when: ev.getStartTime().toISOString(),
          where: ev.getLocation(),
          calendarId: calId,
          googleEventId: ev.getId(),
          attendees: ev.getGuestList().map(g => g.getEmail())
        });
      });
    } catch (e) {
      console.warn("Failed to fetch events for calendar " + calId, e);
    }
  });

  return JSON.stringify(allEvents);
}
