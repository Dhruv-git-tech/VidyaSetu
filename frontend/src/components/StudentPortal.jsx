import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import socket from '../socket';
import SyncStatus from './SyncStatus';
import { API_BASE, SOCKET_URL } from '../config';
import { saveVideoOffline, getOfflineVideoUrl, getSavedLessonIds, deleteOfflineVideo, getOfflineStorageUsed } from '../offline/videoCache';

const API = API_BASE;
// Resolve upload paths to the correct server host (handles both relative and old absolute localhost URLs)
const resolveUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('/uploads/')) return `${SOCKET_URL}${url}`;
    // Fix old absolute URLs that were saved with hardcoded localhost
    if (url.startsWith('http://localhost:5001/uploads/') || url.startsWith('http://127.0.0.1:5001/uploads/')) {
        return `${SOCKET_URL}/uploads/${url.split('/uploads/')[1]}`;
    }
    // Fix Cloudinary URLs - replace old cloud name with correct one
    if (url.includes('cloudinary.com')) {
        // Replace old cloud name with correct one
        let fixedUrl = url.replace('dpnkgdq6z', 'vidyasetu');
        // Add optimization parameters
        const separator = fixedUrl.includes('?') ? '&' : '?';
        return `${fixedUrl}${separator}f_auto&q=auto`;
    }
    return url;
};
// Detect direct mp4 video URLs (local, Cloudinary, or any direct file)
const isDirectVideo = (url) => url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg') || url.includes('cloudinary.com/') || url.includes('/uploads/'));

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
    const [offlineUsageBytes, setOfflineUsageBytes] = useState(null);

    // Streak & Activity Tracking
    const [streak, setStreak] = useState(() => {
        const saved = localStorage.getItem(`streak_${user?._id}`);
        return saved ? parseInt(saved) : 0;
    });
    const [lastActiveDate, setLastActiveDate] = useState(() => {
        return localStorage.getItem(`lastActive_${user?._id}`) || null;
    });
    const [todayProgress, setTodayProgress] = useState(0);

    // Lesson Viewer State
    const [activeLesson, setActiveLesson] = useState(null);
    const [lessonProgress, setLessonProgress] = useState(0);
    const [offlineVideoUrl, setOfflineVideoUrl] = useState(null);

    // Offline Video Downloads
    const [savedLessonIds, setSavedLessonIds] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);

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

    // Notifications
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

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
        // Update streak on component mount
        updateStreak();

        // Estimate local storage usage (IndexedDB, Cache, etc.) for this origin
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate()
                .then(({ usage }) => {
                    if (typeof usage === 'number') {
                        setOfflineUsageBytes(usage);
                    }
                })
                .catch(() => {
                    setOfflineUsageBytes(0);
                });
        }

        // Join socket room based on student's class
        const standard = user?.standard || '8';
        const roomId = `class-${standard}`;
        socket.emit('join_class', roomId);
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

        // Real-time notifications — also refresh data when new content is added
        socket.on('notification:new', (notif) => {
            setNotifications(prev => [{ ...notif, read: false }, ...prev]);
            if (notif.type === 'quiz') {
                fetch(`${API}/quizzes`).then(r => r.json()).then(data => {
                    if (Array.isArray(data)) setQuizzes(data);
                }).catch(() => { });
            }
            if (notif.type === 'lesson') {
                // Refetch lessons for this student's class
                fetchLessons();
            }
        });

        // Online/Offline detection
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        // Fetch notifications filtered by student's class
        fetch(`${API}/notifications?role=student&userId=${user?._id || ''}&standard=${user?.standard || '8'}`).then(r => r.json()).then(data => {
            if (Array.isArray(data)) setNotifications(data);
        }).catch(() => { });

        // Fetch lessons filtered by student's class
        const fetchLessons = () => {
            const standard = user?.standard || '8';
            fetch(`${API}/lessons?standard=${standard}`).then(r => r.json()).then(data => {
                if (!Array.isArray(data)) { console.warn('Lessons API returned non-array:', data); return; }
                // Normalize YouTube URLs in lessons
                const normalized = data.map(l => ({ ...l, contentUrl: normalizeYouTubeUrl(l.contentUrl) }));
                setLessons(normalized);
            }).catch((err) => { console.warn('Lessons fetch error:', err); });
        };
        fetchLessons();

        // Fetch quizzes filtered by student's class
        const fetchQuizzes = () => {
            const standard = user?.standard || '8';
            fetch(`${API}/quizzes?standard=${standard}`).then(r => r.json()).then(data => {
                if (!Array.isArray(data)) { console.warn('Quizzes API returned non-array:', data); return; }
                setQuizzes(data);
            }).catch((err) => { console.warn('Quizzes fetch error:', err); });
        };
        fetchQuizzes();

        // Fetch chat messages for student's class
        const chatStandard = user?.standard || '8';
        const chatRoomId = `class-${chatStandard}`;
        fetch(`${API}/chat/${chatRoomId}`).then(r => r.json()).then(setChatMessages).catch(() => { });

        return () => {
            socket.off('chat:message');
            socket.off('presence:online_count');
            socket.off('chat:typing_indicator');
            socket.off('quiz:started');
            socket.off('notification:new');
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // Update streak logic
    const updateStreak = () => {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        // Load today's progress
        const savedTodayProgress = localStorage.getItem(`todayProgress_${user?._id}`);
        const todayDate = localStorage.getItem(`todayProgressDate_${user?._id}`);

        if (todayDate !== today) {
            setTodayProgress(0);
        } else if (savedTodayProgress) {
            setTodayProgress(parseInt(savedTodayProgress));
        }

        if (lastActiveDate === today) {
            // Already active today - keep streak
            return;
        } else if (lastActiveDate === yesterday) {
            // Active yesterday - continue streak
            const newStreak = streak + 1;
            setStreak(newStreak);
            setLastActiveDate(today);
            localStorage.setItem(`streak_${user?._id}`, newStreak.toString());
            localStorage.setItem(`lastActive_${user?._id}`, today);
        } else if (!lastActiveDate || lastActiveDate !== today) {
            // First time or streak broken - start new streak
            const newStreak = 1;
            setStreak(newStreak);
            setLastActiveDate(today);
            localStorage.setItem(`streak_${user?._id}`, newStreak.toString());
            localStorage.setItem(`lastActive_${user?._id}`, today);
        }
    };

    // Increment today's progress (call this when user completes a lesson/quiz)
    const incrementTodayProgress = () => {
        const today = new Date().toDateString();
        const newProgress = todayProgress + 1;
        setTodayProgress(newProgress);
        localStorage.setItem(`todayProgress_${user?._id}`, newProgress.toString());
        localStorage.setItem(`todayProgressDate_${user?._id}`, today);

        // Update streak if completing first activity of the day
        if (todayProgress === 0) {
            updateStreak();
        }
    };

    // Save progress with streak update
    const saveProgress = async (newProgress) => {
        setIsSaving(true);
        try {
            setProgress(newProgress);
            localStorage.setItem(`progress_${user?._id}`, newProgress.toString());

            // Increment today's activity
            incrementTodayProgress();

            // Sync to backend if online
            if (isOnline && user?._id) {
                await fetch(`${API}/users/progress/${user._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ progress: newProgress })
                });
            }
        } catch (error) {
            console.error('Progress save error:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Load saved offline video lesson IDs on mount
    useEffect(() => {
        getSavedLessonIds().then(setSavedLessonIds).catch(() => { });
        getOfflineStorageUsed().then(setOfflineUsageBytes).catch(() => { });
    }, []);

    // When opening a lesson, check for offline video first
    useEffect(() => {
        if (activeLesson) {
            setOfflineVideoUrl(null);
            getOfflineVideoUrl(activeLesson._id).then(url => {
                if (url) setOfflineVideoUrl(url);
            }).catch(() => { });
        }
        return () => {
            // Revoke old blob URL to free memory
            if (offlineVideoUrl) URL.revokeObjectURL(offlineVideoUrl);
        };
    }, [activeLesson]);

    const handleDownloadVideo = async (lesson) => {
        const videoUrl = resolveUrl(lesson.compressedContentUrl || lesson.contentUrl);
        if (!videoUrl || downloadingId) return;

        console.log('Downloading video:', videoUrl);
        setDownloadingId(lesson._id);
        setDownloadProgress(0);

        try {
            // Use XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';

            const blob = await new Promise((resolve, reject) => {
                xhr.onprogress = (e) => {
                    if (e.lengthComputable) {
                        setDownloadProgress(Math.round((e.loaded / e.total) * 100));
                    }
                };
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error(`Download failed with status ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error during download'));
                xhr.open('GET', videoUrl);
                xhr.send();
            });

            // Save to IndexedDB
            const { openDB } = await import('idb');
            const db = await openDB('VidyaSetuOfflineDB', 2);
            await db.put('offlineVideos', {
                lessonId: lesson._id,
                blob,
                url: videoUrl,
                savedAt: new Date().toISOString(),
                size: blob.size,
            });

            setSavedLessonIds(prev => [...prev, lesson._id]);
            getOfflineStorageUsed().then(setOfflineUsageBytes).catch(() => { });
            alert('Video downloaded successfully! Available offline now.');
        } catch (e) {
            console.error('Download failed:', e);
            alert(`Download failed: ${e.message}. Make sure you're online and try again.`);
        } finally {
            setDownloadingId(null);
            setDownloadProgress(0);
        }
    };

    const handleDeleteDownload = async (lessonId) => {
        await deleteOfflineVideo(lessonId);
        setSavedLessonIds(prev => prev.filter(id => id !== lessonId));
        getOfflineStorageUsed().then(setOfflineUsageBytes).catch(() => { });
    };

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
        if (lessons && lessons.length > 0) {
            // Pick a lesson to resume. Let's pick the first one as the active lesson for now.
            setActiveLesson(lessons[0]);
            setLessonProgress(0); // Optional: if lesson progress was saved individually, we would resume here
        }
    };

    const handleQuizSubmit = async () => {
        if (!activeQuiz) return;
        const answerArr = activeQuiz.questions.map((q, i) => ({ questionId: q._id, answer: answers[i] || '' }));
        const payload = { answers: answerArr };

        let finalScore = 0;
        try {
            if (!isOnline) throw new Error('Offline mode - caching locally');
            const res = await fetch(`${API}/quizzes/${activeQuiz._id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await res.json();
            finalScore = result.percentage || 0;
            setQuizResult({ ...result, quiz: activeQuiz });
        } catch (e) {
            import('../offline/syncQueue').then(({ enqueue }) => {
                enqueue({ method: 'POST', url: `${API}/quizzes/${activeQuiz._id}/submit`, body: payload });
            });
            let score = 0;
            activeQuiz.questions.forEach((q, i) => { if (answers[i] === q.correctAnswer) score += q.points; });
            finalScore = Math.round((score / activeQuiz.questions.reduce((a, q) => a + q.points, 0)) * 100);
            setQuizResult({ score, totalPoints: activeQuiz.questions.length, percentage: finalScore, passed: finalScore >= 60, badge: finalScore >= 80 ? '🏅' : '', quiz: activeQuiz });
        }

        // Save progress to database
        if (user?._id) {
            fetch(`${API}/users/progress/${user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newProgressScore: finalScore, chapter: activeQuiz.title })
            }).catch(() => { });

            // Sync real-time performance to Teacher Dashboard
            socket.emit('progress:update', {
                studentId: user._id,
                studentName: user.name,
                score: finalScore,
                chapter: activeQuiz.title
            });
        }

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
        // Use class-specific room
        const standard = user?.standard || '8';
        const roomId = `class-${standard}`;
        socket.emit('chat:send', {
            roomId,
            text: chatInput,
            senderId: user._id,
            senderName: user.name,
            senderRole: 'student'
        });
        setChatInput('');
    };

    const subjects = ['All', 'Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Computer'];
    const filteredLessons = lessons.filter(l => {
        const matchSubject = subjectFilter === 'All' || l.subject === subjectFilter;
        const matchSearch = !lessonSearch || l.title?.toLowerCase().includes(lessonSearch.toLowerCase());
        return matchSubject && matchSearch;
    });
    const answeredCount = Object.keys(answers).filter(k => answers[k]).length;

    const formatBytes = (bytes) => {
        if (bytes == null) return 'Calculating...';
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const value = bytes / (1024 ** i);
        const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
        return `${rounded} ${sizes[i]}`;
    };

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
                    {(activeLesson.compressedContentUrl || activeLesson.contentUrl) ? (() => {
                        // Use offline cached video if available, otherwise resolve server URL
                        const rawUrl = offlineVideoUrl || activeLesson.compressedContentUrl || activeLesson.contentUrl;
                        const videoUrl = resolveUrl(rawUrl);

                        console.log('Video URLs:', {
                            raw: rawUrl,
                            resolved: videoUrl,
                            offline: offlineVideoUrl,
                            compressed: activeLesson.compressedContentUrl,
                            content: activeLesson.contentUrl
                        });

                        // Extract YouTube video ID for direct iframe embed (works reliably on Android WebView)
                        const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
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
                        // Use ReactPlayer for YouTube URLs only
                        const isYouTube = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                        if (isYouTube) {
                            return (
                                <div className="w-full aspect-video bg-black border-b border-white/10">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${isYouTube[1]}?autoplay=1&rel=0&modestbranding=1`}
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
                        // Use native HTML5 video for Cloudinary and direct MP4 URLs
                        return (
                            <div className="w-full bg-black border-b border-white/10">
                                <video
                                    src={videoUrl}
                                    controls
                                    style={{ width: '100%', maxHeight: '320px', display: 'block', margin: '0 auto' }}
                                    onTimeUpdate={(e) => setLessonProgress((e.target.currentTime / e.target.duration) * 100 || 0)}
                                    onError={(e) => {
                                        console.error('Video error:', e.target.error);
                                        console.error('Video URL:', videoUrl);
                                        console.error('Error code:', e.target.error?.code);
                                        console.error('Error message:', e.target.error?.message);
                                    }}
                                    playsInline
                                    crossOrigin="anonymous"
                                    preload="metadata"
                                >
                                    Your browser does not support the video tag.
                                </video>
                                {/* Fallback link for videos that don't play */}
                                <div className="text-center p-3 bg-slate-800/50">
                                    <p className="text-[10px] text-slate-400 mb-2">Having trouble? Try these:</p>
                                    <div className="flex gap-2 justify-center">
                                        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20">
                                            📺 Open in New Tab
                                        </a>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(videoUrl);
                                                alert('Video URL copied! Paste it in a new tab.');
                                            }}
                                            className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-lg hover:bg-violet-500/20"
                                        >
                                            📋 Copy URL
                                        </button>
                                    </div>
                                </div>
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
                                <span className="text-[10px] uppercase font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md">📚 {activeLesson.subject}</span>
                                <span className="text-[10px] uppercase font-bold text-violet-300 bg-violet-500/10 px-2 py-1 rounded-md">🎓 Class {activeLesson.standard}</span>
                                {activeLesson.createdByName && <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md">👨‍🏫 {activeLesson.createdByName}</span>}
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-md">⏱ {activeLesson.duration || 30} mins</span>
                            </div>
                        </div>

                        {activeLesson.description && (
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Description</p>
                                <p className="text-sm text-slate-300 leading-relaxed font-medium">{activeLesson.description}</p>
                            </div>
                        )}

                        {activeLesson.pdfUrl && (
                            <a href={resolveUrl(activeLesson.pdfUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl hover:bg-indigo-600/30 transition-colors">
                                <div className="flex items-center gap-3"><span className="text-2xl">📄</span><div><p className="text-sm font-bold text-indigo-300">Open PDF Notes</p><p className="text-[10px] text-indigo-400/60 font-semibold">{activeLesson.title} Notes</p></div></div>
                                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        )}

                        {/* Offline Download Button */}
                        {isDirectVideo(resolveUrl(activeLesson.compressedContentUrl || activeLesson.contentUrl)) && (
                            savedLessonIds.includes(activeLesson._id) ? (
                                <div className="flex items-center justify-between p-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📥</span>
                                        <div><p className="text-sm font-bold text-emerald-300">Saved for Offline</p><p className="text-[10px] text-emerald-400/60 font-semibold">Available without internet</p></div>
                                    </div>
                                    <button onClick={() => handleDeleteDownload(activeLesson._id)} className="text-[10px] font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">Remove</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleDownloadVideo(activeLesson)}
                                    disabled={!!downloadingId}
                                    className="w-full p-4 bg-violet-600/20 border border-violet-500/30 rounded-2xl hover:bg-violet-600/30 transition-colors text-left disabled:opacity-50"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">📥</span>
                                            <div>
                                                <p className="text-sm font-bold text-violet-300">
                                                    {downloadingId === activeLesson._id ? `Downloading... ${downloadProgress}%` : 'Download for Offline'}
                                                </p>
                                                <p className="text-[10px] text-violet-400/60 font-semibold">Watch even without internet</p>
                                            </div>
                                        </div>
                                        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </div>
                                    {downloadingId === activeLesson._id && (
                                        <div className="w-full bg-slate-700 rounded-full h-1.5 mt-3"><div className="bg-violet-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} /></div>
                                    )}
                                </button>
                            )
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
                    <p className="text-amber-300 text-xs font-bold font-sans">⚡ Offline Mode — Learning from saved content</p>
                    <p className="text-amber-400/60 text-[10px] uppercase font-bold tracking-widest mt-1">Progress will sync when online</p>
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
                    <div className="flex flex-col items-end gap-2 relative">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 bg-slate-800 border border-white/10 rounded-full">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                            {notifications.filter(n => !n.read).length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center px-1">{notifications.filter(n => !n.read).length}</span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* ──── NOTIFICATION PANEL ──── */}
            {showNotifications && (
                <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowNotifications(false)}>
                    <div className="absolute top-16 right-4 w-[calc(100%-2rem)] max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-4 py-3 border-b border-white/5">
                            <h3 className="text-sm font-extrabold text-white">Notifications</h3>
                            {notifications.filter(n => !n.read).length > 0 && (
                                <button onClick={() => {
                                    fetch(`${API}/notifications/read-all`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?._id }) }).catch(() => { });
                                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                }} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">Mark all read</button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                            {notifications.length === 0 && (
                                <div className="p-6 text-center text-slate-500 text-sm font-semibold">No notifications yet</div>
                            )}
                            {notifications.map((notif, i) => (
                                <button key={notif._id || i} className={`w-full text-left px-4 py-3 hover:bg-slate-800/80 transition-colors ${!notif.read ? 'bg-indigo-950/30' : ''}`}
                                    onClick={() => {
                                        // Mark as read
                                        if (!notif.read) {
                                            fetch(`${API}/notifications/${notif._id}/read`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?._id }) }).catch(() => { });
                                            setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n));
                                        }
                                        // Navigate based on type
                                        if (notif.type === 'lesson' && notif.referenceId) {
                                            const lesson = lessons.find(l => l._id === notif.referenceId);
                                            if (lesson) { setActiveLesson(lesson); setLessonProgress(0); }
                                            else { setActiveTab('lessons'); }
                                        } else if (notif.type === 'quiz' && notif.referenceId) {
                                            const quiz = quizzes.find(q => q._id === notif.referenceId);
                                            if (quiz) { setActiveQuiz(quiz); setCurrentQ(0); setAnswers({}); setQuizResult(null); }
                                            else { setActiveTab('quizzes'); }
                                        }
                                        setShowNotifications(false);
                                    }}>
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg mt-0.5">{notif.type === 'lesson' ? '📚' : notif.type === 'quiz' ? '✏️' : notif.type === 'announcement' ? '📢' : '🔔'}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold ${!notif.read ? 'text-white' : 'text-slate-300'} truncate`}>{notif.title}</p>
                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                            <p className="text-[10px] text-slate-600 mt-1 font-semibold">{new Date(notif.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        {!notif.read && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 shrink-0"></div>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="h-40 relative flex items-end p-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                                <div className="relative z-10 w-full">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 px-2 py-1 rounded-md mb-2 inline-block">Current Focus</span>
                                    <h3 className="text-lg font-bold line-clamp-1">{lessons.length > 0 ? lessons[0].title : 'Mathematics: Algebra'}</h3>
                                    <p className="text-xs text-indigo-200 mt-1">{lessons.length > 0 ? lessons[0].subject : 'Chapter 4'}</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between text-sm mb-2"><span className="text-slate-400 font-semibold">Overall Course Progress</span><span className="font-extrabold text-indigo-400">{progress}%</span></div>
                                <div className="w-full bg-slate-700 rounded-full h-2 mb-4 overflow-hidden"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-700 relative" style={{ width: `${progress}%` }} /></div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-bold">{lessons.length > 0 ? 'Pick up where you left off' : 'No lessons available'}</span>
                                    <button onClick={handleContinue} disabled={lessons.length === 0} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 active:scale-95 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-all">Continue →</button>
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
                                        {savedLessonIds.includes(lesson._id) && (
                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">📥 Offline</span>
                                        )}
                                        {!savedLessonIds.includes(lesson._id) && isDirectVideo(resolveUrl(lesson.compressedContentUrl || lesson.contentUrl)) && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDownloadVideo(lesson); }} disabled={!!downloadingId} className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md disabled:opacity-50">
                                                {downloadingId === lesson._id ? `${downloadProgress}%` : '📥 Save'}
                                            </button>
                                        )}
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
                        {/* Chat Header - Class Specific */}
                        <div className="bg-slate-800 rounded-2xl p-4 border border-white/5 mb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-lg">
                                        {user?.standard || '8'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm">Class {user?.standard || '8'} Group</h3>
                                        <p className="text-[11px] text-emerald-400 font-semibold">
                                            🟢 {onlineCount} students & teachers online
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-semibold">Doubts & Discussion</p>
                                    <p className="text-[9px] text-slate-500">{chatMessages.length} messages</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages - Class Chat Room */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 bg-slate-800/30 rounded-2xl p-3 border border-white/5">
                            {chatMessages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-3">💬</div>
                                    <p className="text-sm font-bold text-slate-400">No messages yet</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Start the conversation with your classmates!</p>
                                </div>
                            ) : (
                                <>
                                    {chatMessages.map((msg, i) => {
                                        const isMe = msg.senderId === user._id || msg.senderName === user.name;
                                        const isTeacher = msg.senderRole === 'teacher';
                                        return (
                                            <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] ${isMe ? 'bg-indigo-600 rounded-2xl rounded-tr-sm' : isTeacher ? 'bg-emerald-600/20 border border-emerald-500/30 rounded-2xl rounded-tl-sm' : 'bg-slate-700 rounded-2xl rounded-tl-sm'} p-3 px-4`}>
                                                    {!isMe && (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className={`text-[10px] font-bold ${isTeacher ? 'text-emerald-400' : 'text-indigo-300'}`}>
                                                                {isTeacher ? '👨‍🏫 ' : ''}{msg.senderName}
                                                            </p>
                                                            {isTeacher && (
                                                                <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">TEACHER</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <p className="text-sm">{msg.text}</p>
                                                    <p className="text-[9px] text-white/40 mt-1 text-right">
                                                        {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {typingUser && <p className="text-xs text-slate-500 italic">{typingUser} is typing...</p>}
                                    <div ref={chatEndRef} />
                                </>
                            )}
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2 mt-3">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => {
                                    setChatInput(e.target.value);
                                    // Use class-specific room
                                    const standard = user?.standard || '8';
                                    const section = user?.section || 'A';
                                    const roomId = `class-${standard}${section.toLowerCase()}`;
                                    socket.emit('chat:typing', { roomId, name: user.name });
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                className="flex-1 px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm font-semibold focus:border-indigo-500 outline-none"
                                placeholder="Ask your doubts here..."
                            />
                            <button
                                onClick={sendChat}
                                className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 hover:bg-indigo-500 active:scale-95 transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Chat Info Footer */}
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                            <p className="text-[10px] text-slate-400 text-center">
                                💡 This is a private group for <strong>Class {user?.standard || '8'}</strong> students and teachers.
                                Ask doubts, share notes, and help each other!
                            </p>
                        </div>
                    </div>
                )}

                {/* ──── PROFILE TAB ──── */}
                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        <div className="bg-slate-800 rounded-3xl p-6 border border-white/5 text-center">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-3xl font-extrabold mb-3">{user?.name?.split(' ').map(n => n[0]).join('') || 'U'}</div>
                            <h2 className="text-xl font-bold">{user?.name || 'Student'}</h2>
                            <p className="text-sm text-slate-400 font-semibold mb-4">
                                Class {user?.standard || '8'} · {user?.language || 'English'}
                            </p>
                            <div className="flex gap-2">
                                <span className="flex-1 bg-indigo-500/10 text-indigo-300 py-2 rounded-xl text-xs font-bold uppercase">🌟 {user?.totalPoints || 0} Points</span>
                                <span className="flex-1 bg-emerald-500/10 text-emerald-300 py-2 rounded-xl text-xs font-bold uppercase">🔥 {streak} Day{streak !== 1 ? 's' : ''} Streak</span>
                            </div>
                        </div>

                        {/* Student Details */}
                        <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                            <div className="p-4">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">Student Information</p>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Class</span>
                                        <span className="text-sm font-bold text-slate-200">
                                            {user?.standard ? `Class ${user.standard}` : 'Class 8'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Age</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.age || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Language</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.language || 'English'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Parent/Guardian Details */}
                            <div className="p-4">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">Parent/Guardian Information</p>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Name</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.parentName || 'Not provided'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Occupation</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.parentOccupation || 'Not provided'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Mobile</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.parentMobile || 'Not provided'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Details */}
                            <div className="p-4">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">Account Details</p>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Email</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">School ID</span>
                                        <span className="text-sm font-bold text-slate-200">{user?.schoolId || 'nabha-01'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-400">Offline Storage</span>
                                        <span className="text-sm font-bold text-slate-200">{formatBytes(offlineUsageBytes)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            {user?.address && (
                                <div className="p-4">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Address</p>
                                    <p className="text-sm text-slate-300">{user.address}</p>
                                </div>
                            )}
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={() => {
                                localStorage.removeItem('userInfo');
                                window.location.reload();
                            }}
                            className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-red-400 font-bold text-sm transition-all"
                        >
                            🚪 Logout
                        </button>
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
