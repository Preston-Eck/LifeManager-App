
import { Person, AddressEntry, ContactMethod, JobEntry } from '../types';

export interface ImportConflict {
    existing: Person;
    imported: Person;
    matchReason: 'email' | 'name' | 'googleId';
}

export interface ImportResult {
    newContacts: Person[];
    conflicts: ImportConflict[];
}

const cleanString = (str?: string) => str ? str.trim() : '';

/**
 * Parses Google CSV format into Person objects.
 */
export const parseGoogleCSV = (csvText: string): Person[] => {
    const lines = csvText.split(/\r\n|\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    
    const contacts: Person[] = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Handle CSV quotes
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        const values: string[] = [];
        let inQuotes = false;
        let currentValue = '';
        // Robust char-by-char fallback if regex fails
        for(let char of lines[i]) {
            if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { values.push(currentValue); currentValue = ''; }
            else { currentValue += char; }
        }
        values.push(currentValue);

        const getVal = (headerStart: string) => {
            const idx = headers.findIndex(h => h.startsWith(headerStart));
            return idx > -1 && values[idx] ? values[idx].replace(/^"|"$/g, '').trim() : '';
        };

        const getValExact = (header: string) => {
            const idx = headers.indexOf(header);
            return idx > -1 && values[idx] ? values[idx].replace(/^"|"$/g, '').trim() : '';
        }

        // --- MAPPING ---
        const firstName = getValExact('First Name');
        const middleName = getValExact('Middle Name');
        const lastName = getValExact('Last Name');
        const orgName = getValExact('Organization Name');
        const orgTitle = getValExact('Organization Title');
        
        const p: Person = {
            id: Math.random().toString(36).substr(2, 9),
            contactType: orgName && !firstName ? 'business' : 'person',
            name: [firstName, middleName, lastName].filter(Boolean).join(' ') || orgName || 'Unknown',
            structuredName: {
                first: firstName,
                middle: middleName,
                last: lastName,
                prefix: getValExact('Name Prefix'),
                suffix: getValExact('Name Suffix'),
                nickname: getValExact('Nickname')
            },
            organization: orgName,
            role: orgTitle,
            department: getValExact('Organization Department'),
            birthday: getValExact('Birthday'),
            notes: getValExact('Notes'),
            avatarUrl: getValExact('Photo'),
            relationships: [],
            interactionLogs: [],
            customFields: [],
            addressHistory: [],
            employmentHistory: [],
            emails: [], // Legacy sync
            phones: [], // Legacy sync
            contactMethods: {
                emails: [],
                phones: [],
                socialProfiles: [],
                websites: []
            },
            dateAdded: new Date().toISOString()
        };

        // Dynamic Columns (Phone 1 - Value, Phone 1 - Label, etc)
        headers.forEach((header, idx) => {
            const val = values[idx] ? values[idx].replace(/^"|"$/g, '').trim() : '';
            if (!val) return;

            // Phones
            if (header.startsWith('Phone') && header.includes('Value')) {
                const num = header.match(/\d+/)?.[0] || '1';
                // Find label column (usually previous or strictly named)
                const labelIdx = headers.indexOf(`Phone ${num} - Type`);
                const label = labelIdx > -1 ? values[labelIdx]?.replace(/^"|"$/g, '').trim() : 'Mobile';
                
                p.contactMethods?.phones.push({ value: val, label });
                p.phones?.push(`${label}: ${val}`);
            }

            // Emails
            if (header.startsWith('E-mail') && header.includes('Value')) {
                const num = header.match(/\d+/)?.[0] || '1';
                const labelIdx = headers.indexOf(`E-mail ${num} - Type`);
                const label = labelIdx > -1 ? values[labelIdx]?.replace(/^"|"$/g, '').trim() : 'Work';
                
                p.contactMethods?.emails.push({ value: val, label });
                p.emails?.push(val);
            }

            // Addresses
            if (header.startsWith('Address') && header.includes('Formatted')) {
                const num = header.match(/\d+/)?.[0] || '1';
                const labelIdx = headers.indexOf(`Address ${num} - Type`);
                const label = labelIdx > -1 ? values[labelIdx]?.replace(/^"|"$/g, '').trim() : 'Home';
                
                p.addressHistory?.push({
                    id: Math.random().toString(),
                    type: 'Current',
                    address: val,
                    label: label
                });
            }
            
            // Labels/Groups
            if (header === 'Group Membership' || header === 'Labels') {
                const groups = val.split(':::').map(g => g.trim()).filter(Boolean);
                groups.forEach(g => p.customFields?.push({ id: Math.random().toString(), label: 'Group', value: g }));
            }
        });

        contacts.push(p);
    }
    return contacts;
};

