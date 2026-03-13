'use client';

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDistanceToNow, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBaseShift, ShiftType } from '@/lib/scale-utils';
import { DayData } from '@/lib/db-service';

interface DashboardProps {
  overrides: Record<string, ShiftType>;
  dayData: Record<string, DayData>;
  extraValue: number;
  baseDate?: Date;
  scaleCycle?: number;
  theme?: 'light' | 'dark';
}

export default function Dashboard({ overrides, dayData, extraValue, baseDate, scaleCycle, theme = 'dark' }: DashboardProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate Next Shift
  const getNextShift = () => {
    const current = new Date();
    for (let i = 0; i < 30; i++) {
      const date = addDays(current, i);
      const key = date.toISOString().split('T')[0];
      const data = dayData[key];
      const type = data?.type || overrides[key] || getBaseShift(date, baseDate, scaleCycle);
      if (type !== 'FOLGA') {
        return date;
      }
    }
    return current;
  };

  // Calculate Extra Hours in current month
  const calculateStats = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    let extraHours = 0;
    
    Object.entries(dayData).forEach(([key, data]) => {
      const date = new Date(key);
      if (date.getMonth() === month && date.getFullYear() === year) {
        if (data.type === 'EXTRA_DIURNA' || data.type === 'EXTRA_NOTURNA') {
          extraHours += 12;
        }
      }
    });

    return { extraHours };
  };

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="tactical-card p-4 flex flex-col justify-between bg-blue-600/5 border-blue-500/20 min-h-[110px] animate-pulse">
          <div className="h-4 w-1/2 bg-blue-500/10 rounded mb-2"></div>
          <div className="h-8 w-3/4 bg-blue-500/10 rounded"></div>
        </div>
        <div className="tactical-card p-4 flex flex-col justify-between bg-emerald-600/5 border-emerald-500/20 min-h-[110px] animate-pulse">
          <div className="h-4 w-1/2 bg-emerald-500/10 rounded mb-2"></div>
          <div className="h-8 w-3/4 bg-emerald-500/10 rounded"></div>
        </div>
      </div>
    );
  }

  const nextShift = getNextShift();
  const { extraHours } = calculateStats();
  const earnings = extraHours * extraValue;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Próximo Plantão */}
      <div className={cn(
        "tactical-card p-4 flex flex-col justify-between min-h-[110px] rounded-3xl shadow-lg backdrop-blur-sm border transition-all",
        theme === 'dark' 
          ? "bg-gradient-to-br from-blue-600/20 to-blue-900/10 border-blue-500/20" 
          : "bg-blue-50 border-blue-100"
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest whitespace-nowrap",
            theme === 'dark' ? "text-blue-400" : "text-blue-600"
          )}>Próximo Plantão</span>
          <Clock className={cn("w-3.5 h-3.5 flex-shrink-0", theme === 'dark' ? "text-blue-500/50" : "text-blue-400")} />
        </div>
        <div>
          <h3 className={cn(
            "text-lg sm:text-xl font-black leading-tight tracking-tighter break-words",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>
            {formatDistanceToNow(nextShift, { locale: ptBR, addSuffix: true })}
          </h3>
          <p className="text-[8px] text-gray-500 mt-1 uppercase font-black tracking-widest whitespace-nowrap">Escala Operacional</p>
        </div>
      </div>

      {/* Horas Extras */}
      <div className={cn(
        "tactical-card p-4 flex flex-col justify-between min-h-[110px] rounded-3xl shadow-lg backdrop-blur-sm border transition-all",
        theme === 'dark' 
          ? "bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 border-emerald-500/20" 
          : "bg-emerald-50 border-emerald-100"
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest whitespace-nowrap",
            theme === 'dark' ? "text-emerald-400" : "text-emerald-600"
          )}>Extras / Mês</span>
          <TrendingUp className={cn("w-3.5 h-3.5 flex-shrink-0", theme === 'dark' ? "text-emerald-500/50" : "text-emerald-400")} />
        </div>
        <div>
          <h3 className={cn(
            "text-lg sm:text-xl font-black leading-tight tracking-tighter break-words",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>
            {extraHours}h
          </h3>
          <p className="text-[8px] text-gray-500 mt-1 uppercase font-black tracking-widest whitespace-nowrap">
            Previsto: {formatCurrency(earnings)}
          </p>
        </div>
      </div>
    </div>
  );
}
