'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { generateICS, downloadICS } from '@/lib/calendar-sync';
import { 
  Shield, 
  Settings, 
  LogOut, 
  Plus, 
  Minus, 
  Save, 
  X,
  DollarSign,
  Repeat,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Bell,
  Clock,
  ChevronRight,
  User,
  RefreshCw,
  TrendingUp,
  Bot,
  Sparkles,
  Smartphone,
  Download,
  ExternalLink,
  Palette,
  CloudUpload,
  CloudDownload,
  Mail,
  MessageSquare,
  LogIn
} from 'lucide-react';
import TacticalCalendar, { ShiftColors, CalendarCellStyle } from '@/components/TacticalCalendar';
import Dashboard from '@/components/Dashboard';
import AlarmManager from '@/components/AlarmManager';
import AlvoradaModal from '@/components/AlvoradaModal';
import { getBaseShift, ShiftType, QUARTERS, SHIFT_LABELS, ALARM_SOUNDS } from '@/lib/scale-utils';
import { motion, AnimatePresence } from 'motion/react';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import Image from 'next/image';
import { saveUserData, loadUserData, DayData, Occurrence, AlarmSettings } from '@/lib/db-service';
import AIAssistant from '@/components/AIAssistant';
import OccurrenceBook from '@/components/OccurrenceBook';
import { auth, googleProvider } from '@/lib/firebase';
import AuthModal from '@/components/AuthModal';
import LoginScreen from '@/components/LoginScreen';
import { onAuthStateChanged, signOut, signInAnonymously, signInWithPopup } from 'firebase/auth';

