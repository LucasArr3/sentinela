'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  ChevronRight, 
  Mail, 
  Lock, 
  User, 
  AlertCircle,
  Sparkles,
  Smartphone,
  Cloud,
  Clock
} from 'lucide-react';
import { 
  auth, 
  googleProvider 
} from '@/lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously
} from 'firebase/auth';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'landing'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      onLoginSuccess?.();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { message?: string };
      setError('Erro ao entrar com Google: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAnonymously(auth);
      onLoginSuccess?.();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/operation-not-allowed') {
        setError('O login anônimo não está ativado no Console do Firebase. Ative-o em Authentication > Sign-in method.');
      } else {
        setError('Erro ao entrar como convidado: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
      }
      onLoginSuccess?.();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { code?: string };
      let message = 'Erro na autenticação';
      if (error.code === 'auth/user-not-found') message = 'Usuário não encontrado.';
      if (error.code === 'auth/wrong-password') message = 'Senha incorreta.';
      if (error.code === 'auth/email-already-in-use') message = 'Este e-mail já está em uso.';
      if (error.code === 'auth/weak-password') message = 'A senha deve ter pelo menos 6 caracteres.';
      if (error.code === 'auth/invalid-email') message = 'E-mail inválido.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-[#0D1117] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-12 relative z-10"
        >
          {/* Logo Section */}
          <div className="text-center space-y-4">
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)] relative group"
            >
              <Shield size={48} className="text-white group-hover:scale-110 transition-transform" />
              <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-[10px] font-black px-2 py-1 rounded-lg border-2 border-[#0D1117] uppercase tracking-tighter">
                Tático
              </div>
            </motion.div>
            
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tighter uppercase italic">
                Sentinela<span className="text-blue-500">Tático</span>
              </h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.4em]">
                Gestão Operacional de Escalas
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Clock, label: 'Escala 24x72', desc: 'Ciclo Automático' },
              { icon: Sparkles, label: 'IA Tática', desc: 'Assistente Digital' },
              { icon: Cloud, label: 'Nuvem', desc: 'Backup Seguro' },
              { icon: Smartphone, label: 'PWA', desc: 'Acesso Offline' },
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2"
              >
                <f.icon size={18} className="text-blue-500" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-tight">{f.label}</p>
                  <p className="text-[8px] text-gray-500 font-bold uppercase">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button 
              onClick={() => setMode('login')}
              className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 group"
            >
              Iniciar Acesso Operacional
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button 
              onClick={handleAnonymousLogin}
              disabled={loading}
              className="w-full py-5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-white/10 transition-all active:scale-95"
            >
              {loading ? 'Processando...' : 'Acessar como Convidado'}
            </button>
          </div>

          <p className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            Exclusivo para Policiais Penais e Forças de Segurança
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-white flex flex-col items-center justify-center p-6 relative">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-xl shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setMode('landing')}
            className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Voltar
          </button>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield size={20} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {mode === 'login' ? 'Acesso ao Sistema' : 'Novo Registro'}
          </h2>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {mode === 'login' ? 'Insira suas credenciais táticas' : 'Crie sua conta operacional'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold"
          >
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-5">
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Agente Silva"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-blue-500/50 outline-none transition-all"
                  required={mode === 'register'}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-blue-500/50 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-blue-500/50 outline-none transition-all"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'ENTRAR' : 'REGISTRAR'}
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
            <span className="bg-[#161b22] px-4 text-gray-600">Ou</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-5 bg-white text-black hover:bg-gray-100 disabled:opacity-50 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google Auth
        </button>

        <div className="text-center">
          <button 
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
          >
            {mode === 'login' ? 'Não tem conta? Registre-se' : 'Já tem conta? Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
