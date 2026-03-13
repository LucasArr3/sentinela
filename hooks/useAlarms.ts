import { useState, useEffect, useCallback } from 'react';
import { format, addMinutes, isBefore, isAfter, startOfHour, setHours, setMinutes } from 'date-fns';

const T15_TIMES = [
  '17:45',
  '19:45',
  '21:45',
  '23:45',
  '01:45',
  '03:45'
];

export function useAlarms() {
  const [activeAlarms, setActiveAlarms] = useState<string[]>([]);
  const [isAlarming, setIsAlarming] = useState(false);
  const [currentAlarm, setCurrentAlarm] = useState<string | null>(null);

  const checkAlarms = useCallback(() => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');

    // Protocolo Alvorada (06:00)
    if (currentTime === '06:00' && !activeAlarms.includes('alvorada')) {
      setIsAlarming(true);
      setCurrentAlarm('Protocolo Alvorada');
      setActiveAlarms(prev => [...prev, 'alvorada']);
    }

    // Alarme T-15
    if (T15_TIMES.includes(currentTime) && !activeAlarms.includes(`t15-${currentTime}`)) {
      setIsAlarming(true);
      setCurrentAlarm(`Alarme T-15 (${currentTime})`);
      setActiveAlarms(prev => [...prev, `t15-${currentTime}`]);
    }

    // Reset alarms after 1 minute
    const resetTime = format(addMinutes(now, -1), 'HH:mm');
    if (activeAlarms.includes('alvorada') && currentTime !== '06:00') {
      setActiveAlarms(prev => prev.filter(a => a !== 'alvorada'));
    }
    T15_TIMES.forEach(time => {
      if (activeAlarms.includes(`t15-${time}`) && currentTime !== time) {
        setActiveAlarms(prev => prev.filter(a => a !== `t15-${time}`));
      }
    });
  }, [activeAlarms]);

  useEffect(() => {
    const interval = setInterval(checkAlarms, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [checkAlarms]);

  const stopAlarm = () => {
    setIsAlarming(false);
    setCurrentAlarm(null);
  };

  return { isAlarming, currentAlarm, stopAlarm };
}

