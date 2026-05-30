import React from 'react';
import Sidebar from './components/Sidebar';
import Auth from './pages/Auth';
import Library from './pages/Library';
import StudyChat from './pages/StudyChat';
import QuizLab from './pages/QuizLab';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from './lib/useAuth';
import { useAppState } from './lib/useAppState';
import { authApi, ApiError } from './lib/api';
import { Trash2, Menu } from 'lucide-react';

export default function App() {
  const auth = useAuth();
  const appState = useAppState(auth.isAuthenticated);
  const [activeTab, setActiveTab] = React.useState('library');
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  if (auth.isLoading && !auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-graphite-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Auth auth={auth} />;
  }

  const handleLogout = () => {
    auth.logout();
    appState.resetState();
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await authApi.deleteAccount();
      localStorage.clear();
      appState.resetState();
      auth.logout();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : 'Failed to delete account. Please try again.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-graphite-dark flex overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        email={auth.email}
        appState={appState}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden w-10 h-10 rounded-xl bg-graphite-surface/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-95"
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={2.5} />
      </button>

      <main className="flex-1 lg:ml-64 min-h-screen overflow-y-auto custom-scrollbar relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'library' && (
              <Library
                appState={appState}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'chat' && (
              <StudyChat activeDoc={appState.activeDoc} email={auth.email} />
            )}
            {activeTab === 'quiz' && (
              <QuizLab activeDoc={appState.activeDoc} />
            )}
            {activeTab === 'settings' && (
              <div className="p-8 sm:p-12 flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                  <span className="text-4xl">⚙️</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Workspace Settings</h2>
                <p className="text-gray-400 max-w-sm">Manage your account, appearance, and integration preferences here.</p>
                <button
                  onClick={handleLogout}
                  className="mt-8 text-rose-500 font-bold hover:underline"
                >
                  Sign Out of DocSync
                </button>

                <div className="mt-12 pt-8 border-t border-white/5 w-full max-w-sm">
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
                      className="flex items-center justify-center gap-2 mx-auto text-gray-500 hover:text-rose-400 text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                      <span>Delete Account</span>
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-6 border border-rose-500/20"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                          <Trash2 size={18} className="text-rose-400" strokeWidth={2.5} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-white">Delete your account?</p>
                          <p className="text-[10px] text-gray-500 font-medium">This will permanently delete all your documents, quiz data, chat history, and account information. This action cannot be undone.</p>
                        </div>
                      </div>

                      {deleteError && (
                        <p className="text-[10px] text-rose-400 font-semibold text-center mb-3">{deleteError}</p>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                          className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'Delete Forever'
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
