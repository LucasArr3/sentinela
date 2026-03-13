'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

import { UserPreferences } from '@/lib/db-service';

interface SettingsViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (newPrefs: Partial<UserPreferences>) => void;
}

export default function SettingsView({ prefs, onUpdatePrefs }: SettingsViewProps) {
  const handleLogout = () => {
    if (confirm('Deseja realmente sair da conta?')) {
      signOut(auth);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Configurações de Escala</h2>
        <div className="space-y-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <SettingsItem label="Data Base da Escala" value="31/03/2023" />
          <SettingsItem label="Ciclo de Plantão" value="24x72" />
          <div className="w-full flex justify-between items-center p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
            <span className="text-gray-300">Valor da Hora Extra</span>
            <div className="flex items-center gap-2">
              <span className="text-blue-500 font-medium">R$</span>
              <input 
                type="number" 
                value={prefs.extraValue} 
                onChange={(e) => onUpdatePrefs({ extraValue: Number(e.target.value) })}
                className="bg-transparent text-blue-500 font-medium w-20 text-right outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Alarmes e Notificações</h2>
        <div className="space-y-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <SettingsItem label="Protocolo Alvorada" value="Ativado (06:00)" />
          <SettingsItem label="Alarme T-15" value="Ativado" />
          <SettingsItem label="Som do Alarme" value="Sirene Tática" />
        </div>
      </section>

      <button 
        onClick={handleLogout}
        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 p-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all"
      >
        <LogOut className="w-5 h-5" />
        Sair da Conta
      </button>
    </div>
  );
}

function SettingsItem({ label, value }: { label: string, value: string }) {
  return (
    <button className="w-full flex justify-between items-center p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
      <span className="text-gray-300">{label}</span>
      <span className="text-blue-500 font-medium">{value}</span>
    </button>
  );
}
