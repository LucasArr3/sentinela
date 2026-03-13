'use client';

import React, { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isAfter,
  startOfDay,
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Shield, DollarSign, Repeat, Clock } from 'lucide-react';
import { getBaseShift, ShiftType, SHIFT_LABELS, QUARTERS } from '@/lib/scale-utils';
import { DayData } from '@/lib/db-service';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ShiftColors {
  ORDINARIO: string;
  EXTRA_DIURNA: string;
  EXTRA_NOTURNA: string;
  PERMUTA: string;
}

export type CalendarCellStyle = 'classic' | 'soft' | 'outline' | 'solid' | 'clean';

interface TacticalCalendarProps {
  onDateSelect: (date: Date) => void;
  onDateDoubleClick?: (date: Date) => void;
  overrides: Record<string, ShiftType>;
  dayData: Record<string, DayData>;
  selectedDate: Date | null;
  shiftColors?: ShiftColors;
  cellStyle?: CalendarCellStyle;
  baseDate?: Date;
  scaleCycle?: number;
  theme?: 'light' | 'dark';
}

export default function TacticalCalendar({ 
  onDateSelect, 
  onDateDoubleClick, 
  overrides, 
  dayData,
  selectedDate,
  shiftColors = {
    ORDINARIO: '#3b82f6', // blue-500
    EXTRA_DIURNA: '#10b981', // emerald-500
    EXTRA_NOTURNA: '#6366f1', // indigo-500
    PERMUTA: '#f59e0b', // amber-500
  },
  cellStyle = 'classic',
  baseDate,
  scaleCycle,
  theme = 'dark'
}: TacticalCalendarProps) {
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  if (!mounted) {
    return (
      <div className="tactical-card p-4 animate-pulse">
        <div className="h-8 w-1/3 bg-tactical-gray/10 rounded mb-6"></div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-4 bg-tactical-gray/10 rounded"></div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square bg-tactical-gray/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const getDayInfo = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const data = dayData[dateKey];
    const type = data?.type || overrides[dateKey] || getBaseShift(date, baseDate, scaleCycle);
    return {
      type,
      quarters: data?.quarters || [],
      observation: data?.observation
    };
  };

  const handleTap = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
    
    if (selectedKey === dateKey) {
      // Second click on the same date
      onDateDoubleClick?.(date);
    } else {
      // First click or click on a different date
      onDateSelect(date);
    }
  };

  const getShiftColor = (type: ShiftType) => {
    if (type === 'ORDINARIO') return shiftColors.ORDINARIO;
    if (type === 'EXTRA_DIURNA') return shiftColors.EXTRA_DIURNA;
    if (type === 'EXTRA_NOTURNA') return shiftColors.EXTRA_NOTURNA;
    if (type === 'PASSAR_PLANTAO' || type === 'ASSUMIR_PLANTAO') return shiftColors.PERMUTA;
    return 'transparent';
  };

  return (
    <div className={cn(
      "tactical-card p-4 border backdrop-blur-md rounded-3xl shadow-xl transition-all",
      theme === 'dark' 
        ? "bg-gradient-to-b from-zinc-900/80 to-black/80 border-white/5" 
        : "bg-white border-slate-200"
    )}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={cn(
          "text-xl font-display font-black capitalize tracking-tight whitespace-nowrap",
          theme === 'dark' ? "text-white" : "text-slate-900"
        )}>
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-[var(--accent)]"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-[var(--accent)]"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs font-bold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const { type, quarters, observation } = getDayInfo(day);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = isSameDay(day, new Date());
          const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));
          const isPlannedExtra = isFuture && (type === 'EXTRA_DIURNA' || type === 'EXTRA_NOTURNA');

          return (
            <button
              key={i}
              onClick={() => handleTap(day)}
              style={{
                backgroundColor: (type !== 'FOLGA' && (cellStyle === 'classic' || cellStyle === 'soft')) ? `${getShiftColor(type)}33` : 
                                (type !== 'FOLGA' && cellStyle === 'solid') ? getShiftColor(type) : undefined,
                borderColor: (type !== 'FOLGA' && (cellStyle === 'classic' || cellStyle === 'soft' || cellStyle === 'outline')) ? `${getShiftColor(type)}66` : undefined,
                color: (type !== 'FOLGA' && (cellStyle === 'classic' || cellStyle === 'clean')) ? getShiftColor(type) : 
                       (type !== 'FOLGA' && (cellStyle === 'solid' || cellStyle === 'soft')) ? '#fff' : undefined,
              }}
              className={cn(
                "relative aspect-square h-auto flex flex-col items-center justify-center p-1 transition-all overflow-hidden border rounded-2xl",
                !isCurrentMonth && "opacity-10",
                isToday && "ring-2 ring-[var(--accent)] ring-inset shadow-lg shadow-[var(--accent)]/20",
                isPlannedExtra && "border-dashed opacity-60",
                type === 'FOLGA' && "hover:bg-black/5 dark:hover:bg-white/5 border-transparent",
                type !== 'FOLGA' && "shadow-sm"
              )}
            >
              <div className="flex flex-col items-center justify-center">
                {type !== 'FOLGA' && (
                  <span className="text-[6px] font-black opacity-70 leading-none mb-0.5 uppercase tracking-tighter">
                    {type === 'ORDINARIO' ? '24h' : (type === 'EXTRA_DIURNA' || type === 'EXTRA_NOTURNA') ? '12h' : 'PERMUTA'}
                  </span>
                )}
                <span className={cn(
                  "font-black leading-none",
                  type === 'FOLGA' ? "text-sm" : "text-base"
                )}>
                  {format(day, 'd')}
                </span>
                {dayData[format(day, 'yyyy-MM-dd')]?.swapWith && (
                  <span 
                    style={{ backgroundColor: `${shiftColors.PERMUTA}22`, color: shiftColors.PERMUTA }}
                    className="text-[6px] font-black uppercase mt-1 px-1 rounded truncate max-w-full"
                  >
                    PP {dayData[format(day, 'yyyy-MM-dd')]?.swapWith}
                  </span>
                )}
              </div>

              {observation && (
                <div className="absolute bottom-1 right-1 w-1 h-1 bg-white/40 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColors.ORDINARIO }} />
          Plantão 24h
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColors.EXTRA_DIURNA }} />
          Extra Diurna
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColors.EXTRA_NOTURNA }} />
          Extra Noturna
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColors.PERMUTA }} />
          Permuta
        </div>
      </div>
    </div>
  );
}