/**
 * Detects duplicates and separates new contacts from conflicts.
 */
export const processImport = (importedContacts: Person[], existingContacts: Person[]): ImportResult => {
    const newContacts: Person[] = [];
    const conflicts: ImportConflict[] = [];

    importedContacts.forEach(imported => {
        let match: Person | undefined;
        let reason: ImportConflict['matchReason'] | undefined;

        // 1. Google ID Match
        if (imported.googleContactId) {
            match = existingContacts.find(e => e.googleContactId === imported.googleContactId);
            if (match) reason = 'googleId';
        }

        // 2. Email Match (Exact)
        if (!match && imported.contactMethods?.emails.length) {
            const importedEmails = new Set(imported.contactMethods.emails.map(e => e.value.toLowerCase()));
            match = existingContacts.find(e => {
                const existingEmails = e.contactMethods?.emails.map(em => em.value.toLowerCase()) || e.emails?.map(em => em.toLowerCase()) || [];
                return existingEmails.some(em => importedEmails.has(em));
            });
            if (match) reason = 'email';
        }

        // 3. Name Match (Exact Display Name)
        if (!match && imported.name !== 'Unknown') {
            match = existingContacts.find(e => e.name.toLowerCase() === imported.name.toLowerCase());
            if (match) reason = 'name';
        }

        if (match && reason) {
            conflicts.push({ existing: match, imported, matchReason: reason });
        } else {
            newContacts.push(imported);
        }
    });

    return { newContacts, conflicts };
};

/**
 * Merges Imported data INTO Existing data.
 */
export const mergeContacts = (existing: Person, imported: Person): Person => {
    const merged = { ...existing };

    // 1. Merge Scalars (Prefer existing if present, else import)
    merged.organization = existing.organization || imported.organization;
    merged.role = existing.role || imported.role;
    merged.birthday = existing.birthday || imported.birthday;
    merged.avatarUrl = existing.avatarUrl || imported.avatarUrl;
    merged.notes = [existing.notes, imported.notes].filter(Boolean).join('\n---\n');

    // 2. Merge Arrays (Deduped)
    
    // Emails
    const existingEmailVals = new Set(merged.contactMethods?.emails.map(e => e.value.toLowerCase()) || []);
    const newEmails = imported.contactMethods?.emails.filter(e => !existingEmailVals.has(e.value.toLowerCase())) || [];
    
    merged.contactMethods = {
        emails: [...(merged.contactMethods?.emails || []), ...newEmails],
        phones: [...(merged.contactMethods?.phones || []), ...(imported.contactMethods?.phones || [])], // Simple append for phones to avoid complex normalizing
        socialProfiles: [...(merged.contactMethods?.socialProfiles || []), ...(imported.contactMethods?.socialProfiles || [])],
        websites: [...(merged.contactMethods?.websites || []), ...(imported.contactMethods?.websites || [])]
    };

    // Sync legacy fields
    merged.emails = merged.contactMethods.emails.map(e => e.value);
    merged.phones = merged.contactMethods.phones.map(p => `${p.label}: ${p.value}`);

    // Addresses
    merged.addressHistory = [...(merged.addressHistory || []), ...(imported.addressHistory || [])];

    // Custom Fields (Groups)
    // Simple dedupe by value
    const existingFields = new Set(merged.customFields?.map(f => f.value));
    const newFields = imported.customFields?.filter(f => !existingFields.has(f.value)) || [];
    merged.customFields = [...(merged.customFields || []), ...newFields];

    return merged;
};
