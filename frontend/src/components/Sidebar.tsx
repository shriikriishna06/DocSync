import React, { useRef, useState } from 'react';
import { Book, MessageSquareText, BrainCircuit, Settings, Upload, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { docApi, ApiError } from '../lib/api';
import type { AppState } from '../lib/useAppState';
import { motion, AnimatePresence } from 'motion/react';

const MAX_DOCUMENTS = 50;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  email: string | null;
  appState: AppState;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, email, appState, onLogout, isOpen, onClose }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const navItems = [
    { id: 'library', icon: Book, label: 'Library' },
    { id: 'chat', icon: MessageSquareText, label: 'Study Chat' },
    { id: 'quiz', icon: BrainCircuit, label: 'Quiz Lab' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const isAtCapacity = appState.documents.length >= MAX_DOCUMENTS;

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    onClose();
  };

  const handleUploadClick = () => {
    if (isAtCapacity) {
      setUploadError(`Document limit reached (${MAX_DOCUMENTS}). Delete a document to upload more.`);
      return;
    }
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await docApi.upload(file);

      appState.addDocument({
        doc_id: result.doc_id,
        file_name: result.file_name || file.name,
        topics: result.topics || [],
        uploaded_at: Date.now(),
        duplicate: result.duplicate,
      });

      appState.setActiveDoc({
        doc_id: result.doc_id,
        file_name: result.file_name || file.name,
        topics: result.topics || [],
        uploaded_at: Date.now(),
        duplicate: result.duplicate,
      });

      setActiveTab('chat');
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : 'Upload failed. Please try again.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <nav className={cn(
        "fixed left-0 top-0 h-full w-64 glass-card border-r border-white/5 flex flex-col p-6 z-50 transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mb-10 px-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">DocSync</h1>
          <p className="text-[10px] text-accent-primary font-bold tracking-widest uppercase mt-1">Academic Workspace</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={handleFileSelected}
        />

        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className={cn(
            "btn-primary flex items-center justify-center gap-3 mb-2 disabled:opacity-50 disabled:cursor-not-allowed",
            isAtCapacity && !isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Processing...</span>
            </>
          ) : (
            <>
              <Upload size={18} strokeWidth={2.5} />
              <span className="text-sm">Upload PDF</span>
            </>
          )}
        </button>

        {uploadError && (
          <p className="text-[10px] text-rose-400 font-semibold text-center mb-4 px-2">
            {uploadError}
          </p>
        )}

        {!uploadError && <div className="mb-6" />}

        <div className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group",
                activeTab === item.id
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="pt-6 border-t border-white/5 relative">
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-3 px-2 w-full text-left hover:bg-white/5 rounded-2xl py-2 transition-all"
          >
            <div className="w-10 h-10 rounded-full border border-white/10 bg-accent-primary/10 flex items-center justify-center text-accent-primary font-bold text-sm shrink-0">
              {email ? email.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{email || 'User'}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active</p>
            </div>
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-2 right-2 mb-2 glass-modal p-2"
              >
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <LogOut size={16} strokeWidth={2.5} />
                  <span className="font-semibold text-sm">Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </>
  );
}
