'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, VolumeX, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface AlvoradaModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  time?: string;
}

export default function AlvoradaModal({ isOpen, onConfirm, time = '06:00' }: AlvoradaModalProps) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Emergency sound - Combat Alarm
      const audioUrl = 'https://assets.mixkit.co/active_storage/sfx/997/997-preview.mp3';
      audioRef.current = new Audio(audioUrl);
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0;
      
      const playAudio = async () => {
        try {
          if (audioRef.current) {
            await audioRef.current.play();
          }
        } catch (e: unknown) {
          console.warn('Audio play blocked or failed:', e);
        }
      };

      playAudio();
      
      if ('vibrate' in navigator) {
        // Continuous vibration pattern
        navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isOpen]);

  const startHold = () => {
    setIsHolding(true);
    const startTime = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 3000) * 100, 100);
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
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 overflow-hidden"
        >
          {/* Background Pulse */}
          <div className="absolute inset-0 bg-red-600/10 animate-pulse pointer-events-none" />
          
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="relative z-10 flex flex-col items-center text-center max-w-xs w-full"
          >
            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-bounce">
              <ShieldAlert size={48} className="text-white" />
            </div>

            <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-2">ALVORADA</h2>
            <div className="flex items-center gap-2 text-red-500 mb-12">
              <AlertTriangle size={16} />
              <span className="text-sm font-black uppercase tracking-[0.2em]">Protocolo {time} Ativado</span>
            </div>

            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-16 leading-relaxed">
              Atenção Operador! <br />
              Confirme seu estado de alerta para desativar o protocolo.
            </p>

            <div className="relative w-full">
              <button
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={startHold}
                onTouchEnd={stopHold}
                className={cn(
                  "w-full py-6 rounded-2xl text-lg font-black uppercase tracking-widest transition-all relative overflow-hidden",
                  isHolding ? "bg-zinc-900 scale-95" : "bg-white text-black hover:bg-gray-200"
                )}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {isHolding ? 'Confirmando...' : 'Confirmar Acordado'}
                  <VolumeX size={20} />
                </span>
                
                {/* Progress Bar */}
                <div 
                  className="absolute bottom-0 left-0 h-full bg-blue-600 transition-all duration-75 ease-linear pointer-events-none opacity-40"
                  style={{ width: `${holdProgress}%` }}
                />
              </button>
              
              <p className="mt-4 text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">
                Pressione por 3 segundos
              </p>
            </div>
          </motion.div>

          {/* Decorative Elements */}
          <div className="absolute bottom-10 left-0 w-full text-center opacity-5 pointer-events-none">
            <p className="text-[15vw] font-black leading-none uppercase select-none">TÁTICO</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
