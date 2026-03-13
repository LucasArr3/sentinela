'use client';

import React, { useState } from 'react';
import { 
  auth, 
  googleProvider 
} from '@/lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Shield, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { message?: string };
      setError('Erro ao entrar com Google: ' + (error.message || 'Erro desconhecido'));
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
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
      }
      onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0D1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-white/5 bg-white/5">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase">
                {mode === 'login' ? 'Acesso Operacional' : 'Registro de Operador'}
              </h2>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Sentinela Tático v1.0
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Agente Silva"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                    required={mode === 'register'}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail Funcional</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'ENTRAR NO SISTEMA' : 'FINALIZAR REGISTRO'}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="bg-[#0D1117] px-4 text-gray-600">Ou continue com</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white text-black hover:bg-gray-100 disabled:opacity-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            GOOGLE AUTH
          </button>

          <div className="text-center">
            <button 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
            >
              {mode === 'login' ? 'Não tem conta? Registre-se agora' : 'Já tem conta? Faça o login'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
