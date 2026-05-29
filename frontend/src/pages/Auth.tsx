import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AuthState } from '../lib/useAuth';

export default function Auth({ auth }: { auth: AuthState }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    auth.clearError();

    try {
      if (isLogin) {
        await auth.login(email, password);
      } else {
        await auth.signup(email, password);
      }
    } catch {

    }
  };

  const handleModeSwitch = (loginMode: boolean) => {
    setIsLogin(loginMode);
    auth.clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-graphite-dark">
      <div className="absolute top-[-20%] left-[-10%] w-150 h-150 bg-orange-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-150 h-150 bg-orange-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card p-10 relative z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">DocSync</h1>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Academic Workspace</p>
        </div>

        <div className="flex bg-white/5 p-1.5 rounded-2xl mb-10 relative">
          <button
            onClick={() => handleModeSwitch(true)}
            className="flex-1 py-2.5 text-xs font-bold rounded-xl relative z-10 transition-colors duration-200"
            style={{ color: isLogin ? '#fff' : '#6b7280' }}
          >
            SIGN IN
            {isLogin && (
              <motion.div
                layoutId="auth-tab-indicator"
                className="absolute inset-0 glass-card bg-graphite-surface shadow-xl rounded-xl"
                style={{ zIndex: -1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => handleModeSwitch(false)}
            className="flex-1 py-2.5 text-xs font-bold rounded-xl relative z-10 transition-colors duration-200"
            style={{ color: !isLogin ? '#fff' : '#6b7280' }}
          >
            SIGN UP
            {!isLogin && (
              <motion.div
                layoutId="auth-tab-indicator"
                className="absolute inset-0 glass-card bg-graphite-surface shadow-xl rounded-xl"
                style={{ zIndex: -1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? 'login' : 'signup'}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative group">
                <input
                  type="email"
                  className="input-field"
                  placeholder="scholar@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={auth.isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Password</label>
              </div>
              <div className="relative group">
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={auth.isLoading}
                />
              </div>
            </div>

            {auth.error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold text-center"
              >
                {auth.error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={auth.isLoading}
              className="w-full btn-primary py-4 mt-4 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {auth.isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-xs uppercase tracking-widest">{isLogin ? 'Enter Workspace' : 'Initialize Account'}</span>
                  <ArrowRight size={18} strokeWidth={3} />
                </>
              )}
            </button>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
