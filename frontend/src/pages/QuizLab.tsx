import React, { useState, useMemo } from 'react';
import { Trophy, Check, X, Lightbulb, Zap, Sparkles, Search, RotateCcw, ExternalLink, ArrowLeft } from 'lucide-react';
import { FaYoutube } from 'react-icons/fa';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { quizApi, videoApi, ApiError } from '../lib/api';
import type { DocRecord } from '../lib/useAppState';
import type { TopicVideos } from '../lib/api';

interface QuizLabProps {
  activeDoc: DocRecord | null;
}

interface QuizQuestion {
  question: string;
  options: Record<string, string>;
  answer: string;
}

export default function QuizLab({ activeDoc }: QuizLabProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [quizComplete, setQuizComplete] = useState(false);
  const [showVideos, setShowVideos] = useState(false);
  const [videoResults, setVideoResults] = useState<TopicVideos[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const question = questions[currentIndex] || null;
  const isLastQuestion = currentIndex === questions.length - 1;
  const allTopics = activeDoc?.topics || [];

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return allTopics;
    const q = topicSearch.toLowerCase();
    return allTopics.filter((t) => t.toLowerCase().includes(q));
  }, [allTopics, topicSearch]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  const selectAllTopics = () => {
    setSelectedTopics((prev) => {
      const set = new Set(prev);
      filteredTopics.forEach((t) => set.add(t));
      return Array.from(set);
    });
  };

  const deselectAllTopics = () => {
    if (topicSearch.trim()) {
      const visible = new Set(filteredTopics);
      setSelectedTopics((prev) => prev.filter((t) => !visible.has(t)));
    } else {
      setSelectedTopics([]);
    }
  };

  const handleGenerate = async () => {
    if (!activeDoc) return;

    const topicsToUse = selectedTopics.length > 0 ? selectedTopics : allTopics;

    setIsGenerating(true);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setHasSubmitted(false);
    setScore(0);
    setTotalAnswered(0);

    try {
      const result = await quizApi.generate(activeDoc.doc_id, topicsToUse);

      if (!result.quiz || !Array.isArray(result.quiz) || result.quiz.length === 0) {
        setError('No quiz questions could be generated from this document.');
        return;
      }

      setQuestions(result.quiz);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : 'Failed to generate quiz. Please try again.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedOption || !question) return;

    setHasSubmitted(true);
    setTotalAnswered((prev) => prev + 1);

    if (selectedOption === question.answer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) return;
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setHasSubmitted(false);
  };

  const handleShowResults = () => {
    setQuizComplete(true);
  };

  const handleNewQuiz = () => {
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setHasSubmitted(false);
    setScore(0);
    setTotalAnswered(0);
    setError(null);
    setTopicSearch('');
    setQuizComplete(false);
    setShowVideos(false);
    setVideoResults([]);
    setVideoError(null);
  };

  const handleFetchVideos = async () => {
    if (!activeDoc) return;
    const topicsToUse = selectedTopics.length > 0 ? selectedTopics : allTopics;

    setIsLoadingVideos(true);
    setVideoError(null);

    try {
      const result = await videoApi.search(activeDoc.doc_id, topicsToUse);
      if (!result.videos || result.videos.length === 0) {
        setVideoError('No videos found for the selected topics.');
        return;
      }
      setVideoResults(result.videos);
      setShowVideos(true);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : 'Failed to fetch videos. Please try again.';
      setVideoError(message);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  if (!activeDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-8">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
          <Zap size={32} className="text-accent-primary" strokeWidth={2} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">No Document Selected</h2>
        <p className="text-gray-400 max-w-md text-sm leading-relaxed">
          Upload a PDF and select it from the Library to generate quizzes from your study material.
        </p>
      </div>
    );
  }

  if (showVideos) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="px-6 sm:px-10 pt-8 sm:pt-12 pb-6 sm:pb-8 border-b border-white/5 shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaYoutube size={28} className="text-red-500" />
                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Video Resources</h2>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest truncate max-w-[70vw] sm:max-w-md">
                Source: {activeDoc.file_name}
              </p>
            </div>
            <button
              onClick={() => setShowVideos(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-xs font-bold uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              <span>Back</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-10 py-8">
          <div className="max-w-6xl mx-auto space-y-12">
            {videoResults.map((topicGroup) => (
              <motion.div
                key={topicGroup.topic}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-6 bg-red-500 rounded-full" />
                  <h3 className="text-xl font-bold text-white tracking-tight">{topicGroup.topic}</h3>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {topicGroup.videos.length} video{topicGroup.videos.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topicGroup.videos.map((video, idx) => (
                    <div
                      key={idx}
                      onClick={() => window.open(video.url, '_blank', 'noopener,noreferrer')}
                      role="button"
                      className="glass-card group overflow-hidden hover:-translate-y-1 transition-all duration-300 hover:border-red-500/30 cursor-pointer"
                    >
                      {video.thumbnail && (
                        <div className="relative aspect-video overflow-hidden rounded-t-3xl">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-16 h-16 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                              <svg width="50" height="50" viewBox="0 0 512 512" fill="#dd5a5a" stroke="#dd5a5a">
                                <g><g><path d="M477.606,128.055C443.431,68.863,388.251,26.52,322.229,8.83C256.208-8.862,187.25,0.217,128.055,34.394 C68.861,68.57,26.52,123.75,8.83,189.772c-17.69,66.021-8.611,134.981,25.564,194.173 C68.568,443.137,123.75,485.48,189.771,503.17c22.046,5.908,44.417,8.83,66.646,8.83c44.339,0,88.101-11.629,127.529-34.393 c59.192-34.175,101.535-89.355,119.225-155.377C520.862,256.207,511.781,187.249,477.606,128.055z M477.429,315.333 c-15.848,59.146-53.78,108.581-106.81,139.197c-53.028,30.617-114.806,38.749-173.952,22.903 c-59.147-15.848-108.581-53.78-139.198-106.81c-30.616-53.028-38.749-114.807-22.9-173.954 C50.418,137.523,88.35,88.09,141.379,57.472c35.325-20.395,74.524-30.812,114.249-30.812c19.91,0,39.959,2.618,59.702,7.909 c59.146,15.848,108.581,53.78,139.197,106.81C485.144,194.408,493.278,256.186,477.429,315.333z" /></g></g>
                                <g><g><path d="M378.778,231.852l-164.526-94.99c-8.731-5.041-19.155-5.039-27.886-0.001c-8.731,5.04-13.944,14.069-13.944,24.15v189.98 c0,10.081,5.212,19.109,13.944,24.15c4.365,2.521,9.152,3.78,13.941,3.78c4.79,0,9.579-1.262,13.944-3.781l164.528-94.989 c8.73-5.042,13.941-14.07,13.941-24.151C392.72,245.92,387.508,236.892,378.778,231.852z M365.452,257.074l-164.527,94.989 c-0.201,0.117-0.62,0.358-1.236,0c-0.618-0.357-0.618-0.839-0.618-1.071v-189.98c0-0.232,0-0.714,0.618-1.071 c0.242-0.14,0.453-0.188,0.633-0.188c0.28,0,0.482,0.117,0.605,0.188l164.526,94.99c0.201,0.116,0.618,0.357,0.618,1.071 C366.071,256.716,365.652,256.958,365.452,257.074z" /></g></g>
                                <g><g><path d="M413.303,134.44c-31.689-40.938-79.326-68.442-130.698-75.461c-7.283-0.997-14.009,4.106-15.006,11.399 c-0.995,7.291,4.108,14.009,11.399,15.006c44.512,6.081,85.783,29.909,113.232,65.369c2.626,3.392,6.565,5.168,10.546,5.168 c2.849,0,5.72-0.909,8.146-2.789C416.741,148.628,417.807,140.259,413.303,134.44z" /></g></g>
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-red-400 transition-colors">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-gray-500 font-medium">{video.channel}</span>
                          <ExternalLink size={10} className="text-gray-600" strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="px-6 sm:px-10 pt-8 sm:pt-12 pb-6 sm:pb-8 border-b border-white/5 shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Quiz Lab</h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest truncate max-w-[70vw] sm:max-w-md">
                Source: {activeDoc.file_name}
              </p>
            </div>
            {selectedTopics.length > 0 && (
              <div className="glass-card px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                  <Zap size={16} className="text-accent-primary" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-bold text-white">
                  {selectedTopics.length} <span className="text-gray-500 font-medium text-xs">selected</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
            <div className="px-6 sm:px-10 py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" strokeWidth={2.5} />
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Search topics..."
                    className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-primary/40 transition-all"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={selectAllTopics}
                    className="px-3 py-2.5 rounded-xl bg-accent-primary/10 text-accent-primary text-[10px] font-bold uppercase tracking-widest hover:bg-accent-primary/20 transition-all"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllTopics}
                    className="px-3 py-2.5 rounded-xl bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-[12px] text-gray-400 font-medium mt-2">
                {filteredTopics.length === allTopics.length
                  ? `${allTopics.length} topics available`
                  : `Showing ${filteredTopics.length} of ${allTopics.length} topics`}
                {selectedTopics.length === 0 && ' · Leave empty to quiz on all'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-10 py-5">
              {filteredTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search size={24} className="text-gray-600 mb-3" strokeWidth={2} />
                  <p className="text-gray-500 text-sm font-medium">No topics match "{topicSearch}"</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredTopics.map((topic) => {
                    const isSelected = selectedTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        onClick={() => toggleTopic(topic)}
                        className={cn(
                          "px-4 py-2 rounded-full text-[11px] font-semibold border transition-all duration-200 whitespace-nowrap",
                          isSelected
                            ? "bg-accent-primary/10 border-accent-primary/30 text-accent-primary shadow-sm shadow-accent-primary/10"
                            : "bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:text-white hover:bg-white/8"
                        )}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-80 shrink-0 flex flex-col justify-center items-center p-6 sm:p-10 border-t lg:border-t-0 border-white/5">
            {isGenerating ? (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 border-3 border-accent-primary border-t-transparent rounded-full animate-spin mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">Generating...</h3>
                <p className="text-gray-400 text-xs">Creating MCQs from your topics</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center w-full">
                <div className="w-16 h-16 bg-accent-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Zap size={28} className="text-accent-primary" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Ready to Go</h3>
                <p className="text-gray-400 text-xs mb-6 leading-relaxed max-w-50">
                  {selectedTopics.length > 0
                    ? `Quiz will cover ${selectedTopics.length} selected topic${selectedTopics.length !== 1 ? 's' : ''}`
                    : 'All topics will be included'}
                </p>

                {error && (
                  <div className="mb-6 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold w-full text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-3"
                >
                  <Sparkles size={18} strokeWidth={2.5} />
                  <span className="text-xs uppercase tracking-widest">Generate Quiz</span>
                </button>

                <div className="flex items-center gap-3 mt-5 mb-4 w-full">
                  <div className="flex-1 h-px bg-white/15" />
                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/15" />
                </div>

                {videoError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold w-full text-center">
                    {videoError}
                  </div>
                )}

                <button
                  onClick={handleFetchVideos}
                  disabled={isLoadingVideos}
                  className="w-full py-4 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 text-gray-300 font-bold transition-all duration-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingVideos ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FaYoutube size={18} />
                  )}
                  <span className="text-xs uppercase tracking-widest">
                    {isLoadingVideos ? 'Searching...' : 'Watch Videos'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const getMessage = () => {
      if (percentage === 100) return { text: 'Perfect Score! 🎉', color: 'text-emerald-400' };
      if (percentage >= 80) return { text: 'Excellent Work! 🌟', color: 'text-emerald-400' };
      if (percentage >= 60) return { text: 'Good Effort! 👍', color: 'text-accent-primary' };
      if (percentage >= 40) return { text: 'Keep Practicing! 💪', color: 'text-yellow-400' };
      return { text: 'Don\'t Give Up! 📚', color: 'text-rose-400' };
    };
    const msg = getMessage();

    return (
      <div className="flex flex-col items-center justify-center h-screen px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="glass-card p-10 sm:p-16 max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 mx-auto bg-accent-primary/10 rounded-3xl flex items-center justify-center mb-8">
            <Trophy size={36} className="text-accent-primary" strokeWidth={2} />
          </div>

          <h2 className={cn("text-2xl sm:text-3xl font-bold mb-2 tracking-tight", msg.color)}>
            {msg.text}
          </h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-10">Quiz Complete</p>

          <div className="relative w-36 h-36 mx-auto mb-10">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 2.64} ${264 - percentage * 2.64}`}
                className={percentage >= 60 ? 'text-emerald-500' : percentage >= 40 ? 'text-yellow-500' : 'text-rose-500'}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white">{percentage}%</span>
            </div>
          </div>

          <div className="flex justify-center gap-8 mb-10">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{score}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Correct</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{questions.length - score}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Wrong</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{questions.length}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total</p>
            </div>
          </div>

          <button
            onClick={handleNewQuiz}
            className="btn-primary w-full py-4 flex items-center justify-center gap-3"
          >
            <RotateCcw size={18} strokeWidth={2.5} />
            <span className="text-xs uppercase tracking-widest">Back to Quiz Lab</span>
          </button>

          <button
            onClick={handleFetchVideos}
            disabled={isLoadingVideos}
            className="w-full py-4 mt-3 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 text-gray-300 font-bold transition-all duration-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingVideos ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FaYoutube size={18} />
            )}
            <span className="text-xs uppercase tracking-widest">
              {isLoadingVideos ? 'Searching...' : 'Learn More'}
            </span>
          </button>
        </motion.div>
      </div>
    );
  }

  const optionKeys = Object.keys(question.options);

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-16 px-4 sm:px-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10 sm:mb-16 border-b border-white/5 pb-8 sm:pb-10">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Quiz Lab</h2>
          <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest truncate max-w-[60vw] sm:max-w-sm">
            Source: {activeDoc.file_name}
          </p>
        </div>
        <div className="glass-card px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <Trophy className="text-accent-primary" size={20} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Score</p>
            <p className="text-2xl font-bold text-white">{score} / {totalAnswered}</p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-6 sm:p-10"
        >
          <div className="flex justify-between items-center mb-10">
            <span className="px-4 py-1.5 rounded-full bg-accent-primary/10 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
              Question {currentIndex + 1} / {questions.length}
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-10 leading-tight">
            {question.question}
          </h3>

          <div className="space-y-4">
            {optionKeys.map((key) => {
              const isSelected = selectedOption === key;
              const isCorrect = key === question.answer;
              const showResult = hasSubmitted;

              return (
                <button
                  key={key}
                  disabled={hasSubmitted}
                  onClick={() => setSelectedOption(key)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-300 group text-left",
                    !showResult && isSelected ? "bg-accent-primary/5 border-accent-primary text-white" : !showResult ? "bg-white/5 border-white/5 text-gray-400 hover:border-white/20" : "",
                    showResult && isCorrect && "bg-emerald-500/5 border-emerald-500 text-emerald-400",
                    showResult && isSelected && !isCorrect && "bg-rose-500/5 border-rose-500 text-rose-400",
                    showResult && !isCorrect && !isSelected && "bg-white/5 border-white/5 text-gray-400"
                  )}
                >
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className={cn(
                      "w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-sm transition-all shrink-0",
                      !showResult && isSelected ? "bg-accent-primary border-accent-primary text-white" : !showResult ? "border-white/10 text-gray-500 group-hover:border-white/30" : "",
                      showResult && isCorrect && "bg-emerald-500 border-emerald-500 text-white",
                      showResult && isSelected && !isCorrect && "bg-rose-500 border-rose-500 text-white",
                      showResult && !isCorrect && !isSelected && "border-white/10 text-gray-500"
                    )}>
                      {showResult && isCorrect ? <Check size={16} strokeWidth={3} /> : showResult && isSelected && !isCorrect ? <X size={16} strokeWidth={3} /> : key}
                    </div>
                    <span className="text-base sm:text-lg font-semibold tracking-tight">{question.options[key]}</span>
                  </div>
                  {showResult && isCorrect && isSelected && (
                    <span className="text-[10px] font-bold uppercase tracking-widest mr-2 text-emerald-500 hidden sm:inline">Correct Choice</span>
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <span className="text-[10px] font-bold uppercase tracking-widest mr-2 text-rose-500 hidden sm:inline">Incorrect</span>
                  )}
                </button>
              );
            })}
          </div>

          {!hasSubmitted ? (
            <div className="mt-12 pt-10 border-t border-white/5 flex justify-end">
              <button
                onClick={handleSubmitAnswer}
                disabled={!selectedOption}
                className="btn-primary px-8 sm:px-12"
              >
                SUBMIT RESPONSE
              </button>
            </div>
          ) : (
            <div className="mt-12 pt-10 border-t border-white/5 flex items-center justify-between">
              {hasSubmitted && selectedOption === question.answer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Lightbulb className="text-emerald-400" size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-emerald-400 text-sm font-semibold">Well done!</span>
                </motion.div>
              )}
              {hasSubmitted && selectedOption !== question.answer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                    <Lightbulb className="text-accent-primary" size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-gray-400 text-sm font-semibold">
                    Correct answer: <span className="text-accent-primary">{question.answer}</span>
                  </span>
                </motion.div>
              )}

              <div className="flex gap-3">
                {!isLastQuestion ? (
                  <button onClick={handleNext} className="btn-primary px-8">
                    NEXT QUESTION
                  </button>
                ) : (
                  <button onClick={handleShowResults} className="btn-primary px-8 flex items-center gap-2">
                    <Trophy size={16} strokeWidth={2.5} />
                    <span>VIEW RESULTS</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
