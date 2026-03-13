import { db, auth } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ShiftType } from './scale-utils';

export interface Occurrence {
  id: string;
  time: string;
  title: string;
  description: string;
  attachments?: {
    url: string;
    type: 'image' | 'video';
    name: string;
  }[];
}

export interface DayData {
  type: ShiftType;
  quarters: string[];
  observation?: string;
  swapWith?: string;
  occurrences?: Occurrence[];
}

export interface AlarmSettings {
  id: string;
  time: string;
  sound: string;
}

export interface UserPreferences {
  overrides: Record<string, ShiftType>; // Legacy, keeping for compatibility
  dayData?: Record<string, DayData>;
  selectedQuarters: string[]; // Global defaults
  customAlarms?: AlarmSettings[];
  extraValue: number;
  baseDate?: string; // ISO string
  scaleCycle?: number; // Number of days in cycle
  scaleText?: string; // e.g. "24x72"
  lastSync: number;
  shiftColors?: {
    ORDINARIO: string;
    EXTRA_DIURNA: string;
    EXTRA_NOTURNA: string;
    PERMUTA: string;
  };
  cellStyle?: string;
}

export async function saveUserData(data: UserPreferences) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await setDoc(doc(db, 'users', user.uid), {
      ...data,
      lastSync: Date.now()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

export async function loadUserData(): Promise<UserPreferences | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserPreferences;
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
  return null;
}
