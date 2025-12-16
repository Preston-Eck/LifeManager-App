
import { Person } from '../types';

/**
 * Escapes fields for CSV format (handling commas, quotes, newlines).
 */
const escapeCsv = (str: string | undefined): string => {
    if (!str) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

/**
 * Generates a CSV string compatible with Google Contacts import.
 */
export const generateGoogleCSV = (contacts: Person[]): string => {
    // 1. Define Headers (Standard Google Contacts Headers)
    // We map dynamic fields (Phone 1, Phone 2...) up to a reasonable limit (e.g., 3)
    const headers = [
        'Name', 'Given Name', 'Additional Name', 'Family Name', 'Name Prefix', 'Name Suffix', 'Nickname',
        'Organization Name', 'Organization Title', 'Organization Department',
        'Birthday', 'Notes', 'Photo', 'Group Membership',
        // Contact Methods (Up to 3 of each for standard export)
        'E-mail 1 - Type', 'E-mail 1 - Value', 'E-mail 2 - Type', 'E-mail 2 - Value', 'E-mail 3 - Type', 'E-mail 3 - Value',
        'Phone 1 - Type', 'Phone 1 - Value', 'Phone 2 - Type', 'Phone 2 - Value', 'Phone 3 - Type', 'Phone 3 - Value',
        'Address 1 - Type', 'Address 1 - Formatted', 'Address 1 - Street', 'Address 1 - City', 'Address 1 - PO Box', 'Address 1 - Region', 'Address 1 - Postal Code', 'Address 1 - Country',
        'Website 1 - Type', 'Website 1 - Value'
    ];

    const rows = contacts.map(p => {
        // Name Parsing
        const givenName = p.structuredName?.first || p.name.split(' ')[0] || '';
        const familyName = p.structuredName?.last || (p.name.split(' ').length > 1 ? p.name.split(' ').slice(1).join(' ') : '') || '';
        
        // Groups
        const groups = p.customFields
            ?.filter(f => f.label === 'Group')
            .map(f => f.value)
            .join(' ::: ');

        // Emails
        const emails = p.contactMethods?.emails || [];
        const e1 = emails[0];
        const e2 = emails[1];
        const e3 = emails[2];

        // Phones
        const phones = p.contactMethods?.phones || [];
        const p1 = phones[0];
        const p2 = phones[1];
        const p3 = phones[2];

        // Addresses (Just taking first for simplicity in this version)
        const addr = p.addressHistory?.[0];

        // Websites
        const web = p.contactMethods?.websites?.[0];

        return [
            escapeCsv(p.name),
            escapeCsv(givenName),
            escapeCsv(p.structuredName?.middle),
            escapeCsv(familyName),
            escapeCsv(p.structuredName?.prefix),
            escapeCsv(p.structuredName?.suffix),
            escapeCsv(p.structuredName?.nickname),
            escapeCsv(p.organization),
            escapeCsv(p.role),
            escapeCsv(p.department),
            escapeCsv(p.birthday),
            escapeCsv(p.notes),
            escapeCsv(p.avatarUrl),
            escapeCsv(groups),
            // Emails
            escapeCsv(e1?.label || (e1 ? 'Work' : '')), escapeCsv(e1?.value),
            escapeCsv(e2?.label || (e2 ? 'Home' : '')), escapeCsv(e2?.value),
            escapeCsv(e3?.label || (e3 ? 'Other' : '')), escapeCsv(e3?.value),
            // Phones
            escapeCsv(p1?.label || (p1 ? 'Mobile' : '')), escapeCsv(p1?.value),
            escapeCsv(p2?.label || (p2 ? 'Work' : '')), escapeCsv(p2?.value),
            escapeCsv(p3?.label || (p3 ? 'Home' : '')), escapeCsv(p3?.value),
            // Address 1
            escapeCsv(addr?.label || (addr ? 'Home' : '')),
            escapeCsv(addr?.address),
            escapeCsv(addr?.street),
            escapeCsv(addr?.city),
            '', // PO Box
            escapeCsv(addr?.region),
            escapeCsv(addr?.postalCode),
            escapeCsv(addr?.country),
            // Website
            escapeCsv(web?.label || (web ? 'HomePage' : '')), escapeCsv(web?.url)
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

export const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
