import fs from 'fs';
import path from 'path';
import { Contact, MeetingNote } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'seed-meetings.json');

export interface AppData {
  contacts: Contact[];
  meetings: MeetingNote[];
}

export function getAppData(): AppData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { contacts: [], meetings: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading app data:', error);
    return { contacts: [], meetings: [] };
  }
}

export function saveAppData(data: AppData): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving app data:', error);
    throw error;
  }
}

export function getContacts(): Contact[] {
  return getAppData().contacts;
}

export function getContactById(id: string): Contact | undefined {
  return getContacts().find((c) => c.id === id);
}

export function getMeetingsByContact(contactId: string): MeetingNote[] {
  return getAppData().meetings.filter((m) => m.contactId === contactId);
}

export function addContact(contact: Contact): Contact {
  const data = getAppData();
  data.contacts.push(contact);
  saveAppData(data);
  return contact;
}

export function addMeetingNote(note: MeetingNote): MeetingNote {
  const data = getAppData();
  data.meetings.push(note);
  saveAppData(data);
  return note;
}

export function upsertMeetingNote(note: MeetingNote): MeetingNote {
  const data = getAppData();
  const existingIdx = data.meetings.findIndex((m) => m.id === note.id);
  if (existingIdx !== -1) {
    data.meetings[existingIdx] = note;
  } else {
    data.meetings.push(note);
  }
  saveAppData(data);
  return note;
}

export function deleteMeetingNote(id: string): boolean {
  const data = getAppData();
  const initialLength = data.meetings.length;
  data.meetings = data.meetings.filter((m) => m.id !== id);
  if (data.meetings.length !== initialLength) {
    saveAppData(data);
    return true;
  }
  return false;
}

