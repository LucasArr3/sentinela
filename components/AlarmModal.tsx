'use client';

import React, { useState, useRef } from 'react';
import { Bell, VolumeX, ShieldAlert, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface AlarmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  title: string;
  time: string;
}

export default function AlarmModal({ isOpen, onConfirm, title, time }: AlarmModalProps) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    setIsHolding(true);
    const startTime = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 2000) * 100, 100); // 2 seconds for regular alarms
      setHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(holdTimerRef.current!);
        onConfirm();
      }
    }, 50);
  };

  const stopHold = () => {
    setIsHolding(false);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setHoldProgress(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 overflow-hidden"
        >
          {/* Background Pulse */}
          <div className="absolute inset-0 bg-blue-600/5 animate-pulse pointer-events-none" />
          
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="relative z-10 flex flex-col items-center text-center max-w-xs w-full"
          >
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)] animate-bounce">
              <Bell size={40} className="text-white" />
            </div>

            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">ALERTA DE QUARTO</h2>
            <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">{title}</p>
            
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 mb-12 w-full">
              <div className="flex items-center justify-center gap-3 text-gray-400 mb-2">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Horário de Rendição</span>
              </div>
              <p className="text-4xl font-black text-white tracking-tighter">{time}</p>
            </div>

            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-12 leading-relaxed">
              Atenção Operador! <br />
              Rendição em 15 minutos. <br />
              Confirme para silenciar o alarme.
            </p>

            <div className="relative w-full">
              <button
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={startHold}
                onTouchEnd={stopHold}
                className={cn(
                  "w-full py-5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all relative overflow-hidden",
                  isHolding ? "bg-zinc-900 scale-95" : "bg-white text-black hover:bg-gray-200"
                )}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {isHolding ? 'Silenciando...' : 'Silenciar Alarme'}
                  <VolumeX size={18} />
                </span>
                
                {/* Progress Bar */}
                <div 
                  className="absolute bottom-0 left-0 h-full bg-blue-600 transition-all duration-75 ease-linear pointer-events-none opacity-40"
                  style={{ width: `${holdProgress}%` }}
                />
              </button>
              
              <p className="mt-4 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                Pressione por 2 segundos
              </p>
            </div>
          </motion.div>

          {/* Decorative Elements */}
          <div className="absolute top-10 left-10 opacity-10">
            <ShieldAlert size={120} className="text-white" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
