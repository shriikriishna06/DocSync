import React, { useRef, useState } from 'react';
import { FileText, Clock, ChevronRight, Upload, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { docApi, ApiError } from '../lib/api';
import type { AppState, DocRecord } from '../lib/useAppState';
import { motion, AnimatePresence } from 'motion/react';

const MAX_DOCUMENTS = 50;

interface LibraryProps {
  appState: AppState;
  setActiveTab: (tab: string) => void;
}

function timeAgo(timestamp: number): string {
  if (timestamp === 0) {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Library({ appState, setActiveTab }: LibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAtCapacity = appState.documents.length >= MAX_DOCUMENTS;

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

      const doc: DocRecord = {
        doc_id: result.doc_id,
        file_name: result.file_name || file.name,
        topics: result.topics || [],
        uploaded_at: Date.now(),
        duplicate: result.duplicate,
      };

      appState.addDocument(doc);
      appState.setActiveDoc(doc);
      setActiveTab('chat');
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

  const handleDocClick = (doc: DocRecord) => {
    if (deleteConfirmId) return;
    appState.setActiveDoc(doc);
    setActiveTab('chat');
  };

  const handleDeleteClick = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(docId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    setIsDeleting(true);
    try {
      await docApi.deleteDocument(deleteConfirmId);
      appState.removeDocument(deleteConfirmId);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : 'Failed to delete document.';
      setUploadError(message);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteConfirmId(null);
  };

  return (
    <div className="p-4 sm:p-10">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex justify-between items-end mb-10 sm:mb-16">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Resource Archive</h2>
          <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
            Total Capacity: {appState.documents.length}/{MAX_DOCUMENTS} Units
          </p>
        </div>
      </div>

      {uploadError && (
        <div className="mb-8 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold text-center">
          {uploadError}
        </div>
      )}

      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => handleDeleteCancel()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal p-8 max-w-md w-full mx-4 border border-rose-500/20"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Trash2 size={22} className="text-rose-400" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete Document</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    This will permanently delete the document and all associated chunks stored in the database. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteCancel()}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Delete Forever'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {appState.documents.map((doc) => {
          const isActive = appState.activeDoc?.doc_id === doc.doc_id;

          return (
            <div
              key={doc.doc_id}
              onClick={() => handleDocClick(doc)}
              className={cn(
                "glass-card p-8 group cursor-pointer transition-all duration-300 hover:-translate-y-1 relative",
                isActive ? "border-accent-primary/50 bg-accent-primary/5" : "hover:border-white/20"
              )}
            >
              <button
                onClick={(e) => handleDeleteClick(e, doc.doc_id)}
                className="absolute top-4 right-4 p-2 rounded-xl text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete document"
              >
                <Trash2 size={14} strokeWidth={2.5} />
              </button>

              <div className="flex items-start justify-between mb-8">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                  isActive ? "bg-accent-primary/20 text-accent-primary" : "bg-white/5 text-gray-400 group-hover:text-white"
                )}>
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} strokeWidth={2.5} />
                  <span>{timeAgo(doc.uploaded_at)}</span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 leading-tight tracking-tight group-hover:text-accent-primary transition-all">
                {doc.file_name}
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                {doc.topics.length > 0
                  ? doc.topics.slice(0, 3).join(' · ')
                  : 'Processing...'}
              </p>

              <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all text-accent-primary font-bold text-[10px] tracking-widest uppercase">
                <span>Open Workspace</span>
                <ChevronRight size={16} strokeWidth={3} />
              </div>
            </div>
          );
        })}

        <div
          onClick={handleUploadClick}
          className={cn(
            "border border-dashed border-white/10 rounded-3xl bg-white/2 min-h-70 flex flex-col items-center justify-center p-8 text-center group hover:bg-accent-primary/5 hover:border-accent-primary/30 transition-all cursor-pointer",
            (isUploading || isAtCapacity) && "pointer-events-none opacity-50"
          )}
        >
          <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center mb-6 group-hover:border-accent-primary group-hover:text-accent-primary transition-all">
            {isUploading ? (
              <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={24} strokeWidth={2.5} />
            )}
          </div>
          <p className="font-bold text-white text-sm uppercase tracking-widest mb-2">
            {isUploading ? 'Processing Document...' : isAtCapacity ? 'Capacity Reached' : 'Add New Source'}
          </p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">PDF / DOCX (MAX 50MB)</p>
        </div>
      </div>
    </div>
  );
}
