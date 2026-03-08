import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import socket from '../socket';
import SyncStatus from './SyncStatus';
import { API_BASE } from '../config';

const API = API_BASE;

export default function StudentPortal({ user }) {
    const [activeTab, setActiveTab] = useState('home');
    const [lessons, setLessons] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [progress, setProgress] = useState(() => {
        const saved = localStorage.getItem(`progress_${user?._id}`);
        return saved ? parseInt(saved) : 0;
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [onlineCount, setOnlineCount] = useState(0);

    // Lesson Viewer State
    const [activeLesson, setActiveLesson] = useState(null);
    const [lessonProgress, setLessonProgress] = useState(0);

    // Quiz Runner State
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [quizResult, setQuizResult] = useState(null);
    const [quizTimer, setQuizTimer] = useState(0);

    // Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [typingUser, setTypingUser] = useState('');
    const chatEndRef = useRef(null);

    // Lesson Filter
    const [subjectFilter, setSubjectFilter] = useState('All');
    const [lessonSearch, setLessonSearch] = useState('');
    const [quizFilter, setQuizFilter] = useState('pending');
    const [completedQuizIds, setCompletedQuizIds] = useState(() => {
        const saved = localStorage.getItem(`completedQuizzes_${user?._id}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [showSubmitModal, setShowSubmitModal] = useState(false);

    // Helper: normalize YouTube URLs for Android WebView compatibility
    const normalizeYouTubeUrl = (url) => {
        if (!url) return url;
        const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
        return url;
    };

    useEffect(() => {
        socket.emit('join_class', 'class-8a');
        socket.on('presence:online_count', (data) => setOnlineCount(data.count));
        // Deduplicate chat messages by _id
        socket.on('chat:message', (msg) => setChatMessages(prev => {
            if (prev.some(m => m._id === msg._id)) return prev;
            return [...prev, msg];
        }));
        socket.on('chat:typing_indicator', (data) => { setTypingUser(data.name); setTimeout(() => setTypingUser(''), 3000); });
        // Quiz notification from teacher — also add to quiz list
        socket.on('quiz:started', (data) => {
            setActiveQuiz(data.quiz); setCurrentQ(0); setAnswers({}); setQuizResult(null);
            // Add quiz to the quizzes list if not already there
            if (data.quiz) {
                setQuizzes(prev => {
                    if (prev.some(q => q._id === data.quiz._id || q._id === data.quizId)) return prev;
                    return [data.quiz, ...prev];
                });
            }
        });

        // Online/Offline detection
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        // Fetch lessons & quizzes from API
        fetch(`${API}/lessons`).then(r => r.json()).then(data => {
            if (!Array.isArray(data)) { console.warn('Lessons API returned non-array:', data); return; }
            // Normalize YouTube URLs in lessons
            const normalized = data.map(l => ({ ...l, contentUrl: normalizeYouTubeUrl(l.contentUrl) }));
            setLessons(normalized);
        }).catch((err) => { console.warn('Lessons fetch error:', err); });
        fetch(`${API}/quizzes`).then(r => r.json()).then(setQuizzes).catch(() => { });
        fetch(`${API}/chat/class-8a`).then(r => r.json()).then(setChatMessages).catch(() => { });

        // Load saved progress from API or localStorage
        if (user?._id) {
            fetch(`${API}/users/progress/${user._id}`).then(r => r.json()).then(data => {
                if (data.progress && data.progress.length > 0 && data.progress[0].score) {
                    setProgress(data.progress[0].score);
                    localStorage.setItem(`progress_${user._id}`, data.progress[0].score);
                }
            }).catch(() => { });
        }

        return () => {
            socket.off('chat:message');
            socket.off('presence:online_count');
            socket.off('chat:typing_indicator');
            socket.off('quiz:started');
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

    // Quiz timer
    useEffect(() => {
        if (activeQuiz && activeQuiz.timeLimit > 0 && !quizResult) {
            setQuizTimer(activeQuiz.timeLimit);
            const interval = setInterval(() => {
                setQuizTimer(prev => {
                    if (prev <= 1) { clearInterval(interval); handleQuizSubmit(); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activeQuiz]);

    const handleContinue = async () => {
        setIsSaving(true);
        const newProgress = Math.min(progress + 5, 100);
        const payload = { newProgressScore: newProgress, chapter: 'Math Ch.4' };

        try {
            if (isOnline) {
                await fetch(`${API}/users/progress/${user._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            } else {
                throw new Error('Offline');
            }
            socket.emit('student_progress', { roomId: 'class-8a', studentId: user._id, studentName: user.name, score: newProgress, status: 'online', chapter: 'Math Ch.4' });
            setProgress(newProgress);
            localStorage.setItem(`progress_${user._id}`, newProgress);
        } catch (e) {
            console.log('[Offline] Queueing progress update');
            import('../offline/syncQueue').then(({ enqueue }) => {
                enqueue({ method: 'PUT', url: `${API}/users/progress/${user._id}`, body: payload });
            });
            setProgress(newProgress);
            localStorage.setItem(`progress_${user._id}`, newProgress);
        }
        finally { setIsSaving(false); }
    };

    const handleQuizSubmit = async () => {
        if (!activeQuiz) return;
        const answerArr = activeQuiz.questions.map((q, i) => ({ questionId: q._id, answer: answers[i] || '' }));
        const payload = { answers: answerArr };

        try {
            if (!isOnline) throw new Error('Offline mode - caching locally');
            const res = await fetch(`${API}/quizzes/${activeQuiz._id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await res.json();
            setQuizResult({ ...result, quiz: activeQuiz });
        } catch (e) {
            // Offline fallback: Queue for sync
            import('../offline/syncQueue').then(({ enqueue }) => {
                enqueue({ method: 'POST', url: `${API}/quizzes/${activeQuiz._id}/submit`, body: payload });
            });

            // Local score estimation
            let score = 0;
            activeQuiz.questions.forEach((q, i) => { if (answers[i] === q.correctAnswer) score += q.points; });
            const pct = Math.round((score / activeQuiz.questions.reduce((a, q) => a + q.points, 0)) * 100);
            setQuizResult({ score, totalPoints: activeQuiz.questions.length, percentage: pct, passed: pct >= 60, badge: pct >= 80 ? '🏅' : '', quiz: activeQuiz });
        }

        // Add to completed quizzes state
        setCompletedQuizIds(prev => {
            if (!prev.includes(activeQuiz._id)) {
                const updated = [...prev, activeQuiz._id];
                localStorage.setItem(`completedQuizzes_${user?._id}`, JSON.stringify(updated));
                return updated;
            }
            return prev;
        });
    };

    const sendChat = () => {
        if (!chatInput.trim()) return;
        socket.emit('chat:send', { roomId: 'class-8a', text: chatInput, senderId: user._id, senderName: user.name, senderRole: 'student' });
        setChatInput('');
    };

    const subjects = ['All', 'Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Computer'];
    const filteredLessons = lessons.filter(l => {
        const matchSubject = subjectFilter === 'All' || l.subject === subjectFilter;
        const matchSearch = !lessonSearch || l.title?.toLowerCase().includes(lessonSearch.toLowerCase());
        return matchSubject && matchSearch;
    });
    const answeredCount = Object.keys(answers).filter(k => answers[k]).length;

    // ──── QUIZ RESULT SCREEN ────
    if (quizResult) {
        const { score, totalPoints, passed, badge, quiz } = quizResult;
        const percentage = quizResult.percentage ?? (totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0);
        const color = percentage >= 80 ? 'text-emerald-400' : percentage >= 60 ? 'text-amber-400' : 'text-red-400';
        const bgColor = percentage >= 80 ? 'from-emerald-900/30' : percentage >= 60 ? 'from-amber-900/30' : 'from-red-900/30';
        return (
            <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col items-center justify-center p-6">
                <div className={`w-full max-w-md bg-gradient-to-b ${bgColor} to-slate-950 rounded-3xl p-8 text-center`}>
                    <div className={`w-28 h-28 mx-auto rounded-full border-4 ${percentage >= 80 ? 'border-emerald-500' : percentage >= 60 ? 'border-amber-500' : 'border-red-500'} flex items-center justify-center mb-4`}>
                        <span className={`text-3xl font-extrabold ${color}`}>{score}/{totalPoints}</span>
                    </div>
                    <p className={`text-5xl font-black ${color} mb-2`}>{percentage}%</p>
                    <p className={`text-lg font-bold mb-4 ${passed ? 'text-emerald-400' : 'text-red-400'}`}>{passed ? '🎉 PASSED!' : '❌ Not Passed'}</p>
                    {badge && <p className="text-2xl mb-2">{badge} Badge Earned!</p>}
                    <p className="text-sm text-slate-400 mb-6">+{score} points added to your total</p>

                    {/* Answer Review */}
                    <div className="text-left space-y-3 mb-6">
                        {quiz.questions.map((q, i) => {
                            const userAns = answers[i] || '—';
                            const correct = userAns === q.correctAnswer;
                            return (
                                <div key={i} className={`p-3 rounded-xl border ${correct ? 'border-emerald-800 bg-emerald-950/30' : 'border-red-800 bg-red-950/30'}`}>
                                    <p className="text-xs text-slate-400 mb-1">Q{i + 1}</p>
                                    <p className="text-sm font-semibold mb-1">{q.questionText}</p>
                                    <p className="text-xs">{correct ? '✓' : '✗'} Your answer: <span className="font-bold">{userAns}</span> {!correct && <span className="text-emerald-400">→ Correct: {q.correctAnswer}</span>}</p>
                                    {q.explanation && <p className="text-xs text-slate-500 mt-1">💡 {q.explanation}</p>}
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={() => { setActiveQuiz(null); setQuizResult(null); setAnswers({}); }} className="w-full py-3.5 bg-indigo-600 rounded-xl font-bold text-sm">Back to Home</button>
                </div>
            </div>
        );
    }

    // ──── LESSON VIEWER ────
    if (activeLesson) {
        const linkedQuiz = quizzes.find(qz => qz.lessonId === activeLesson._id) || quizzes[0];
        return (
            <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col max-w-md mx-auto relative">
                <div className="flex items-center gap-3 p-4 border-b border-white/10 sticky top-0 bg-slate-950 z-10">
                    <button onClick={() => { setActiveLesson(null); setLessonProgress(0); }} className="p-2 -ml-2 hover:bg-white/5 rounded-full"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
                    <div className="flex-1 min-w-0"><span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">{activeLesson.subject}</span><h2 className="text-sm font-bold truncate">{activeLesson.title}</h2></div>
                    <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">{Math.round(lessonProgress)}%</span>
                </div>

                <div className="flex-1 overflow-y-auto pb-24">
                    {activeLesson.contentUrl ? (() => {
                        // Extract YouTube video ID for direct iframe embed (works reliably on Android WebView)
                        const ytMatch = activeLesson.contentUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                        if (ytMatch) {
                            return (
                                <div className="w-full aspect-video bg-black border-b border-white/10">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`}
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={activeLesson.title}
                                        style={{ border: 'none' }}
                                    />
                                </div>
                            );
                        }
                        return (
                            <div className="w-full aspect-video bg-black border-b border-white/10">
                                <ReactPlayer url={activeLesson.contentUrl} width="100%" height="100%" playing={true} controls={true} onProgress={({ played }) => setLessonProgress(played * 100)} />
                            </div>
                        );
                    })() : (
                        <div className="w-full aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center border-b border-white/10">
                            <span className="text-5xl mb-3">📄</span><p className="font-bold text-sm text-slate-300">Document Lesson</p><p className="text-[10px] text-slate-500 mt-1">No video available for this lesson</p>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="px-5 pt-4">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                            <span>LESSON PROGRESS</span><span className={lessonProgress > 80 ? 'text-emerald-400' : 'text-indigo-400'}>{Math.round(lessonProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-500 ${lessonProgress > 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${lessonProgress}%` }} />
                        </div>
                    </div>

                    <div className="p-5 space-y-6">
                        <div>
                            <h1 className="text-2xl font-black mb-2">{activeLesson.title}</h1>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{activeLesson.language || 'English'}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-md">⏱ {activeLesson.duration || 30} mins</span>
                                {activeLesson.grade && <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-md">Grade {activeLesson.grade}</span>}
                            </div>
                        </div>

                        {activeLesson.description && (
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Description</p>
                                <p className="text-sm text-slate-300 leading-relaxed font-medium">{activeLesson.description}</p>
                            </div>
                        )}

                        {activeLesson.pdfUrl && (
                            <a href={activeLesson.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl hover:bg-indigo-600/30 transition-colors">
                                <div className="flex items-center gap-3"><span className="text-2xl">📄</span><div><p className="text-sm font-bold text-indigo-300">Open PDF Notes</p><p className="text-[10px] text-indigo-400/60 font-semibold">{activeLesson.title} Notes</p></div></div>
                                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        )}

                        {linkedQuiz && lessonProgress > 80 && (
                            <div className="pt-4 border-t border-white/10">
                                <button onClick={() => { setActiveLesson(null); setLessonProgress(0); setActiveQuiz(linkedQuiz); setCurrentQ(0); setAnswers({}); setQuizResult(null); }} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2 active:scale-95 transition-all">
                                    <span>Take Quiz for this Lesson →</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ──── QUIZ RUNNER ────
    if (activeQuiz) {
        const q = activeQuiz.questions[currentQ];
        const total = activeQuiz.questions.length;
        const mins = Math.floor(quizTimer / 60);
        const secs = quizTimer % 60;
        return (
            <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col max-w-md mx-auto">
                {/* Quiz Header */}
                <div className="flex justify-between items-center p-5 border-b border-white/10">
                    <button onClick={() => { if (confirm('Leave quiz? Progress will be lost.')) { setActiveQuiz(null); setAnswers({}); } }} className="text-sm font-bold text-slate-400 flex items-center">← Exit</button>
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Question {currentQ + 1} of {total}</span>
                    {activeQuiz.timeLimit > 0 && <span className={`text-sm font-extrabold px-3 py-1 rounded-lg ${quizTimer < 30 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-indigo-400'}`}>{mins}:{secs.toString().padStart(2, '0')}</span>}
                </div>

                {/* Question */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <p className="text-xl font-bold leading-relaxed mb-6">{q.questionText}</p>

                    {q.type === 'mcq' && (
                        <div className="space-y-3">
                            {q.options.map((opt, idx) => (
                                <button key={idx} onClick={() => setAnswers({ ...answers, [currentQ]: opt })}
                                    className={`w-full p-4 text-left rounded-2xl font-semibold text-sm transition-all border-2 ${answers[currentQ] === opt ? 'bg-indigo-600 border-indigo-500 text-white scale-[1.02]' : 'bg-slate-800 border-white/10 text-slate-200 hover:border-indigo-500/50'}`}>
                                    <span className="mr-3 text-xs font-bold opacity-50">{String.fromCharCode(65 + idx)}</span>{opt}
                                </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'true_false' && (
                        <div className="flex gap-4">
                            {['True', 'False'].map(opt => (
                                <button key={opt} onClick={() => setAnswers({ ...answers, [currentQ]: opt })}
                                    className={`flex-1 py-5 rounded-2xl font-bold text-lg transition-all border-2 ${answers[currentQ] === opt ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-white/10'}`}>
                                    {opt === 'True' ? '✅' : '❌'} {opt}
                                </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'fill_blank' && (
                        <input type="text" value={answers[currentQ] || ''} onChange={(e) => setAnswers({ ...answers, [currentQ]: e.target.value })}
                            className="w-full p-4 bg-slate-800 border-2 border-white/10 rounded-2xl text-white font-semibold focus:border-indigo-500 outline-none" placeholder="Type your answer..." />
                    )}

                    {/* Question dots */}
                    <div className="flex justify-center gap-2 mt-8">
                        {activeQuiz.questions.map((_, i) => (
                            <button key={i} onClick={() => setCurrentQ(i)} className={`w-3 h-3 rounded-full transition-all ${i === currentQ ? 'bg-indigo-500 scale-125' : answers[i] ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                        ))}
                    </div>
                </div>

                {/* Nav Buttons */}
                <div className="p-5 border-t border-white/10 flex justify-between">
                    <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
                        className={`px-6 py-3.5 rounded-xl font-bold text-sm ${currentQ === 0 ? 'bg-slate-800 text-slate-600' : 'bg-slate-700 text-white'}`}>← Previous</button>
                    {currentQ === total - 1 ? (
                        <button onClick={() => setShowSubmitModal(true)} className="px-8 py-3.5 bg-emerald-600 text-white font-extrabold rounded-xl text-sm hover:bg-emerald-500 active:scale-95 transition-all">Submit Quiz</button>
                    ) : (
                        <button onClick={() => setCurrentQ(Math.min(total - 1, currentQ + 1))} className="px-6 py-3.5 bg-indigo-600 text-white font-bold rounded-xl text-sm">Next →</button>
                    )}
                </div>

                {/* Submit Confirmation Modal */}
                {showSubmitModal && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
                        <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 text-center">
                            <h3 className="font-extrabold text-lg">Submit your quiz?</h3>
                            <p className="text-sm text-slate-400">You have answered <span className="font-bold text-white">{answeredCount}</span> of <span className="font-bold text-white">{total}</span> questions.</p>
                            {answeredCount < total && <p className="text-xs text-amber-400 font-bold">⚠️ {total - answeredCount} question{total - answeredCount > 1 ? 's' : ''} unanswered</p>}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold text-sm text-slate-300">Review</button>
                                <button onClick={() => { setShowSubmitModal(false); handleQuizSubmit(); }} className="flex-1 py-3 bg-emerald-600 rounded-xl font-bold text-sm text-white hover:bg-emerald-500">Submit Now</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ──── MAIN APP ────
    return (
        <div className="bg-slate-950 min-h-screen pb-24 font-sans text-white max-w-md mx-auto relative">

            {/* Offline Sync Banner */}
            {!isOnline && (
                <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 text-center transition-all animate-fadeIn">
                    <p className="text-amber-300 text-xs font-bold font-sans">⚡ You're offline — learning from saved content</p>
                    <p className="text-amber-400/60 text-[10px] uppercase font-bold tracking-widest mt-1">Progress queued locally</p>
                </div>
            )}

            {/* Header */}
            <header className="bg-slate-900/95 backdrop-blur-md px-5 pt-6 pb-4 sticky top-0 z-20 border-b border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-sm">🎓</span>
                            <span className="text-lg font-extrabold tracking-tight">Vidya Setu</span>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mb-2">Student Portal</p>
                        <SyncStatus />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button className="relative p-2 bg-slate-800 border border-white/10 rounded-full"><svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span></button>
                    </div>
                </div>
            </header>

            <main className="px-5 pt-5 space-y-6 pb-4">
                {/* ──── HOME TAB ──── */}
                {activeTab === 'home' && (<>
                    {/* Welcome Hero */}
                    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full"></div>
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-violet-400/10 rounded-full"></div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200 mb-1">Welcome back</p>
                            <h2 className="text-2xl font-extrabold mb-0.5">{user?.name || 'Student'}</h2>
                            <p className="text-sm text-indigo-200 font-medium mb-4">School ID: {user?.schoolId || 'nabha-01'}</p>
                            <div className="flex divide-x divide-white/20 text-center">
                                <div className="flex-1"><p className="text-2xl font-black">8</p><p className="text-[10px] text-indigo-200 uppercase font-bold">Lessons</p></div>
                                <div className="flex-1"><p className="text-2xl font-black">3</p><p className="text-[10px] text-indigo-200 uppercase font-bold">Quizzes</p></div>
                                <div className="flex-1"><p className="text-2xl font-black">5</p><p className="text-[10px] text-indigo-200 uppercase font-bold">Badges</p></div>
                            </div>
                        </div>
                    </div>

                    {/* Badges */}
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Your Badges</p>
                        <div className="bg-slate-800/60 rounded-xl p-3 border border-white/5 flex gap-3">
                            {['⭐', '🏅', '🔥', '💡', '🌟'].map((b, i) => <span key={i} className="text-2xl cursor-default hover:scale-125 transition-transform" title={['First Star', 'Scholar', 'On Fire', 'Quick Learner', 'Perfect'][i]}>{b}</span>)}
                        </div>
                    </div>

                    {/* Continue Learning */}
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Continue Where You Left Off</p>
                        <div className="bg-slate-800 rounded-2xl overflow-hidden border border-white/5">
                            <div className="h-40 relative bg-gradient-to-br from-indigo-800 to-slate-900 flex items-end p-4">
                                <div><span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 px-2 py-1 rounded-md mb-2 inline-block">Chapter 4</span><h3 className="text-lg font-bold">Mathematics: Algebra Foundations</h3></div>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between text-sm mb-2"><span className="text-slate-400 font-semibold">Progress</span><span className="font-extrabold text-indigo-400">{progress}%</span></div>
                                <div className="w-full bg-slate-700 rounded-full h-2 mb-4 overflow-hidden"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-700 relative" style={{ width: `${progress}%` }}><div className="absolute inset-0 bg-white/20 animate-pulse"></div></div></div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-bold">8 / 12 lessons</span>
                                    <button onClick={handleContinue} disabled={isSaving} className={`${isSaving ? 'bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'} text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-all`}>{isSaving ? 'Saving...' : 'Continue →'}</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pending Quiz */}
                    {quizzes.length > 0 && (
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Pending Quiz</p>
                            <div onClick={() => { setActiveQuiz(quizzes[0]); setCurrentQ(0); setAnswers({}); setQuizResult(null); }} className="bg-slate-800 rounded-2xl p-4 border border-amber-500/20 flex items-center justify-between cursor-pointer hover:border-amber-500/40 transition-all active:scale-[0.98]">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-xl">📝</div>
                                    <div><h3 className="font-bold text-sm">{quizzes[0].title}</h3><p className="text-[11px] text-slate-500 font-semibold">{quizzes[0].questions?.length || 5} questions · {Math.floor((quizzes[0].timeLimit || 900) / 60)} mins</p></div>
                                </div>
                                <button className="bg-amber-600 text-white text-xs font-bold py-2.5 px-5 rounded-xl">Start →</button>
                            </div>
                        </div>
                    )}

                    {/* Today's Lessons */}
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Today's Lessons</p>
                        <div className="space-y-3">
                            {lessons.slice(0, 3).map((lesson, i) => (
                                <div key={lesson._id || i} onClick={() => { setActiveLesson(lesson); setLessonProgress(0); }} className="bg-slate-800 rounded-2xl p-4 border border-white/5 flex items-center gap-4 cursor-pointer hover:border-indigo-500/30 transition-all active:scale-[0.98]">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${['bg-blue-500/10 text-blue-400', 'bg-emerald-500/10 text-emerald-400', 'bg-purple-500/10 text-purple-400', 'bg-amber-500/10 text-amber-400', 'bg-pink-500/10 text-pink-400'][i % 5]}`}>{['📐', '🔬', '📖', 'ਪ', '💻'][i % 5]}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold truncate">{lesson.title}</h3>
                                        <p className="text-[11px] text-slate-500 font-semibold">{lesson.subject} · {lesson.duration || 30} min</p>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">✓ Saved</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>)}

                {/* ──── LESSONS TAB ──── */}
                {activeTab === 'lessons' && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold">All Lessons</h2>
                        <div className="relative"><input type="text" value={lessonSearch} onChange={e => setLessonSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 font-semibold focus:border-indigo-500 outline-none text-sm" placeholder="🔍 Search lessons..." /><svg className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div>

                        {/* Subject Filter Pills */}
                        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                            {subjects.map(s => <button key={s} onClick={() => setSubjectFilter(s)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${subjectFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{s}</button>)}
                        </div>

                        {/* Lesson Cards */}
                        <div className="space-y-3">
                            {filteredLessons.map((lesson, i) => (
                                <div key={lesson._id || i} onClick={() => { setActiveLesson(lesson); setLessonProgress(0); }} className="bg-slate-800 rounded-2xl p-4 border border-white/5 flex items-center gap-4 cursor-pointer hover:border-indigo-500/30 transition-all active:scale-[0.98]">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 ${['bg-blue-500/10 text-blue-400', 'bg-emerald-500/10 text-emerald-400', 'bg-purple-500/10 text-purple-400', 'bg-amber-500/10 text-amber-400', 'bg-pink-500/10 text-pink-400'][i % 5]}`}>{['📐', '🔬', '📖', 'ਪ', '💻'][i % 5]}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5"><span className={`text-[9px] font-extrabold uppercase tracking-wider ${['text-blue-400', 'text-emerald-400', 'text-purple-400'][i % 3]}`}>{lesson.subject}</span></div>
                                        <h3 className="text-sm font-bold truncate">{lesson.title}</h3>
                                        <p className="text-[11px] text-slate-500 font-semibold">{lesson.language || 'English'} · {lesson.duration || 30} min</p>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                        <span className="bg-indigo-600 text-white text-[10px] font-bold py-2 px-4 rounded-lg">Start</span>
                                    </div>
                                </div>
                            ))}
                            {filteredLessons.length === 0 && <p className="text-center text-slate-500 text-sm py-8">📚 No lessons found for this subject yet.</p>}
                        </div>
                    </div>
                )}

                {/* ──── QUIZZES TAB ──── */}
                {activeTab === 'quizzes' && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold">Quizzes</h2>
                        <div className="flex bg-slate-800 p-1 rounded-xl">
                            <button onClick={() => setQuizFilter('pending')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${quizFilter === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>Pending</button>
                            <button onClick={() => setQuizFilter('completed')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${quizFilter === 'completed' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>Completed</button>
                        </div>
                        <div className="space-y-3">
                            {quizzes.filter(q => quizFilter === 'completed' ? completedQuizIds.includes(q._id) : !completedQuizIds.includes(q._id)).map((quiz, i) => (
                                <div key={quiz._id || i} className={`rounded-2xl p-4 border ${quizFilter === 'completed' ? 'bg-indigo-950/20 border-indigo-500/20' : 'bg-slate-800 border-white/5'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-sm">{quiz.title}</h3>
                                            <p className="text-[11px] text-slate-500 font-semibold">{quiz.subject} · {quiz.questions?.length} questions · {Math.floor((quiz.timeLimit || 900) / 60)} min</p>
                                        </div>
                                        {quizFilter !== 'completed' && <span className="text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md uppercase">New</span>}
                                        {quizFilter === 'completed' && <span className="text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md uppercase">Done ✓</span>}
                                    </div>
                                    <button onClick={() => { setActiveQuiz(quiz); setCurrentQ(0); setAnswers({}); setQuizResult(null); }}
                                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${quizFilter === 'completed' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'}`}>
                                        {quizFilter === 'completed' ? 'Retake Quiz ↺' : 'Start Quiz →'}
                                    </button>
                                </div>
                            ))}
                            {quizzes.filter(q => quizFilter === 'completed' ? completedQuizIds.includes(q._id) : !completedQuizIds.includes(q._id)).length === 0 && <p className="text-center text-slate-500 text-sm py-8">{quizFilter === 'completed' ? '🏆 No completed quizzes yet.' : '✏️ No pending quizzes to take.'}</p>}
                        </div>
                    </div>
                )}

                {/* ──── CHAT TAB ──── */}
                {activeTab === 'chat' && (
                    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
                        {/* Chat Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center font-bold text-sm">MS</div>
                            <div><h3 className="font-bold text-sm">Mr. Sharma</h3><p className="text-[11px] text-emerald-400 font-semibold">🟢 Live Class · 👥 {onlineCount} online</p></div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {chatMessages.map((msg, i) => {
                                const isMe = msg.senderId === user._id || msg.senderName === user.name;
                                return (
                                    <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] ${isMe ? 'bg-indigo-600 rounded-2xl rounded-tr-sm' : 'bg-slate-700 rounded-2xl rounded-tl-sm'} p-3 px-4`}>
                                            {!isMe && <p className="text-[10px] font-bold text-indigo-300 mb-1">{msg.senderName}</p>}
                                            <p className="text-sm">{msg.text}</p>
                                            <p className="text-[9px] text-white/40 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {typingUser && <p className="text-xs text-slate-500 italic">{typingUser} is typing...</p>}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2 mt-3">
                            <input type="text" value={chatInput} onChange={(e) => { setChatInput(e.target.value); socket.emit('chat:typing', { roomId: 'class-8a', name: user.name }); }}
                                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                className="flex-1 px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm font-semibold focus:border-indigo-500 outline-none" placeholder="Type a message..." />
                            <button onClick={sendChat} className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 hover:bg-indigo-500 active:scale-95"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button>
                        </div>
                    </div>
                )}

                {/* ──── PROFILE TAB ──── */}
                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        <div className="bg-slate-800 rounded-3xl p-6 border border-white/5 text-center">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-3xl font-extrabold mb-3">{user?.name?.split(' ').map(n => n[0]).join('') || 'U'}</div>
                            <h2 className="text-xl font-bold">{user?.name || 'Student'}</h2>
                            <p className="text-sm text-slate-400 font-semibold mb-4">Standard 8 · {user?.language || 'English'}</p>
                            <div className="flex gap-2">
                                <span className="flex-1 bg-indigo-500/10 text-indigo-300 py-2 rounded-xl text-xs font-bold uppercase">🌟 1,240 Points</span>
                                <span className="flex-1 bg-emerald-500/10 text-emerald-300 py-2 rounded-xl text-xs font-bold uppercase">🔥 5 Day Streak</span>
                            </div>
                        </div>
                        <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                            {[{ icon: '🌐', label: 'Language', value: user?.language || 'English' }, { icon: '📥', label: 'Offline Downloads', value: '1.2 GB' }, { icon: '🏫', label: 'School', value: user?.schoolId || 'nabha-01' }].map((item, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-700/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3"><span className="text-lg">{item.icon}</span><span className="font-bold text-sm text-slate-300">{item.label}</span></div>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><span>{item.value}</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Nav — Spec 08 */}
            <nav className="fixed bottom-0 w-full max-w-md bg-slate-900/95 backdrop-blur-md border-t border-white/5 z-50">
                <ul className="flex justify-around items-center h-[72px] px-2">
                    {[{ id: 'home', icon: '🏠', label: 'Home' }, { id: 'lessons', icon: '📚', label: 'Lessons' }, { id: 'quizzes', icon: '✏️', label: 'Quizzes' }, { id: 'chat', icon: '💬', label: 'Chat' }, { id: 'profile', icon: '👤', label: 'Profile' }].map(tab => (
                        <li key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center cursor-pointer transition-all ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {activeTab === tab.id && <div className="w-6 h-0.5 bg-indigo-400 rounded-full mb-1"></div>}
                            <span className="text-lg mb-0.5">{tab.icon}</span>
                            <span className={`text-[10px] ${activeTab === tab.id ? 'font-extrabold' : 'font-bold'}`}>{tab.label}</span>
                        </li>
                    ))}
                </ul>
            </nav>

            <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
        </div>
    );
}
