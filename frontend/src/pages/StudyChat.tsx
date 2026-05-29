import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { queryApi, ApiError } from '../lib/api';
import type { DocRecord } from '../lib/useAppState';
import ReactMarkdown from 'react-markdown';

interface StudyChatProps {
  activeDoc: DocRecord | null;
  email: string | null;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export default function StudyChat({ activeDoc, email }: StudyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userInitial = email ? email.charAt(0).toUpperCase() : '?';

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      return;
    }

    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    if (!chatEndRef.current && !chatContainerRef.current) return;

    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isGenerating]);

  useEffect(() => {
    setMessages([]);
    setInput('');
    setError(null);
  }, [activeDoc?.doc_id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleSend = async () => {
    const query = input.trim();
    if (!query || !activeDoc || isGenerating) return;

    setInput('');
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setIsGenerating(true);

    window.requestAnimationFrame(scrollToBottom);

    try {
      const result = await queryApi.send(query, activeDoc.doc_id);

      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: result.answer },
      ]);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : 'Failed to get response. Please try again.';
      setError(message);
    } finally {
      setIsGenerating(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-8">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
          <Sparkles size={32} className="text-accent-primary" strokeWidth={2} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">No Document Selected</h2>
        <p className="text-gray-400 max-w-md text-sm leading-relaxed">
          Upload a PDF from the Library or Sidebar, then come back here to start a conversation with your study material.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen relative">
      <header className="h-16 border-b border-white/5 bg-graphite-dark/30 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate max-w-[60vw] sm:max-w-sm">{activeDoc.file_name}</h2>
        </div>
      </header>

      <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar pb-52 sm:pb-56">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12">
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sparkles size={28} className="text-accent-primary/40 mb-4" strokeWidth={2} />
              <p className="text-gray-400 text-sm font-medium">Ask anything about <span className="text-accent-primary">{activeDoc.file_name}</span></p>
              <p className="text-gray-500 text-[13px] mt-2">Chat history isn't saved.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3 sm:gap-6",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                msg.role === 'ai'
                  ? "bg-accent-primary/10 border-accent-primary/20 text-accent-primary"
                  : "bg-white/5 border-white/10 text-gray-400"
              )}>
                {msg.role === 'ai' ? (
                  <Sparkles size={20} strokeWidth={2.5} />
                ) : (
                  <span className="text-sm font-bold">{userInitial}</span>
                )}
              </div>

              <div className={cn(
                "max-w-[85%] sm:max-w-[80%] space-y-3",
                msg.role === 'user' ? "items-end flex flex-col" : "items-start flex flex-col"
              )}>
                <div className={cn(
                  "p-4 sm:p-6 rounded-3xl text-sm sm:text-[15px] leading-relaxed",
                  msg.role === 'ai'
                    ? "glass-card rounded-tl-sm text-gray-200"
                    : "bg-accent-primary text-white rounded-tr-sm shadow-xl"
                )}>
                  {msg.role === 'ai' ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 sm:gap-6"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-accent-primary/10 border-accent-primary/20 text-accent-primary">
                <Sparkles size={20} strokeWidth={2.5} />
              </div>
              <div className="glass-card rounded-3xl rounded-tl-sm p-4 sm:p-6 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-accent-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-accent-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-accent-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <div className="px-5 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {error}
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 sm:p-8 bg-linear-to-t from-graphite-dark via-graphite-dark/90 to-transparent">
        <div className="max-w-4xl mx-auto relative group">
          <div className="glass-card p-2 pl-3 sm:pl-4 flex items-center gap-2 focus-within:border-accent-primary transition-all ring-offset-graphite-dark focus-within:ring-4 focus-within:ring-accent-primary/10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none focus:ring-0 py-3 max-h-30 min-h-12.5 resize-none text-white text-sm sm:text-[16px] placeholder-gray-400 outline-none"
              placeholder="Ask anything about the workspace..."
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              aria-label="Send message"
              title="Send message"
              className={cn(
                "group/send mr-1 flex h-12 w-16 shrink-0 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 sm:h-14 sm:w-20",
                input.trim() && !isGenerating
                  ? "border-accent-primary/40 bg-accent-primary text-white hover:brightness-110"
                  : "border-white/10 bg-white/5 text-gray-500",
                "disabled:cursor-not-allowed"
              )}
            >
              <SendHorizontal
                size={22}
                strokeWidth={2.5}
                className="transition-transform duration-300 group-hover/send:translate-x-0.5"
              />
            </button>
          </div>
          <p className="text-center mt-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            *Responses are generated strictly based on the uploaded document.
          </p>
        </div>
      </div>
    </div>
  );
}
