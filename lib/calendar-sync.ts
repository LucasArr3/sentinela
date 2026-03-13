import { format, addHours, parseISO } from 'date-fns';
import { DayData } from './db-service';
import { getBaseShift, ShiftType, QUARTERS } from './scale-utils';

export function generateICS(dayData: Record<string, DayData>, overrides: Record<string, ShiftType>) {
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sentinela Tatico//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  // We'll export the next 90 days of scale
  const now = new Date();
  for (let i = -30; i < 90; i++) {
    const date = new Date();
    date.setDate(now.getDate() + i);
    const dateKey = format(date, 'yyyy-MM-dd');
    const data = dayData[dateKey];
    const type = data?.type || overrides[dateKey] || getBaseShift(date);

    if (type !== 'FOLGA') {
      const start = parseISO(`${dateKey}T08:00:00`);
      const end = addHours(start, 24);
      
      const summary = type === 'ORDINARIO' ? 'PLANTÃO 24H' : type.replace('_', ' ');
      const description = data?.observation ? `Obs: ${data.observation}` : '';

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`);
      icsContent.push(`DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`);
      icsContent.push(`SUMMARY:SENTINELA: ${summary}`);
      icsContent.push(`DESCRIPTION:${description}`);
      
      // Add alarms for quarters if selected
      if (data?.quarters && data.quarters.length > 0) {
        data.quarters.forEach(qId => {
          const quarter = QUARTERS.find(q => q.id === qId);
          if (quarter) {
            // We can't easily add multiple events in one loop without complexity, 
            // but we can add VALARM to the main event.
            // However, native calendars handle VALARM differently.
            // Better to add separate events for Quarters to ensure they ring.
            
            icsContent.push('BEGIN:VALARM');
            icsContent.push('TRIGGER:-PT15M'); // 15 minutes before
            icsContent.push('ACTION:DISPLAY');
            icsContent.push(`DESCRIPTION:ALERTA QUARTO: ${quarter.label}`);
            icsContent.push('END:VALARM');
          }
        });
      }

      icsContent.push('END:VEVENT');
    }
  }

  icsContent.push('END:VCALENDAR');
  return icsContent.join('\r\n');
}

export function downloadICS(content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', 'escala_sentinela.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
