import { differenceInDays, startOfDay } from 'date-fns';

export const DEFAULT_BASE_DATE = new Date(2023, 2, 31); // 31/03/2023
export const DEFAULT_CYCLE_DAYS = 4; // 24x72 (1 on, 3 off)

export type ShiftType = 'ORDINARIO' | 'EXTRA_DIURNA' | 'EXTRA_NOTURNA' | 'PASSAR_PLANTAO' | 'ASSUMIR_PLANTAO' | 'FOLGA';

export const SHIFT_LABELS: Record<ShiftType, string> = {
  ORDINARIO: 'Plantão 24h',
  EXTRA_DIURNA: 'Extra Diurna',
  EXTRA_NOTURNA: 'Extra Noturna',
  PASSAR_PLANTAO: 'Passar Plantão',
  ASSUMIR_PLANTAO: 'Assumir Plantão',
  FOLGA: 'Folga'
};

export function getBaseShift(date: Date, baseDate: Date = DEFAULT_BASE_DATE, cycleDays: number = DEFAULT_CYCLE_DAYS): ShiftType {
  const diff = differenceInDays(startOfDay(date), startOfDay(baseDate));
  // Cycle calculation: mod cycleDays. 
  // For 24x72, cycle is 4. mod 0 is shift.
  // For 12x36, cycle is 2. mod 0 is shift.
  const mod = ((diff % cycleDays) + cycleDays) % cycleDays;
  return mod === 0 ? 'ORDINARIO' : 'FOLGA';
}

export const ALARM_SOUNDS = [
  { id: 'tactical', name: 'Alerta Tático (Longo)', url: 'https://assets.mixkit.co/active_storage/sfx/941/941-preview.mp3' }, // Emergency siren
  { id: 'siren', name: 'Sirene Policial', url: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3' }, // Police siren
  { id: 'radio', name: 'Rádio HT (Câmbio)', url: 'https://assets.mixkit.co/active_storage/sfx/2532/2532-preview.mp3' }, // Radio noise
  { id: 'radar', name: 'Sonar Submarino', url: 'https://assets.mixkit.co/active_storage/sfx/1059/1059-preview.mp3' }, // Sonar
  { id: 'emergency', name: 'Alvorada Operacional', url: 'https://assets.mixkit.co/active_storage/sfx/941/941-preview.mp3' }, // High intensity
];

export const QUARTERS = [
  { id: '18-20', label: '18h – 20h', alarm: '17:45', sound: 'tactical' },
  { id: '20-22', label: '20h – 22h', alarm: '19:45', sound: 'tactical' },
  { id: '22-00', label: '22h – 00h', alarm: '21:45', sound: 'tactical' },
  { id: '00-02', label: '00h – 02h', alarm: '23:45', sound: 'tactical' },
  { id: '02-04', label: '02h – 04h', alarm: '01:45', sound: 'tactical' },
  { id: '04-06', label: '04h – 06h', alarm: '03:45', sound: 'tactical' },
  { id: 'ALVORADA', label: '06h – 08h (ALVORADA)', alarm: '06:00', sound: 'emergency' },
];
