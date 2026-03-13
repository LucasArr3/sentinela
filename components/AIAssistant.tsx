'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ShieldAlert, BookOpen, Trash2, Paperclip, Mic, X, FileText, Clock, Radio, StopCircle, Volume2, Waves, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { GoogleGenAI, Part, Modality, LiveServerMessage } from "@google/genai";

type LiveSessionType = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>>;
import { cn } from '@/lib/utils';
import Markdown from 'react-markdown';
import { ShiftType, SHIFT_LABELS, getBaseShift } from '@/lib/scale-utils';
import { DayData } from '@/lib/db-service';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface AIAssistantProps {
  dayData: Record<string, DayData>;
  overrides: Record<string, ShiftType>;
  extraValue: number;
}

interface Attachment {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'audio' | 'other';
}

export default function AIAssistant({ dayData, extraValue }: AIAssistantProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, attachments?: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [commandHistory, setCommandHistory] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveSessionRef = useRef<LiveSessionType | null>(null);

  // Load command history for learning
  useEffect(() => {
    const saved = localStorage.getItem('sentinela_ai_commands');
    if (saved) {
      try {
        setCommandHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar histórico de comandos", e);
      }
    }
  }, []);

  const trackCommand = (cmd: string) => {
    const newHistory = { ...commandHistory, [cmd]: (commandHistory[cmd] || 0) + 1 };
    setCommandHistory(newHistory);
    localStorage.setItem('sentinela_ai_commands', JSON.stringify(newHistory));
  };

  // Stats for suggestions
  const stats = useCallback(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthName = format(now, 'MMMM', { locale: ptBR }).toUpperCase();
    
    let extras = 0;
    let shifts = 0;
    Object.entries(dayData).forEach(([key, data]) => {
      const d = new Date(key);
      if (d.getMonth() === month && d.getFullYear() === year) {
        if (data.type === 'ORDINARIO') shifts++;
        if (data.type.startsWith('EXTRA')) extras++;
      }
    });
    return { shifts, extras, monthName, year };
  }, [dayData])();

  const getDynamicSuggestions = () => {
    const baseSuggestions = [
      { id: 'escala', label: `Escala ${stats.monthName}/${stats.year}`, prompt: `Qual minha escala de plantão para ${stats.monthName}/${stats.year}?` },
      { id: 'extras', label: `Extras ${stats.monthName}/${stats.year}`, prompt: `Quantas extras e qual o valor previsto para ${stats.monthName}/${stats.year}?` },
      { id: 'protocolos', label: "Protocolos", prompt: "Quais os protocolos de segurança para muralha e escolta?" },
      { id: 'ocorrencias', label: "Ocorrências", prompt: "Resumo de ocorrências do último plantão." },
    ];

    // Sort by frequency
    return baseSuggestions.sort((a, b) => (commandHistory[a.id] || 0) > (commandHistory[b.id] || 0) ? -1 : 1);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const newAttachment: Attachment = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: '',
          type: 'audio'
        };
        setAttachments(prev => [...prev, newAttachment]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Live Mode Logic (Simplified implementation for the UI)
  const toggleLiveMode = async () => {
    if (isLiveMode) {
      if (liveSessionRef.current) {
        liveSessionRef.current.close();
      }
      setIsLiveMode(false);
      setLiveStatus('idle');
      return;
    }

    setIsLiveMode(true);
    setLiveStatus('connecting');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Você é o Sentinela-IA em modo Live. Fale de forma concisa, tática e use Código Q. Refira-se ao usuário como Stive. Ajude-o em tempo real.",
        },
        callbacks: {
          onopen: () => setLiveStatus('active'),
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              // Play audio logic would go here
              console.log("Audio received from Live API");
            }
          },
          onclose: () => {
            setIsLiveMode(false);
            setLiveStatus('idle');
          }
        }
      });
      liveSessionRef.current = session;
    } catch (err: unknown) {
      console.error("Live Mode Error:", err);
      setIsLiveMode(false);
      setLiveStatus('idle');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'other'
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMsg = input;
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMsg, 
      attachments: currentAttachments.map(a => a.preview || a.file.name) 
    }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      const model = "gemini-3-flash-preview";
      
      // Generate automatic base scale context for a wider range (-180 to +365 days)
      const now = new Date();
      const baseScaleDates: string[] = [];
      for (let i = -180; i <= 365; i++) {
        const d = addDays(now, i);
        if (getBaseShift(d) === 'ORDINARIO') {
          baseScaleDates.push(format(d, 'dd/MM/yyyy'));
        }
      }

      // Prepare context about the user's manual overrides and data
      const manualContext = Object.entries(dayData).map(([date, data]) => {
        const occurrences = data.occurrences?.map(o => `[${o.time}] ${o.title}: ${o.description}`).join('; ') || 'Sem ocorrências';
        return `${date}: ${SHIFT_LABELS[data.type]} | Obs: ${data.observation || 'N/A'} | Ocorrências: ${occurrences}`;
      }).join('\n');

      const parts: Part[] = [
        { text: `Você é o Sentinela-IA, um assistente tático avançado (Agente) para Policiais Penais. 
        
        DIRETRIZES DE COMUNICAÇÃO:
        1. Refira-se ao usuário sempre como "Stive".
        2. Utilize o Código Q (Quebec) em sua fala de forma natural e tática (ex: QAP, QSL, QRV, TKS, QTI, etc).
        3. Mantenha um tom profissional, direto, tático e altamente respeitoso.
        4. Você tem acesso total à escala e aos registros do operador.
        
        LÓGICA DE ESCALA 24x72 (CICLO INFINITO):
        - Data Base: 31/03/2023 (Plantão Ordinário).
        - Ciclo: 1 dia de Plantão (24h) seguido de 3 dias de Folga (72h).
        - Datas de Plantão Ordinário Calculadas (USE ESTA LISTA COMO VERDADE ABSOLUTA): ${baseScaleDates.join(', ')}
        
        CONTEXTO OPERACIONAL DO STIVE (HOJE É ${format(new Date(), 'dd/MM/yyyy')}):
        Alterações Manuais e Ocorrências:
        ${manualContext || 'Nenhuma alteração manual registrada.'}
        
        Valor da Hora Extra: R$ ${extraValue}
        
        Pergunta/Comando do Stive: ${userMsg}` }
      ];

      // Add multimodal parts
      for (const attachment of currentAttachments) {
        const base64Data = await fileToBase64(attachment.file);
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: attachment.file.type
          }
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: `Você é o Agente de Inteligência Sentinela-IA. Sua missão é fornecer resumos operacionais ultra-rápidos para o Stive.

ESTILO DE RESPOSTA (OBRIGATÓRIO):
1. Saudação inicial: "QAP, Stive." seguido de DUAS quebras de linha.
2. Título: **NOME DO MÊS/ANO EM MAIÚSCULAS** em negrito (ex: **ESCALA DE MARÇO/2026**) seguido de DUAS quebras de linha.
3. Corpo: **Categoria:** (em negrito) seguido dos dias separados por vírgula.
   - Exemplo: **Plantões:** 03, 07, 11, 15, 19, 23, 27, 31
4. Use uma quebra de linha entre diferentes categorias (ex: entre Plantões e Extras).
5. Encerramento: "QRV." precedido de DUAS quebras de linha.

REGRAS OPERACIONAIS:
1. FOCO TOTAL: Responda apenas o que foi perguntado. Se pediu escala, não mostre extras.
2. CÓDIGO Q: Use Código Q apenas conforme o estilo acima.
3. SEM TABELAS: Use apenas texto puro formatado com Markdown.
4. VERIFICAÇÃO: Use a lista de "LÓGICA DE ESCALA" fornecida no contexto como única fonte de verdade para plantões ordinários.
5. PERSONA: Trate o usuário como Stive. Seja seco, direto e profissional.
6. MODO OFFLINE: Se o Stive perguntar sobre o modo offline, informe que o app agora é um PWA (Progressive Web App) e funciona 100% sem internet para calendário, alarmes e registros. Apenas a IA e o backup na nuvem precisam de conexão.
7. ALARMES FECHADOS: Se o Stive perguntar sobre alarmes com o app fechado, explique que devido a restrições dos sistemas (Android/iOS), a forma MAIS SEGURA e 100% GARANTIDA é usar o botão "Sincronizar Calendário" no Painel. Isso exporta sua escala e todos os alarmes de quartos para o calendário nativo do seu celular. O calendário do sistema tem permissão para tocar o alarme mesmo com o celular bloqueado ou app fechado.
8. TELA ATIVA: Se o Stive precisar que a tela não apague durante o plantão, informe que existe a opção "Manter Tela Ativa" na aba de Ajustes.
9. PLAY STORE: Se o Stive perguntar sobre publicar na Play Store, explique que o app está pronto para ser convertido em um App Nativo via TWA (Trusted Web Activity). QSL?`
        }
      });

      const aiContent = response.text || "Sem resposta do comando central. QSL?";
      setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "NEGATIVO, Stive. Erro de conexão no canal de rádio. Verifique sua chave de API ou sinal de rede. QAP?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Deseja limpar o histórico do chat tático?')) {
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] sm:h-[750px] overflow-hidden relative bg-[#0D1117] border border-white/5 rounded-3xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.1)]">
      {/* Live Mode Overlay */}
      <AnimatePresence>
        {isLiveMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0D1117]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
              <div className="absolute -inset-16 bg-blue-600/10 blur-[100px] rounded-full animate-pulse"></div>
              <div className="relative w-24 h-24 rounded-full border border-blue-500/20 flex items-center justify-center">
                <div className="absolute inset-0 border-t border-blue-500 rounded-full animate-spin"></div>
                <Waves className="w-8 h-8 text-blue-500 animate-pulse" />
              </div>
            </div>
            
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1">MODO LIVE</h3>
            <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.4em] mb-12 opacity-60">
              {liveStatus === 'connecting' ? 'Sincronizando Canal...' : 'QAP STIVE - ESCUTA ATIVA'}
            </p>
            
            <button 
              onClick={toggleLiveMode}
              className="px-10 py-4 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/30 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all active:scale-95"
            >
              <StopCircle size={16} />
              ENCERRAR CANAL
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[11px] font-black text-white uppercase tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis">
              SENTINELA-IA
            </h2>
            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[6px] font-black rounded border border-blue-500/20 whitespace-nowrap shrink-0">
              V3.6 ELITE
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden xs:flex items-center gap-1.5 mr-2">
            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[7px] font-bold text-emerald-500/60 uppercase tracking-widest whitespace-nowrap">QAP</span>
          </div>
          <button 
            onClick={toggleLiveMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-[8px] font-black text-blue-400 uppercase tracking-widest transition-all"
          >
            <Radio size={10} className="animate-pulse" />
            LIVE
          </button>
          <button 
            onClick={clearChat}
            className="p-1.5 text-gray-600 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-black/40"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-8 opacity-20">
            <ShieldAlert className="w-6 h-6 text-blue-500" />
            <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.4em] leading-relaxed max-w-[180px]">
              CANAL SEGURO QAP
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={cn(
            "flex flex-col max-w-[90%]",
            msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
          )}>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed shadow-xl",
              msg.role === 'user' 
                ? "bg-blue-600 text-white rounded-tr-none" 
                : "bg-zinc-900 border border-white/5 text-gray-200 rounded-tl-none"
            )}>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.attachments.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                      {url.startsWith('blob:') || url.startsWith('data:') ? (
                        <Image 
                          src={url} 
                          alt="attachment" 
                          width={200}
                          height={200}
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <FileText size={16} className="text-gray-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none">
                <Markdown>
                  {msg.content}
                </Markdown>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 px-1">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
                {msg.role === 'user' ? 'Stive' : 'Sentinela-IA'}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 text-gray-500 px-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Processando Canal de Rádio...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-zinc-900/50 backdrop-blur-md">
        {/* Horizontal Suggestions */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar">
          {getDynamicSuggestions().map((s) => (
            <button 
              key={s.id}
              onClick={() => {
                setInput(s.prompt);
                trackCommand(s.id);
              }}
              className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[9px] font-black text-gray-400 uppercase tracking-widest transition-all flex items-center gap-2"
            >
              {s.id === 'escala' && <Clock size={10} className="text-blue-500" />}
              {s.id === 'extras' && <TrendingUp size={10} className="text-emerald-500" />}
              {s.id === 'protocolos' && <ShieldAlert size={10} className="text-amber-500" />}
              {s.id === 'ocorrencias' && <BookOpen size={10} className="text-indigo-500" />}
              {s.label}
            </button>
          ))}
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {attachments.map(a => (
              <div key={a.id} className="relative group">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                  {a.type === 'image' ? (
                    <Image 
                      src={a.preview} 
                      alt="preview" 
                      width={48}
                      height={48}
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : a.type === 'audio' ? (
                    <div className="w-full h-full flex items-center justify-center bg-blue-500/10">
                      <Volume2 size={16} className="text-blue-500" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText size={16} className="text-gray-500" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => removeAttachment(a.id)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative group">
            <div className="absolute -inset-1 bg-blue-500/10 blur-xl rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="QAP Stive? Digite seu comando..."
              className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 outline-none transition-all relative z-10 resize-none max-h-32 min-h-[56px]"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1 z-20">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
              >
                <Paperclip size={18} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                multiple 
                accept="image/*,audio/*,application/pdf"
              />
            </div>
          </div>
          
          <button 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90",
              isRecording ? "bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)] text-white" : "bg-zinc-800 text-gray-400 hover:text-white"
            )}
          >
            {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
          </button>

          <button 
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
