
// This script runs on Google's servers.

const DATA_FOLDER_NAME = "LifeManagerData";
const DATA_FILES = ['tasks', 'events', 'books', 'notes', 'people', 'calendars', 'user'];

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index.html')
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
  const folders = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  if (!folders.hasNext()) {
    // If no folder, return empty structure (SetupWizard will trigger init later)
    return {
      tasks: [], events: [], books: [], notes: [], people: [], calendars: [], user: null, userEmail: Session.getActiveUser().getEmail()
    };
  }
  
  const folder = folders.next();
  const data = {};
  
  DATA_FILES.forEach(type => {
    const files = folder.getFilesByName(`${type}.json`);
    if (files.hasNext()) {
      const file = files.next();
      try {
        const content = file.getBlob().getDataAsString();
        data[type] = content ? JSON.parse(content) : [];
      } catch (e) {
        console.error(`Error parsing ${type}: ${e}`);
        data[type] = [];
      }
    } else {
      data[type] = [];
    }
  });
  
  data.userEmail = Session.getActiveUser().getEmail();
  
  // Flatten user object if it was stored as array by mistake or legacy
  if (Array.isArray(data.user)) {
      data.user = data.user.length > 0 ? data.user[0] : null;
  }

  // Return as JSON string to ensure transport reliability across GAS bridge
  return JSON.stringify(data);
}

function saveData(type, jsonData) {
  if (!DATA_FILES.includes(type)) throw new Error("Invalid data type");
  
  const folders = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  if (!folders.hasNext()) return false; // Should run init first
  
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
    // Fetch connections (contacts)
    // NOTE: 'People' service must be enabled in Resources > Advanced Google Services
    const connections = People.People.Connections.list('people/me', {
      personFields: 'names,emailAddresses,phoneNumbers,organizations,birthdays,photos',
      pageSize: 1000
    });

    const contacts = [];
    if (connections.connections && connections.connections.length > 0) {
      connections.connections.forEach(person => {
        const name = person.names && person.names.length > 0 ? person.names[0].displayName : null;
        if (!name) return; // Skip contacts without names

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
          // Format simplistic YYYY-MM-DD, assuming year exists or defaulting
          if (d.year && d.month && d.day) {
             birthday = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
          }
        }
        
        const avatarUrl = person.photos && person.photos.length > 0 ? person.photos[0].url : '';

        // Map to our Person interface
        contacts.push({
          id: Math.random().toString(36).substr(2, 9), // Generate temporary ID, frontend will dedup
          contactType: organization && !role ? 'business' : 'person', // Simple heuristic
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
          googleContactId: person.resourceName // Store linkage
        });
      });
    }
    
    return JSON.stringify(contacts);
  } catch (e) {
    throw new Error("Failed to fetch contacts: " + e.message);
  }
}
