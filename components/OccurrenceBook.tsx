'use client';

import React, { useState } from 'react';
import { Book, Plus, Trash2, Clock, ShieldCheck, AlertCircle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Occurrence } from '@/lib/db-service';

interface OccurrenceBookProps {
  occurrences: Occurrence[];
  onAdd: (occ: Omit<Occurrence, 'id'>) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export default function OccurrenceBook({ occurrences, onAdd, onDelete, readOnly }: OccurrenceBookProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({
      time: format(new Date(), 'HH:mm'),
      title: newTitle,
      description: newDesc,
    });
    setNewTitle('');
    setNewDesc('');
    setIsAdding(false);
  };

  return (
    <div className={cn("space-y-4", !readOnly && "tactical-card p-6")}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 whitespace-nowrap">
          <Book size={16} className="text-blue-500" />
          Livro de Ocorrências
        </h3>
        {!readOnly && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all"
          >
            {isAdding ? <Trash2 size={14} /> : <Plus size={14} />}
          </button>
        )}
      </div>

      {!readOnly && isAdding && (
        <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5 mb-6 animate-in fade-in slide-in-from-top-2">
          <input 
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título da Ocorrência..."
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
          />
          <textarea 
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descrição detalhada..."
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 min-h-[80px]"
          />
          <button 
            onClick={handleAdd}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
          >
            Registrar Alteração
          </button>
        </div>
      )}

      <div className="space-y-3">
        {occurrences.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
            <MessageSquare size={24} className="text-gray-700 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Sem registros operacionais</p>
          </div>
        ) : (
          occurrences.map((occ) => (
            <div 
              key={occ.id}
              className="group relative p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-[10px] font-black text-blue-500 leading-none">{occ.time}</span>
                  <div className="w-px h-4 bg-white/10" />
                  <ShieldCheck size={12} className="text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-200 mb-1 uppercase tracking-tight">{occ.title}</h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed italic">&quot;{occ.description}&quot;</p>
                </div>
                {!readOnly && (
                  <button 
                    onClick={() => onDelete(occ.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
