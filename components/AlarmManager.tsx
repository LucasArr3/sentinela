'use client';

import React, { useState } from 'react';
import { Bell, Clock, Settings, RefreshCw, Volume2, ShieldAlert } from 'lucide-react';
import { QUARTERS, ALARM_SOUNDS } from '@/lib/scale-utils';
import { AlarmSettings } from '@/lib/db-service';
import { cn } from '@/lib/utils';

interface AlarmManagerProps {
  compact?: boolean;
  selectedQuarters: string[];
  onToggleQuarter: (id: string) => void;
  customAlarms: AlarmSettings[];
  onUpdateAlarm: (id: string, time: string, sound: string) => void;
  onResetAlarms: () => void;
}

export default function AlarmManager({ 
  compact, 
  selectedQuarters, 
  onToggleQuarter, 
  customAlarms,
  onUpdateAlarm,
  onResetAlarms
}: AlarmManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className={cn("space-y-4", !compact && "tactical-card p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
            <Bell size={16} className="text-[var(--accent)]" />
            Gestão de Alarmes
          </h3>
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Quartos e Alvorada</p>
        </div>
        {!compact && (
          <button 
            onClick={onResetAlarms}
            className="p-2 text-gray-500 hover:text-[var(--accent)] transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {QUARTERS.map((q) => {
          const isSelected = selectedQuarters.includes(q.id);
          const custom = customAlarms.find(a => a.id === q.id);
          const time = custom?.time || q.alarm;
          const soundId = custom?.sound || q.sound;
          const sound = ALARM_SOUNDS.find(s => s.id === soundId);

          return (
            <div 
              key={q.id}
              className={cn(
                "p-3 rounded-xl border transition-all",
                isSelected ? "bg-[var(--accent-soft)] border-[var(--accent-soft)]" : "bg-tactical-gray/10 border-transparent"
              )}
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => onToggleQuarter(q.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    isSelected ? "bg-[var(--accent)] text-white" : "bg-tactical-gray/20 text-gray-500"
                  )}>
                    {q.id === 'ALVORADA' ? <ShieldAlert size={16} /> : <Clock size={16} />}
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold", isSelected ? "text-white" : "text-gray-400")}>{q.label}</p>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      {time} • {sound?.name}
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => setEditingId(editingId === q.id ? null : q.id)}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                >
                  <Settings size={14} />
                </button>
              </div>

              {editingId === q.id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Horário</label>
                      <input 
                        type="time" 
                        value={time}
                        onChange={(e) => onUpdateAlarm(q.id, e.target.value, soundId)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Som</label>
                      <select 
                        value={soundId}
                        onChange={(e) => onUpdateAlarm(q.id, time, e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-[var(--accent)]"
                      >
                        {ALARM_SOUNDS.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      if (sound?.url) {
                        console.log('Testando som:', sound.name, sound.url);
                        const audio = new Audio();
                        audio.src = sound.url;
                        audio.volume = 1.0;
                        audio.play()
                          .then(() => {
                            console.log('Reprodução iniciada com sucesso');
                            setTimeout(() => {
                              audio.pause();
                              audio.src = '';
                            }, 5000);
                          })
                          .catch(err => {
                            console.error('Erro ao reproduzir áudio:', err);
                            alert('Erro ao reproduzir som. Verifique se o volume está alto ou se o navegador bloqueou o áudio.');
                          });
                      }
                    }}
                    className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Volume2 size={12} /> Testar Som
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
          <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[9px] text-amber-500/80 font-bold leading-relaxed uppercase tracking-tight">
              Os alarmes disparam 15 minutos antes do início do quarto (T-15) para garantir o tempo de deslocamento e rendição.
            </p>
            <p className="text-[8px] text-amber-500/60 font-black uppercase tracking-widest">
              DICA: Use &quot;Sincronizar Calendário&quot; no Painel para alarmes 100% garantidos com o app fechado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