const DEFAULT_SHIFT_COLORS: ShiftColors = {
  ORDINARIO: '#3b82f6',
  EXTRA_DIURNA: '#10b981',
  EXTRA_NOTURNA: '#6366f1',
  PERMUTA: '#f59e0b',
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'settings' | 'ai'>('dashboard');
  const [overrides, setOverrides] = useState<Record<string, ShiftType>>({});
  const [dayData, setDayData] = useState<Record<string, DayData>>({});
  const [customAlarms, setCustomAlarms] = useState<AlarmSettings[]>([]);
  const [extraValue, setExtraValue] = useState(219);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previewDate, setPreviewDate] = useState<Date | null>(null);
  const [isAlvoradaActive, setIsAlvoradaActive] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [accentColor, setAccentColor] = useState('blue');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [shiftColors, setShiftColors] = useState<ShiftColors>(DEFAULT_SHIFT_COLORS);
  const [cellStyle, setCellStyle] = useState<CalendarCellStyle>('classic');
  const [baseDate, setBaseDate] = useState<Date>(new Date(2023, 2, 31));
  const [scaleCycle, setScaleCycle] = useState<number>(4);
  const [scaleText, setScaleText] = useState('24x72');

  // Modal state for editing day
  const [editQuarters, setEditQuarters] = useState<string[]>([]);
  const [editObservation, setEditObservation] = useState('');
  const [editSwapWith, setEditSwapWith] = useState('');
  const [editOccurrences, setEditOccurrences] = useState<Occurrence[]>([]);

  // Initial load from localStorage and SW registration
  useEffect(() => {
    setHasMounted(true);
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }

    // Request Notification Permissions
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const savedOverrides = localStorage.getItem('sentinela_overrides');
    const savedDayData = localStorage.getItem('sentinela_day_data');
    const savedExtra = localStorage.getItem('sentinela_extra_value');
    const savedCustomAlarms = localStorage.getItem('sentinela_custom_alarms');

    if (savedOverrides) setOverrides(JSON.parse(savedOverrides));
    if (savedDayData) setDayData(JSON.parse(savedDayData));
    if (savedExtra) setExtraValue(Number(savedExtra));
    if (savedCustomAlarms) setCustomAlarms(JSON.parse(savedCustomAlarms));
    
    const savedTheme = localStorage.getItem('sentinela_theme');
    const savedAccent = localStorage.getItem('sentinela_accent');
    const savedShiftColors = localStorage.getItem('sentinela_shift_colors');
    const savedCellStyle = localStorage.getItem('sentinela_cell_style');
    const savedBaseDate = localStorage.getItem('sentinela_base_date');
    const savedScaleCycle = localStorage.getItem('sentinela_scale_cycle');

    if (savedTheme) setTheme(savedTheme as 'dark' | 'light');
    if (savedAccent) setAccentColor(savedAccent);
    if (savedShiftColors) setShiftColors(JSON.parse(savedShiftColors));
    if (savedCellStyle) setCellStyle(savedCellStyle as CalendarCellStyle);
    if (savedBaseDate) setBaseDate(new Date(savedBaseDate));
    if (savedScaleCycle) setScaleCycle(Number(savedScaleCycle));
  }, []);

  const [wakeLock, setWakeLock] = useState<any>(null);
  const toggleWakeLock = async () => {
    if (wakeLock) {
      wakeLock.release();
      setWakeLock(null);
    } else {
      try {
        if ('wakeLock' in navigator) {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err) {
        console.error('Wake Lock failed', err);
      }
    }
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Check for Alarms
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const todayKey = format(now, 'yyyy-MM-dd');
      const todayData = dayData[todayKey];
      const todayType = todayData?.type || overrides[todayKey] || getBaseShift(now, baseDate, scaleCycle);

      // Only trigger if it's a shift day (Plantão or Extra)
      if (todayType === 'FOLGA') return;

      const activeQuarters = todayData?.quarters || [];

      activeQuarters.forEach(qId => {
        const custom = customAlarms.find(a => a.id === qId);
        const def = QUARTERS.find(q => q.id === qId);
        const alarmTime = custom?.time || def?.alarm;
        const soundId = custom?.sound || def?.sound || 'tactical';

        if (alarmTime === currentTime) {
          if (qId === 'ALVORADA') {
            setIsAlvoradaActive(true);
          } else {
            // Play sound
            const sound = ALARM_SOUNDS.find(s => s.id === soundId);
            if (sound) {
              // Stop previous audio if playing
              if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
              }

              const audio = new Audio(sound.url);
              audio.loop = qId === 'ALVORADA'; // Loop for alvorada
              console.log('Disparando alarme:', qId, sound.url);
              audio.play().catch(e => {
                console.warn('Audio play blocked or failed:', e);
                // Fallback: visual notification is already handled below
              });
              setCurrentAudio(audio);
              
              // Show notification if permitted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Sentinela Tático', {
                  body: `Início do Quarto: ${QUARTERS.find(q => q.id === qId)?.label}`,
                  icon: '/shield.png',
                  tag: qId, // Prevent duplicate notifications
                  requireInteraction: true // Keep notification until user interacts
                });
              }
            }
          }
        }
      });
    };

    const interval = setInterval(checkAlarms, 60000);
    return () => clearInterval(interval);
  }, [customAlarms, dayData, overrides]);

  // Save state to localStorage
  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem('sentinela_overrides', JSON.stringify(overrides));
      localStorage.setItem('sentinela_day_data', JSON.stringify(dayData));
      localStorage.setItem('sentinela_extra_value', extraValue.toString());
      localStorage.setItem('sentinela_theme', theme);
      localStorage.setItem('sentinela_accent', accentColor);
      localStorage.setItem('sentinela_custom_alarms', JSON.stringify(customAlarms));
      localStorage.setItem('sentinela_shift_colors', JSON.stringify(shiftColors));
      localStorage.setItem('sentinela_cell_style', cellStyle);
      localStorage.setItem('sentinela_base_date', baseDate.toISOString());
      localStorage.setItem('sentinela_scale_cycle', scaleCycle.toString());
    }
  }, [overrides, dayData, extraValue, hasMounted, theme, accentColor, customAlarms, shiftColors, cellStyle, baseDate, scaleCycle]);

  const handleSync = async () => {
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (error: any) {
        if (error.code === 'auth/operation-not-allowed') {
          alert('O login anônimo não está ativado no Console do Firebase. Por favor, ative-o em Authentication > Sign-in method.');
        } else {
          alert('Erro ao iniciar sessão anônima. Verifique as chaves do Firebase.');
        }
        return;
      }
    }

    setIsSyncing(true);
    try {
      await saveUserData({
        overrides,
        dayData,
        selectedQuarters: [], // Deprecated
        customAlarms,
        extraValue,
        lastSync: Date.now(),
        shiftColors,
        cellStyle,
        baseDate: baseDate.toISOString(),
        scaleCycle,
        scaleText
      });
      alert('Dados sincronizados com sucesso!');
    } catch (error) {
      alert('Erro ao sincronizar dados.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      alert('Login com Google realizado com sucesso!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        alert('O bloqueador de popups impediu o login. Por favor, autorize popups para este site e tente novamente.');
      } else if (error.code === 'auth/unauthorized-domain') {
        alert('Este domínio não está autorizado no Firebase. Adicione "' + window.location.hostname + '" aos domínios autorizados no Console do Firebase.');
      } else {
        alert('Erro ao fazer login: ' + error.message);
      }
    }
  };

  const handleLoadFromCloud = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const data = await loadUserData();
      if (data) {
        setOverrides(data.overrides);
        if (data.dayData) setDayData(data.dayData);
        if (data.customAlarms) setCustomAlarms(data.customAlarms);
        if (data.shiftColors) setShiftColors(data.shiftColors);
        if (data.cellStyle) setCellStyle(data.cellStyle as CalendarCellStyle);
        if (data.baseDate) setBaseDate(new Date(data.baseDate));
        if (data.scaleCycle) setScaleCycle(data.scaleCycle);
        if (data.scaleText) setScaleText(data.scaleText);
        setExtraValue(data.extraValue);
        alert('Dados carregados da nuvem!');
      } else {
        alert('Nenhum dado encontrado na nuvem.');
      }
    } catch (error) {
      alert('Erro ao carregar dados.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleScaleTextChange = (text: string) => {
    setScaleText(text);
    // Parse XxY format
    const match = text.match(/^(\d+)x(\d+)$/i);
    if (match) {
      const work = parseInt(match[1]);
      const rest = parseInt(match[2]);
      if (work > 0 && rest > 0) {
        const totalHours = work + rest;
        const days = totalHours / 24;
        setScaleCycle(days);
      }
    } else {
      // Try to parse as single number
      const days = parseFloat(text);
      if (!isNaN(days) && days > 0) {
        setScaleCycle(days);
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    setPreviewDate(date);
  };

  const openEditModal = (date: Date) => {
    setSelectedDate(date);
    const key = format(date, 'yyyy-MM-dd');
    const existing = dayData[key];
    setEditQuarters(existing?.quarters || []);
    setEditObservation(existing?.observation || '');
    setEditSwapWith(existing?.swapWith || '');
    setEditOccurrences(existing?.occurrences || []);
  };

  const updateShift = (type: ShiftType) => {
    if (!selectedDate) return;
    const key = format(selectedDate, 'yyyy-MM-dd');
    
    const newDayData = { ...dayData };
    if (type === 'FOLGA') {
      delete newDayData[key];
      // Also cleanup legacy overrides
      const newOverrides = { ...overrides };
      delete newOverrides[key];
      setOverrides(newOverrides);
    } else {
      newDayData[key] = {
        type,
        quarters: editQuarters,
        observation: editObservation,
        swapWith: editSwapWith,
        occurrences: editOccurrences
      };
    }
    
    setDayData(newDayData);
    setSelectedDate(null);
  };

  const handleUpdateAlarm = (id: string, time: string, sound: string) => {
    setCustomAlarms(prev => {
      const filtered = prev.filter(a => a.id !== id);
      return [...filtered, { id, time, sound }];
    });
  };

  const handleResetAlarms = () => {
    if (confirm('Deseja resetar todos os alarmes para o padrão?')) {
      setCustomAlarms([]);
      localStorage.removeItem('sentinela_custom_alarms');
    }
  };

  const exportToWhatsApp = () => {
    const today = new Date();
    const monthName = format(today, 'MMMM', { locale: ptBR });
    const year = today.getFullYear();
    
    let message = `*ESCALA ${monthName.toUpperCase()}/${year}*\n\n`;

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const plantoes: string[] = [];
    const extrasDiurnas: string[] = [];
    const extrasNoturnas: string[] = [];
    const permutas: string[] = [];

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const key = format(d, 'yyyy-MM-dd');
      const data = dayData[key];
      const type = data?.type || overrides[key] || getBaseShift(d, baseDate, scaleCycle);
      const dayNum = format(d, 'dd');

      if (type === 'ORDINARIO') {
        plantoes.push(dayNum);
      } else if (type === 'EXTRA_DIURNA') {
        extrasDiurnas.push(dayNum);
      } else if (type === 'EXTRA_NOTURNA') {
        extrasNoturnas.push(dayNum);
      } else if (type === 'PASSAR_PLANTAO') {
        permutas.push(`${dayNum} (PP ${data?.swapWith || '...'} assumirá o Plantão)`);
      } else if (type === 'ASSUMIR_PLANTAO') {
        permutas.push(`${dayNum} (Assumir o Plantão do PP ${data?.swapWith || '...'})`);
      }
    }

    if (plantoes.length > 0) message += `*Plantões*: ${plantoes.join(', ')}\n`;
    if (extrasDiurnas.length > 0) message += `*Extras Diurnas*: ${extrasDiurnas.join(', ')}\n`;
    if (extrasNoturnas.length > 0) message += `*Extras Noturnas*: ${extrasNoturnas.join(', ')}\n`;
    if (permutas.length > 0) {
      message += `*Permutas*:\n`;
      permutas.forEach(p => message += `      ${p}\n`);
    }

    message += `\nGerado por Sentinela Tático`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  if (!authChecked || !hasMounted) {
    return (
      <main className={cn(
        "min-h-screen flex items-center justify-center transition-colors duration-500",
        theme === 'dark' ? "bg-[#050505]" : "bg-[#F8FAFC]"
      )}>
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <Shield size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 animate-pulse" />
        </div>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <main className={cn(
      "min-h-screen pb-24 max-w-md mx-auto relative overflow-x-hidden transition-colors duration-700",
      theme === 'dark' 
        ? "bg-[#050505] text-white selection:bg-blue-500/30" 
        : "bg-[#F8FAFC] text-slate-900 selection:bg-blue-200"
    )}
    style={{
      '--accent': accentColor === 'blue' ? '#2563eb' : accentColor === 'emerald' ? '#059669' : accentColor === 'amber' ? '#d97706' : '#dc2626',
      '--accent-soft': accentColor === 'blue' ? 'rgba(37, 99, 235, 0.15)' : accentColor === 'emerald' ? 'rgba(5, 150, 105, 0.15)' : accentColor === 'amber' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(220, 38, 38, 0.15)',
      '--card-bg': theme === 'dark' ? 'rgba(20, 20, 20, 0.6)' : 'rgba(255, 255, 255, 0.8)',
      '--card-border': theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      '--nav-bg': theme === 'dark' ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    } as React.CSSProperties}
    >
      {/* Background Gradients (Dark Mode Only) */}
      {theme === 'dark' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
      )}

      {/* Header Compacto e Integrado */}
      <header className={cn(
        "relative pt-10 pb-6 px-4 overflow-hidden transition-all duration-500 border-b",
        theme === 'dark' 
          ? "bg-black/5 backdrop-blur-md border-white/5" 
          : "bg-white/10 backdrop-blur-md border-slate-100"
      )}>
        <div className={cn(
          "absolute top-0 left-0 w-full h-64 pointer-events-none",
          theme === 'dark' ? "bg-gradient-to-b from-[var(--accent)]/10 to-transparent" : "bg-gradient-to-b from-[var(--accent)]/5 to-transparent"
        )}></div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-14 h-14 border rounded-[22px] flex items-center justify-center shadow-2xl relative group overflow-hidden transition-colors",
              theme === 'dark' ? "bg-zinc-900/20 border-white/10" : "bg-white/20 border-slate-200"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Shield size={28} className="text-[var(--accent)] relative z-10" />
            </div>
            <div>
              <h1 className={cn(
                "text-2xl font-display font-black tracking-tighter leading-none transition-colors whitespace-nowrap",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>
                SENTINELA <span className="text-[var(--accent)]">TÁTICO</span>
              </h1>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2 flex items-center gap-2 whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full"></span>
                Operacional v1.1
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "px-3 py-1.5 border rounded-2xl shadow-sm transition-colors",
              theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50/50 border-emerald-200"
            )}>
              <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Ativo
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className={cn("space-y-4 pt-6", activeTab === 'ai' ? "px-0" : "px-4")}>
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Dashboard 
                overrides={overrides} 
                dayData={dayData} 
                extraValue={extraValue} 
                baseDate={baseDate}
                scaleCycle={scaleCycle}
                theme={theme}
              />
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={exportToWhatsApp}
                  className={cn(
                    "tactical-card p-4 flex items-center justify-between group transition-all rounded-3xl border shadow-lg",
                    theme === 'dark' 
                      ? "bg-gradient-to-r from-emerald-600/20 to-emerald-900/10 border-emerald-500/30 hover:from-emerald-600/30 hover:to-emerald-900/20" 
                      : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      theme === 'dark' ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                    )}>
                      <Save size={20} />
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "text-xs font-bold",
                        theme === 'dark' ? "text-emerald-400" : "text-emerald-700"
                      )}>Exportar Relatório</p>
                      <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">WhatsApp / PDF</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className={cn(
                    "transition-transform group-hover:translate-x-1",
                    theme === 'dark' ? "text-emerald-500/50" : "text-emerald-400"
                  )} />
                </button>

                <div className="tactical-card p-6 bg-gradient-to-br from-[var(--accent-soft)] to-transparent border-[var(--accent-soft)]">
                  <h3 className="text-lg font-display font-bold mb-2">Bem-vindo, Operador</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Sua escala está sincronizada e protegida. Use o calendário para gerenciar permutas e extras.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <TacticalCalendar 
                onDateSelect={handleDateSelect} 
                onDateDoubleClick={openEditModal}
                overrides={overrides} 
                dayData={dayData} 
                selectedDate={previewDate}
                shiftColors={shiftColors}
                cellStyle={cellStyle}
                baseDate={baseDate}
                scaleCycle={scaleCycle}
                theme={theme}
              />
              
              {/* Day Summary Section */}
              <AnimatePresence mode="wait">
                {previewDate && (
                  <motion.div
                    key={format(previewDate, 'yyyy-MM-dd')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="tactical-card p-4 border-l-4 border-[var(--accent)]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-tight">
                          {format(previewDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </h4>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resumo do Dia</p>
                      </div>
                      <button 
                        onClick={() => openEditModal(previewDate)}
                        className="p-2 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent-soft)]/20 transition-all"
                      >
                        <Settings size={16} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const key = format(previewDate, 'yyyy-MM-dd');
                        const data = dayData[key];
                        const type = data?.type || overrides[key] || getBaseShift(previewDate, baseDate, scaleCycle);
                        
                        if (type === 'FOLGA') {
                          return <p className="text-xs text-gray-500 italic">Nenhuma atividade registrada para este dia.</p>;
                        }

                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "p-1.5 rounded-lg",
                                type === 'ORDINARIO' && "bg-[var(--accent-soft)] text-[var(--accent)]",
                                type === 'EXTRA_DIURNA' && "bg-emerald-500/20 text-emerald-400",
                                type === 'EXTRA_NOTURNA' && "bg-indigo-500/20 text-indigo-400",
                                (type === 'PASSAR_PLANTAO' || type === 'ASSUMIR_PLANTAO') && "bg-amber-500/20 text-amber-400",
                              )}>
                                {type === 'ORDINARIO' && <Shield size={14} />}
                                {(type === 'EXTRA_DIURNA' || type === 'EXTRA_NOTURNA') && <DollarSign size={14} />}
                                {(type === 'PASSAR_PLANTAO' || type === 'ASSUMIR_PLANTAO') && <Repeat size={14} />}
                              </div>
                              <span className="text-xs font-bold uppercase">{SHIFT_LABELS[type]}</span>
                              {data?.swapWith && (
                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded uppercase">
                                  PP {data.swapWith}
                                </span>
                              )}
                            </div>

                            {data?.quarters && data.quarters.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Quartos de Hora:</p>
                                <div className="flex flex-wrap gap-1">
                                  {data.quarters.map(qId => (
                                    <span key={qId} className="text-[9px] font-bold bg-tactical-gray/20 px-2 py-1 rounded-md text-gray-300">
                                      {QUARTERS.find(q => q.id === qId)?.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {data?.observation && (
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Observações:</p>
                                <p className="text-xs text-gray-400 bg-tactical-gray/10 p-2 rounded-lg border border-white/5 italic">
                                  &quot;{data.observation}&quot;
                                </p>
                              </div>
                            )}

                            {data?.occurrences && data.occurrences.length > 0 && (
                              <OccurrenceBook 
                                occurrences={data.occurrences} 
                                onAdd={() => {}} 
                                onDelete={() => {}} 
                                readOnly 
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}


          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <AIAssistant 
                dayData={dayData}
                overrides={overrides}
                extraValue={extraValue}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-4 pb-20"
            >
              {/* 1. Escala & Operacional */}
              <div className={cn(
                "tactical-card overflow-hidden border rounded-3xl shadow-xl transition-all",
                theme === 'dark' ? "bg-gradient-to-b from-zinc-900/80 to-black/80 border-white/5" : "bg-white border-slate-200"
              )}>
                <div className={cn(
                  "p-4 border-b",
                  theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                )}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <CalendarIcon size={14} className="text-[var(--accent)]" />
                    Escala & Operacional
                  </h3>
                </div>
                
                <div className="p-4 space-y-5">
                  {/* Data Inicial */}
                  <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Data Inicial (Plantão)</label>
                    <input 
                      type="date" 
                      value={format(baseDate, 'yyyy-MM-dd')}
                      onChange={(e) => setBaseDate(new Date(e.target.value + 'T12:00:00'))}
                      className={cn(
                        "w-full border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/5 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>

                  {/* Escala de Serviço */}
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Escala de Serviço</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 4, label: '24x72', text: '24x72' },
                        { id: 2, label: '12x36', text: '12x36' },
                        { id: 3, label: '24x48', text: '24x48' },
                        { id: 1, label: 'Diário', text: '1' },
                      ].map(cycle => (
                        <button
                          key={cycle.label}
                          onClick={() => {
                            setScaleCycle(cycle.id);
                            setScaleText(cycle.text);
                          }}
                          className={cn(
                            "p-3 text-[10px] font-black rounded-2xl border transition-all uppercase tracking-wider",
                            scaleText === cycle.text 
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20" 
                              : theme === 'dark' 
                                ? "bg-black/20 border-white/5 text-gray-500 hover:bg-black/40" 
                                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                          )}
                        >
                          {cycle.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Personalizada (ex: 24x36 ou dias)"
                        value={scaleText}
                        onChange={(e) => handleScaleTextChange(e.target.value)}
                        className={cn(
                          "w-full border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all",
                          theme === 'dark' ? "bg-black/40 border-white/5 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-500 uppercase">
                        {scaleCycle.toFixed(1)} Dias
                      </div>
                    </div>
                  </div>

                  {/* Valor da Extra */}
                  <div className={cn(
                    "pt-4 border-t",
                    theme === 'dark' ? "border-white/5" : "border-slate-100"
                  )}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Valor Hora Extra</p>
                      <div className={cn(
                        "flex items-center gap-3 p-1.5 rounded-2xl",
                        theme === 'dark' ? "bg-black/40" : "bg-slate-100"
                      )}>
                        <button 
                          onClick={() => setExtraValue(v => Math.max(0, v - 10))}
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                            theme === 'dark' ? "bg-white/5 text-gray-400 hover:text-white" : "bg-white text-slate-400 hover:text-slate-900 shadow-sm"
                          )}
                        >
                          <Minus size={14} />
                        </button>
                        <span className={cn(
                          "text-xs font-black min-w-[80px] text-center",
                          theme === 'dark' ? "text-white" : "text-slate-900"
                        )}>
                          {extraValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <button 
                          onClick={() => setExtraValue(v => v + 10)}
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                            theme === 'dark' ? "bg-white/5 text-gray-400 hover:text-white" : "bg-white text-slate-400 hover:text-slate-900 shadow-sm"
                          )}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Personalização */}
              <div className={cn(
                "tactical-card overflow-hidden border rounded-3xl shadow-xl transition-all",
                theme === 'dark' ? "bg-gradient-to-b from-zinc-900/80 to-black/80 border-white/5" : "bg-white border-slate-200"
              )}>
                <div className={cn(
                  "p-4 border-b",
                  theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                )}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Palette size={14} className="text-[var(--accent)]" />
                    Personalização Visual
                  </h3>
                </div>
                
                <div className="p-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "flex p-1 rounded-2xl",
                      theme === 'dark' ? "bg-black/40" : "bg-slate-100"
                    )}>
                      <button 
                        onClick={() => setTheme('dark')} 
                        className={cn(
                          "px-4 py-2 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest", 
                          theme === 'dark' ? "bg-[var(--accent)] text-white shadow-lg" : "text-gray-500"
                        )}
                      >
                        Escuro
                      </button>
                      <button 
                        onClick={() => setTheme('light')} 
                        className={cn(
                          "px-4 py-2 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest", 
                          theme === 'light' ? "bg-[var(--accent)] text-white shadow-lg" : "text-gray-500"
                        )}
                      >
                        Claro
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {['blue', 'emerald', 'amber', 'red'].map(id => (
                        <button 
                          key={id} 
                          onClick={() => setAccentColor(id)} 
                          className={cn(
                            "w-7 h-7 rounded-full border-2 transition-all", 
                            id === 'blue' && "bg-blue-600", 
                            id === 'emerald' && "bg-emerald-600", 
                            id === 'amber' && "bg-amber-600", 
                            id === 'red' && "bg-red-600", 
                            accentColor === id ? "border-white dark:border-white scale-110 shadow-lg" : "border-transparent opacity-40 hover:opacity-100"
                          )} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Estilo do Calendário</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ id: 'classic', label: 'Clássico' }, { id: 'soft', label: 'Suave' }, { id: 'clean', label: 'Limpo' }].map(style => (
                        <button 
                          key={style.id} 
                          onClick={() => setCellStyle(style.id as CalendarCellStyle)} 
                          className={cn(
                            "py-3 text-[9px] font-black rounded-2xl border transition-all uppercase tracking-widest", 
                            cellStyle === style.id 
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg" 
                              : theme === 'dark' 
                                ? "bg-black/20 border-white/5 text-gray-500 hover:bg-black/40" 
                                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                          )}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Conta & Backup */}
              <div className={cn(
                "tactical-card overflow-hidden border rounded-3xl shadow-xl transition-all",
                theme === 'dark' ? "bg-gradient-to-b from-zinc-900/80 to-black/80 border-white/5" : "bg-white border-slate-200"
              )}>
                <div className={cn(
                  "p-4 border-b",
                  theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                )}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <User size={14} className="text-[var(--accent)]" />
                    Conta & Backup na Nuvem
                  </h3>
                </div>
                
                <div className="p-4 space-y-4">
                  {user ? (
                    <div className={cn(
                      "flex items-center justify-between p-4 rounded-3xl border",
                      theme === 'dark' ? "bg-black/40 border-white/5" : "bg-slate-50 border-slate-200 shadow-sm"
                    )}>
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <Image src={user.photoURL} alt="Avatar" width={40} height={40} className="rounded-2xl border border-white/10" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 bg-[var(--accent)] rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20">{user.displayName?.[0] || 'U'}</div>
                        )}
                        <div className="overflow-hidden">
                          <p className={cn(
                            "text-xs font-black truncate",
                            theme === 'dark' ? "text-white" : "text-slate-900"
                          )}>{user.displayName || 'Operador'}</p>
                          <p className="text-[10px] text-gray-500 truncate font-medium">{user.email}</p>
                        </div>
                      </div>
                      <button onClick={() => signOut(auth)} className={cn(
                        "p-3 transition-colors rounded-2xl",
                        theme === 'dark' ? "bg-white/5 text-gray-400 hover:text-red-500" : "bg-white text-slate-400 hover:text-red-500 shadow-sm"
                      )}><LogOut size={18} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setIsAuthModalOpen(true)} className="w-full p-4 bg-blue-600 text-white hover:bg-blue-700 rounded-3xl flex items-center justify-center gap-3 text-[11px] font-black transition-all active:scale-95 shadow-xl shadow-blue-600/20 uppercase tracking-widest"><LogIn size={18} />Conectar Conta Google</button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleSync} disabled={isSyncing || !user} className={cn(
                      "p-4 border disabled:opacity-30 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group",
                      theme === 'dark' ? "bg-emerald-600/10 border-emerald-500/20 hover:bg-emerald-600/20" : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                    )}>
                      <CloudUpload size={20} className="text-emerald-600 dark:text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">Salvar Nuvem</span>
                    </button>
                    <button onClick={handleLoadFromCloud} disabled={isSyncing || !user} className={cn(
                      "p-4 border disabled:opacity-30 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group",
                      theme === 'dark' ? "bg-blue-600/10 border-blue-500/20 hover:bg-blue-600/20" : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                    )}>
                      <CloudDownload size={20} className="text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500">Restaurar</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-center pt-6 opacity-30">
                <p className="text-[8px] font-black uppercase tracking-[0.6em]">Sentinela Tático v1.1</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating AI Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setActiveTab('ai')}
        className={cn(
          "fixed right-6 bottom-28 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-40 transition-all",
          activeTab === 'ai' 
            ? "scale-0 pointer-events-none" 
            : "bg-zinc-900 border border-blue-500/50 text-blue-500 hover:bg-blue-600 hover:text-white"
        )}
      >
        <div className="absolute -inset-2 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
        <Bot size={24} className="relative z-10" />
      </motion.button>

      {/* Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 py-4 flex items-center justify-between z-50 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] border-t transition-all duration-700",
        theme === 'dark' 
          ? "bg-black/30 backdrop-blur-2xl border-white/10" 
          : "bg-white/40 backdrop-blur-2xl border-slate-200"
      )}>
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Início' },
          { id: 'calendar', icon: CalendarIcon, label: 'Escala' },
          { id: 'ai', icon: Sparkles, label: 'Sentinela', isSpecial: true },
          { id: 'settings', icon: Settings, label: 'Ajustes' },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all relative group",
              activeTab === item.id ? (item.isSpecial ? "text-blue-500" : "text-[var(--accent)]") : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            )}
          >
            {activeTab === item.id && (
              <motion.div 
                layoutId="nav-active"
                className={cn(
                  "absolute -top-4 w-8 h-1 rounded-full",
                  item.isSpecial ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-[var(--accent)]"
                )}
              />
            )}
            <div className={cn(
              "p-1 rounded-xl transition-all",
              item.isSpecial && activeTab === item.id && "bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            )}>
              <item.icon size={item.isSpecial ? 24 : 22} className={cn("transition-transform", activeTab === item.id && "scale-110")} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Date Action Modal */}
      <AnimatePresence>
        {selectedDate && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#161b22] rounded-t-3xl p-6 z-[70] border-t border-tactical-gray max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-tactical-gray/50 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-display font-black mb-1 uppercase tracking-tight">
                Detalhes do Dia
              </h3>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              
              <div className="space-y-6">
                {/* Shift Type */}
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">Tipo de Serviço</p>
                  <div className="space-y-2">
                    {[
                        { id: 'ORDINARIO', label: 'PLANTÃO 24H (ESCALA)', icon: Shield, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent-soft)]', border: 'border-[var(--accent-soft)]' },
                        { id: 'EXTRA_DIURNA', label: 'EXTRA DIURNA', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                        { id: 'EXTRA_NOTURNA', label: 'EXTRA NOTURNA', icon: DollarSign, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
                      ].map((item) => {
                      const key = format(selectedDate, 'yyyy-MM-dd');
                      const currentType = dayData[key]?.type || overrides[key] || getBaseShift(selectedDate);
                      const isActive = currentType === item.id;
                      
                      return (
                        <button 
                          key={item.id}
                          onClick={() => updateShift(item.id as ShiftType)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                            isActive ? `${item.bg} ${item.border} ${item.color}` : "bg-tactical-gray/10 border-transparent text-gray-400"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon size={20} />
                            <span className="text-xs font-bold">{item.label}</span>
                          </div>
                          {isActive && (
                            <span className={cn(
                              "text-[8px] font-black px-2 py-0.5 rounded uppercase",
                              item.id === 'ORDINARIO' && "bg-[var(--accent-soft)] text-[var(--accent)]",
                              item.id === 'EXTRA_DIURNA' && "bg-emerald-500/20 text-emerald-400",
                              item.id === 'EXTRA_NOTURNA' && "bg-indigo-500/20 text-indigo-400",
                            )}>Ativo</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quarters Selection */}
                <AlarmManager 
                  compact
                  selectedQuarters={editQuarters}
                  onToggleQuarter={(id) => {
                    setEditQuarters(prev => 
                      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
                    );
                  }}
                  customAlarms={customAlarms}
                  onUpdateAlarm={handleUpdateAlarm}
                  onResetAlarms={handleResetAlarms}
                />

                {/* Permuta */}
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">Permuta de Plantão</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { id: 'PASSAR_PLANTAO', label: 'Passar Plantão' },
                      { id: 'ASSUMIR_PLANTAO', label: 'Assumir Plantão' },
                    ].map(item => {
                      const key = format(selectedDate, 'yyyy-MM-dd');
                      const currentType = dayData[key]?.type || overrides[key];
                      const isActive = currentType === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => updateShift(item.id as ShiftType)}
                          className={cn(
                            "p-3 text-xs font-bold rounded-xl border transition-all",
                            isActive 
                              ? "bg-amber-500/10 border-amber-500/50 text-amber-400" 
                              : "bg-tactical-gray/10 border-transparent text-gray-400"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  
                  {(dayData[format(selectedDate, 'yyyy-MM-dd')]?.type === 'PASSAR_PLANTAO' || 
                    dayData[format(selectedDate, 'yyyy-MM-dd')]?.type === 'ASSUMIR_PLANTAO' ||
                    editSwapWith) && (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-500/50">PP</div>
                      <input
                        type="text"
                        value={editSwapWith}
                        onChange={(e) => setEditSwapWith(e.target.value)}
                        placeholder="Nome do Policial Penal..."
                        className="w-full bg-amber-500/5 border border-transparent focus:border-amber-500/30 rounded-xl p-3 pl-10 text-xs text-white placeholder:text-gray-600 outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Occurrence Book */}
                <OccurrenceBook 
                  occurrences={editOccurrences}
                  onAdd={(occ) => setEditOccurrences(prev => [...prev, { ...occ, id: Date.now().toString() }])}
                  onDelete={(id) => setEditOccurrences(prev => prev.filter(o => o.id !== id))}
                />

                {/* Observation */}
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">Observações Táticas</p>
                  <div className="relative">
                    <MessageSquare size={14} className="absolute left-3 top-3 text-gray-500" />
                    <textarea
                      value={editObservation}
                      onChange={(e) => setEditObservation(e.target.value)}
                      placeholder="Ex: Troca de posto, ocorrência relevante..."
                      className="w-full bg-tactical-gray/10 border border-transparent focus:border-[var(--accent)]/50 rounded-xl p-3 pl-10 text-xs text-white placeholder:text-gray-600 outline-none min-h-[100px] transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => updateShift('FOLGA')}
                    className="flex-1 p-4 bg-tactical-gray/20 hover:bg-tactical-gray/30 rounded-2xl text-sm font-bold transition-all"
                  >
                    Limpar
                  </button>
                  <button 
                    onClick={() => {
                      const key = format(selectedDate, 'yyyy-MM-dd');
                      const existing = dayData[key];
                      const currentType = existing?.type || overrides[key] || getBaseShift(selectedDate);
                      updateShift(currentType);
                    }}
                    className="flex-[2] p-4 bg-[var(--accent)] hover:opacity-90 rounded-2xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all uppercase tracking-widest text-white"
                  >
                    Confirmar Alterações
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {/* Alvorada Modal */}
      <AlvoradaModal 
        isOpen={isAlvoradaActive} 
        onConfirm={() => {
          setIsAlvoradaActive(false);
          if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
          }
        }} 
        time={customAlarms.find(a => a.id === 'ALVORADA')?.time || QUARTERS.find(q => q.id === 'ALVORADA')?.alarm}
      />
    </main>
  );
}
