import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import socket from '../socket';
import { API_BASE } from '../config';

const API = API_BASE;

export default function TeacherDashboard({ user }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [students, setStudents] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [onlineCount, setOnlineCount] = useState(0);
    const [isClassLive, setIsClassLive] = useState(false);
    const [activityFeed, setActivityFeed] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Upload State
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadType, setUploadType] = useState('');

    // Lesson Builder State
    const [showLessonBuilder, setShowLessonBuilder] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);
    const [lessonForm, setLessonForm] = useState({ title: '', subject: 'Mathematics', grade: '8', language: 'English', description: '', contentUrl: '', pdfUrl: '', duration: 30, isPublished: false, isDownloadable: true, tags: '' });

    // Analytics State
    const [analyticsFilter, setAnalyticsFilter] = useState({ grade: 'All', subject: 'All' });
    const [searchStudent, setSearchStudent] = useState('');

    // Quiz Builder State
    const [showQuizBuilder, setShowQuizBuilder] = useState(false);
    const [quizForm, setQuizForm] = useState({ title: '', subject: 'Mathematics', grade: '8', language: 'English', timeLimit: 900, passingScore: 60, badgeAwarded: '⭐', questions: [] });
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [qForm, setQForm] = useState({ questionText: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', points: 1, explanation: '' });
    const [previewMode, setPreviewMode] = useState(false);

    // Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    const [announcement, setAnnouncement] = useState({ title: '', body: '' });
    const chatEndRef = useRef(null);

    useEffect(() => {
        socket.emit('join_class', 'class-8a');
        socket.on('update_teacher_dashboard', (data) => {
            setStudents(prev => {
                const idx = prev.findIndex(s => s.studentId === data.studentId);
                if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...copy[idx], score: data.score, status: 'online' }; return copy; }
                return [...prev, { studentId: data.studentId, studentName: data.studentName, score: data.score, status: 'online', chapter: data.chapter }];
            });
            setActivityFeed(prev => [{ text: `${data.studentName} progressed to ${data.score}% in ${data.chapter}`, time: Date.now() }, ...prev].slice(0, 20));
        });
        socket.on('presence:online_count', (data) => setOnlineCount(data.count));
        socket.on('presence:user_joined', (data) => setActivityFeed(prev => [{ text: `${data.name} joined the class`, time: Date.now() }, ...prev].slice(0, 20)));
        socket.on('chat:message', (msg) => setChatMessages(prev => {
            if (prev.some(m => m._id === msg._id)) return prev;
            return [...prev, msg];
        }));
        socket.on('quiz:submission_received', (data) => setActivityFeed(prev => [{ text: `A student submitted their quiz`, time: Date.now() }, ...prev].slice(0, 20)));

        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        fetch(`${API}/lessons`).then(r => r.json()).then(setLessons).catch(() => { });
        fetch(`${API}/quizzes`).then(r => r.json()).then(setQuizzes).catch(() => { });
        fetch(`${API}/chat/class-8a`).then(r => r.json()).then(setChatMessages).catch(() => { });

        // Seed some demo students
        setStudents([
            { studentId: 's1', studentName: 'Aarav Sharma', score: 72, status: 'online', chapter: 'Math Ch.4' },
            { studentId: 's2', studentName: 'Simran Kaur', score: 88, status: 'online', chapter: 'Math Ch.5' },
            { studentId: 's3', studentName: 'Ravi Singh', score: 45, status: 'offline', chapter: 'Math Ch.3' },
            { studentId: 's4', studentName: 'Priya Patel', score: 91, status: 'online', chapter: 'Math Ch.5' },
            { studentId: 's5', studentName: 'Gurpreet Kaur', score: 65, status: 'offline', chapter: 'Math Ch.4' },
        ]);

        return () => {
            socket.off('chat:message');
            socket.off('update_teacher_dashboard');
            socket.off('presence:online_count');
            socket.off('presence:user_joined');
            socket.off('quiz:submission_received');
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

    const handleStartClass = () => { setIsClassLive(true); socket.emit('class:start', { roomId: 'class-8a', teacherName: user?.name, subject: 'Mathematics' }); };
    const handleEndClass = () => { if (confirm('End the live class session?')) { setIsClassLive(false); socket.emit('class:end', { roomId: 'class-8a' }); } };

    const handleFileUpload = async (file, type) => {
        setIsUploading(true); setUploadType(type); setUploadProgress(0);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
            await new Promise((resolve, reject) => {
                xhr.onload = () => { const data = JSON.parse(xhr.responseText); setLessonForm(prev => ({ ...prev, [type === 'video' ? 'contentUrl' : 'pdfUrl']: data.fileUrl })); resolve(); };
                xhr.onerror = reject;
                xhr.open('POST', `${API}/upload`); xhr.send(formData);
            });
        } catch (e) { alert('Upload failed'); }
        setIsUploading(false); setUploadProgress(0); setUploadType('');
    };

    const handleCreateLesson = async () => {
        if (!lessonForm.title || lessonForm.title.length < 3) { alert('Title must be at least 3 characters'); return; }
        try {
            const tags = lessonForm.tags ? lessonForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
            const method = editingLesson ? 'PUT' : 'POST';
            const url = editingLesson ? `${API}/lessons/${editingLesson._id}` : `${API}/lessons`;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lessonForm, tags, createdBy: user?._id }) });
            const saved = await res.json();
            if (editingLesson) { setLessons(prev => prev.map(l => l._id === saved._id ? saved : l)); } else { setLessons(prev => [saved, ...prev]); }
            setShowLessonBuilder(false); setEditingLesson(null);
            setLessonForm({ title: '', subject: 'Mathematics', grade: '8', language: 'English', description: '', contentUrl: '', pdfUrl: '', duration: 30, isPublished: false, isDownloadable: true, tags: '' });
        } catch (e) { alert('Failed to save'); }
    };

    const handleDeleteLesson = async (id) => {
        if (!confirm('Delete this lesson permanently?')) return;
        try { await fetch(`${API}/lessons/${id}`, { method: 'DELETE' }); setLessons(prev => prev.filter(l => l._id !== id)); } catch (e) { alert('Delete failed'); }
    };

    const handleTogglePublish = async (lesson) => {
        try {
            const res = await fetch(`${API}/lessons/${lesson._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lesson, isPublished: !lesson.isPublished }) });
            const updated = await res.json();
            setLessons(prev => prev.map(l => l._id === updated._id ? updated : l));
        } catch (e) { alert('Update failed'); }
    };

    const handleEditLesson = (lesson) => {
        setEditingLesson(lesson);
        setLessonForm({ ...lesson, tags: (lesson.tags || []).join(', ') });
        setShowLessonBuilder(true);
    };

    const exportCSV = () => {
        const rows = [['Name', 'Chapter', 'Score', 'Status']];
        students.forEach(s => rows.push([s.studentName, s.chapter, s.score + '%', s.status]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'class_analytics.csv'; a.click();
    };

    const handleCreateQuiz = async (launchLive = false) => {
        const totalPoints = quizForm.questions.reduce((a, q) => a + q.points, 0);
        try {
            const res = await fetch(`${API}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...quizForm, totalPoints, createdBy: user?._id }) });
            const newQuiz = await res.json();
            setQuizzes(prev => [newQuiz, ...prev]);
            setShowQuizBuilder(false);
            if (launchLive) launchLiveQuiz(newQuiz);
        } catch (e) { alert('Failed to save'); }
    };

    const saveQuestion = () => {
        if (editingQuestion !== null) {
            const newQuestions = [...quizForm.questions];
            newQuestions[editingQuestion] = { ...qForm };
            setQuizForm(prev => ({ ...prev, questions: newQuestions }));
            setEditingQuestion(null);
        } else {
            setQuizForm(prev => ({ ...prev, questions: [...prev.questions, { ...qForm }] }));
        }
        setQForm({ questionText: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', points: 1, explanation: '' });
    };

    const sendChat = () => {
        if (!chatInput.trim()) return;
        socket.emit('chat:send', { roomId: 'class-8a', text: chatInput, senderId: user?._id, senderName: user?.name || 'Teacher', senderRole: 'teacher' });
        setChatInput('');
    };

    const handleBroadcast = () => {
        if (!announcement.title.trim() || !announcement.body.trim()) return;
        socket.emit('class:announce', { roomId: 'class-8a', title: announcement.title, body: announcement.body });
        setChatMessages(prev => [...prev, { _id: `ann-${Date.now()}`, senderName: user?.name, senderRole: 'teacher', text: `📢 ${announcement.title}: ${announcement.body}`, type: 'announcement', timestamp: new Date() }]);
        setShowAnnouncement(false);
        setAnnouncement({ title: '', body: '' });
    };

    const launchLiveQuiz = (quiz) => { socket.emit('quiz:start', { roomId: 'class-8a', quizId: quiz._id, quiz }); alert(`Quiz "${quiz.title}" launched to all students!`); };

    const avgScore = students.length > 0 ? Math.round(students.reduce((a, s) => a + s.score, 0) / students.length) : 0;
    const onlineStudents = students.filter(s => s.status === 'online').length;
    const relativeTime = (t) => { const s = Math.floor((Date.now() - t) / 1000); if (s < 60) return `${s}s ago`; return `${Math.floor(s / 60)}m ago`; };

    // ──── LESSON BUILDER MODAL ────
    if (showLessonBuilder) {
        return (
            <div className="min-h-screen bg-slate-950 text-white font-sans max-w-md mx-auto p-5 pb-24">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => { setShowLessonBuilder(false); setEditingLesson(null); }} className="text-sm font-bold text-slate-400">← Back</button>
                    <h2 className="text-lg font-extrabold">{editingLesson ? 'Edit Lesson' : 'New Lesson'}</h2>
                    <div className="w-12"></div>
                </div>
                {editingLesson && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4"><p className="text-xs font-bold text-amber-300">⚠️ Editing a live lesson — changes will apply immediately</p></div>}
                <div className="space-y-4">
                    {/* Title */}
                    <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Title *</label><input value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} className="w-full p-3.5 bg-slate-800 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" placeholder="Lesson title..." />{lessonForm.title && lessonForm.title.length < 3 && <p className="text-[10px] text-red-400 mt-1">Min 3 characters</p>}</div>
                    {/* Subject / Grade / Language */}
                    <div className="grid grid-cols-3 gap-3">
                        {[['subject', ['Mathematics', 'Science', 'English', 'History', 'Digital Literacy']], ['grade', ['6', '7', '8', '9', '10']], ['language', ['English', 'Punjabi', 'Hindi']]].map(([field, opts]) => (
                            <div key={field}><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">{field}</label><select value={lessonForm[field]} onChange={e => setLessonForm({ ...lessonForm, [field]: e.target.value })} className="w-full p-3 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-semibold focus:border-indigo-500 outline-none">{opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                        ))}
                    </div>
                    {/* Description */}
                    <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Description *</label><textarea value={lessonForm.description} onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })} rows={3} maxLength={500} className="w-full p-3.5 bg-slate-800 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none resize-none" placeholder="Brief lesson description..." /><p className="text-[10px] text-slate-600 text-right mt-0.5">{(lessonForm.description || '').length}/500</p></div>
                    {/* Tags */}
                    <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Tags</label><input value={lessonForm.tags} onChange={e => setLessonForm({ ...lessonForm, tags: e.target.value })} className="w-full p-3.5 bg-slate-800 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" placeholder="fractions, math, punjabi (comma-separated)" /></div>
                    {/* Video Upload */}
                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/10 space-y-3">
                        <p className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">📹 Video Content</p>
                        <label className="block w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-center text-xs font-bold cursor-pointer transition-colors">
                            {isUploading && uploadType === 'video' ? `Uploading... ${uploadProgress}%` : '📎 Upload Video (mp4, max 500MB)'}
                            <input type="file" accept="video/mp4" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'video')} />
                        </label>
                        {isUploading && uploadType === 'video' && <div className="w-full bg-slate-700 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>}
                        <p className="text-[10px] text-slate-600 font-semibold text-center">— or paste a URL —</p>
                        <input value={lessonForm.contentUrl} onChange={e => setLessonForm({ ...lessonForm, contentUrl: e.target.value })} className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" placeholder="YouTube or direct video URL..." />
                        {lessonForm.contentUrl && <p className="text-[10px] text-emerald-400 font-bold">✓ Video attached</p>}
                    </div>
                    {/* PDF Upload */}
                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/10 space-y-3">
                        <p className="text-xs font-extrabold text-violet-400 uppercase tracking-wider">📄 PDF Notes (optional)</p>
                        <label className="block w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-center text-xs font-bold cursor-pointer transition-colors">
                            {isUploading && uploadType === 'pdf' ? `Uploading... ${uploadProgress}%` : '📎 Upload PDF (max 20MB)'}
                            <input type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'pdf')} />
                        </label>
                        {isUploading && uploadType === 'pdf' && <div className="w-full bg-slate-700 rounded-full h-2"><div className="bg-violet-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>}
                        <input value={lessonForm.pdfUrl} onChange={e => setLessonForm({ ...lessonForm, pdfUrl: e.target.value })} className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" placeholder="Or paste PDF URL..." />
                        {lessonForm.pdfUrl && <p className="text-[10px] text-emerald-400 font-bold">✓ PDF attached</p>}
                    </div>
                    {/* Linked Quiz */}
                    <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Linked Quiz</label><select value={lessonForm.quizId || ''} onChange={e => setLessonForm({ ...lessonForm, quizId: e.target.value })} className="w-full p-3 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-semibold focus:border-indigo-500 outline-none"><option value="">None</option>{quizzes.map(q => <option key={q._id} value={q._id}>{q.title}</option>)}</select></div>
                    {/* Offline Toggle */}
                    <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-white/10">
                        <span className="text-sm font-bold text-slate-300">Allow Offline Download</span>
                        <button onClick={() => setLessonForm({ ...lessonForm, isDownloadable: !lessonForm.isDownloadable })} className={`w-12 h-7 rounded-full p-1 transition-colors ${lessonForm.isDownloadable ? 'bg-indigo-600' : 'bg-slate-600'}`}><div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${lessonForm.isDownloadable ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => { setLessonForm({ ...lessonForm, isPublished: false }); handleCreateLesson(); }} className="flex-1 py-4 bg-slate-700 text-white font-bold text-sm rounded-xl">{editingLesson ? 'Save Changes' : 'Save as Draft'}</button>
                        <button onClick={() => { setLessonForm({ ...lessonForm, isPublished: true }); handleCreateLesson(); }} disabled={isUploading} className="flex-1 py-4 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40">Publish Now</button>
                    </div>
                </div>
            </div>
        );
    }

    // ──── QUIZ BUILDER MODAL ────
    if (showQuizBuilder) {
        return (
            <div className="min-h-screen bg-slate-950 text-white font-sans max-w-md mx-auto p-5 pb-24 relative">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => setShowQuizBuilder(false)} className="text-sm font-bold text-slate-400">← Back</button>
                    <h2 className="text-lg font-extrabold">Quiz Builder</h2>
                    <button onClick={() => setPreviewMode(!previewMode)} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-slate-700">{previewMode ? 'Exit Preview' : 'Preview'}</button>
                </div>

                {previewMode ? (
                    <div className="space-y-6">
                        <div className="text-center p-6 bg-indigo-900/20 border border-indigo-500/20 rounded-3xl">
                            <h3 className="text-xl font-black mb-2">{quizForm.title || 'Untitled Quiz'}</h3>
                            <div className="flex justify-center gap-3 text-[10px] font-bold text-indigo-400">
                                <span className="flex items-center gap-1">⏱ {Math.floor(quizForm.timeLimit / 60)} min</span>
                                <span className="flex items-center gap-1">🎯 Pass: {quizForm.passingScore}%</span>
                            </div>
                        </div>
                        {quizForm.questions.map((q, i) => (
                            <div key={i} className="bg-slate-900 rounded-3xl p-5 border border-white/5 space-y-4">
                                <p className="text-sm font-bold leading-relaxed"><span className="text-indigo-400 mr-2">Q{i + 1}.</span>{q.questionText}</p>

                                {q.type === 'mcq' && (
                                    <div className="space-y-2">
                                        {q.options.map((opt, oIdx) => (
                                            <button key={oIdx} className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700/80 rounded-2xl border border-white/5 font-semibold text-sm transition-all flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>{opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {q.type === 'true_false' && (
                                    <div className="flex gap-3">
                                        {['True', 'False'].map((opt) => (
                                            <button key={opt} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700/80 rounded-2xl border border-white/5 font-bold text-sm transition-all">{opt}</button>
                                        ))}
                                    </div>
                                )}
                                {q.type === 'fill_blank' && (
                                    <input type="text" placeholder="Type your answer..." className="w-full p-4 bg-slate-800 border-b-2 border-indigo-500/50 rounded-t-xl text-white font-bold text-sm focus:border-indigo-500 outline-none" />
                                )}
                            </div>
                        ))}
                        {quizForm.questions.length === 0 && <p className="text-center text-slate-500 font-bold text-sm py-10">No questions added yet.</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Quiz Title *</label><input value={quizForm.title} onChange={e => setQuizForm({ ...quizForm, title: e.target.value })} className="w-full p-3.5 bg-slate-800 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" placeholder="Quiz title..." /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Time Limit (min)</label><input type="number" value={Math.floor(quizForm.timeLimit / 60)} onChange={e => setQuizForm({ ...quizForm, timeLimit: parseInt(e.target.value || 0) * 60 })} className="w-full p-3 bg-slate-800 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" /></div>
                            <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Passing %</label><input type="number" value={quizForm.passingScore} onChange={e => setQuizForm({ ...quizForm, passingScore: parseInt(e.target.value || 60) })} className="w-full p-3 bg-slate-800 border border-white/10 rounded-xl text-white font-semibold text-sm focus:border-indigo-500 outline-none" /></div>
                        </div>

                        {/* Existing Questions List */}
                        <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Questions ({quizForm.questions.length})</p>
                            {quizForm.questions.map((q, i) => (
                                <div key={i} className={`bg-slate-800 rounded-xl p-3 mb-2 border ${editingQuestion === i ? 'border-indigo-500' : 'border-white/5'} flex items-center justify-between`}>
                                    <div className="flex-1 mr-3"><span className="text-[9px] font-bold uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded mr-2">{q.type === 'true_false' ? 'T/F' : q.type === 'fill_blank' ? 'Blank' : 'MCQ'}</span><span className="text-sm font-semibold">{q.questionText.slice(0, 35)}{q.questionText.length > 35 ? '...' : ''}</span></div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => { setEditingQuestion(i); setQForm({ ...q }); }} className="text-indigo-400 text-[10px] font-extrabold uppercase hover:text-indigo-300">Edit</button>
                                        <button onClick={() => setQuizForm(prev => ({ ...prev, questions: prev.questions.filter((_, idx) => idx !== i) }))} className="text-red-400 text-xs font-bold hover:text-red-300">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Question Editor Panel */}
                        <div className={`bg-slate-800/50 rounded-3xl p-5 border ${editingQuestion !== null ? 'border-amber-500/50' : 'border-white/10'} space-y-4`}>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">{editingQuestion !== null ? `Editing Q${editingQuestion + 1}` : 'Add Question'}</p>
                                {editingQuestion !== null && <button onClick={() => { setEditingQuestion(null); setQForm({ questionText: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', points: 1, explanation: '' }); }} className="text-[9px] text-amber-500 font-extrabold uppercase bg-amber-500/10 px-2 py-1 rounded">Cancel Edit</button>}
                            </div>

                            <div className="flex bg-slate-900 rounded-xl p-1 gap-1">
                                {['mcq', 'true_false', 'fill_blank'].map(t => <button key={t} onClick={() => setQForm({ ...qForm, type: t })} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${qForm.type === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t === 'true_false' ? 'True/False' : t === 'fill_blank' ? 'Fill in Blank' : 'MCQ'}</button>)}
                            </div>

                            <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Question Text</label><textarea rows={2} value={qForm.questionText} onChange={e => setQForm({ ...qForm, questionText: e.target.value })} className="w-full p-3.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm font-semibold focus:border-indigo-500 outline-none resize-none" placeholder="Enter question..." /></div>

                            {qForm.type === 'mcq' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Options (Select Correct)</label>
                                    {qForm.options.map((opt, i) => (
                                        <div key={i} className={`flex gap-3 items-center p-1.5 rounded-xl border ${qForm.correctAnswer === opt && opt !== '' ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent'}`}>
                                            <input type="radio" name="correct" checked={qForm.correctAnswer === opt && opt !== ''} onChange={() => setQForm({ ...qForm, correctAnswer: opt })} className="w-4 h-4 ml-2 accent-indigo-500 cursor-pointer" />
                                            <input value={opt} onChange={e => { const o = [...qForm.options]; o[i] = e.target.value; setQForm({ ...qForm, options: o, correctAnswer: qForm.correctAnswer === opt ? e.target.value : qForm.correctAnswer }); }} className="flex-1 p-2.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs font-semibold focus:border-indigo-500 outline-none" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {qForm.type === 'true_false' && (
                                <div>
                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-2">Correct Answer</label>
                                    <div className="flex gap-3">{['True', 'False'].map(v => <button key={v} onClick={() => setQForm({ ...qForm, correctAnswer: v })} className={`flex-1 py-3.5 rounded-xl font-bold text-sm border-2 transition-all ${qForm.correctAnswer === v ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/30 text-white' : 'bg-slate-900 border-white/10 text-slate-400'}`}>{v}</button>)}</div>
                                </div>
                            )}

                            {qForm.type === 'fill_blank' && <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Correct Answer</label><input value={qForm.correctAnswer} onChange={e => setQForm({ ...qForm, correctAnswer: e.target.value })} className="w-full p-3.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm font-semibold focus:border-indigo-500 outline-none" placeholder="Exact answer match..." /></div>}

                            <div><label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Explanation (Optional)</label><input value={qForm.explanation} onChange={e => setQForm({ ...qForm, explanation: e.target.value })} className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-semibold focus:border-indigo-500 outline-none" placeholder="Shown after student answers..." /></div>

                            <button onClick={saveQuestion} disabled={!qForm.questionText || !qForm.correctAnswer || (qForm.type === 'mcq' && qForm.options.some(o => !o))} className="w-full mt-2 py-3.5 bg-indigo-600 rounded-xl text-sm font-extrabold hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider">
                                {editingQuestion !== null ? 'Update Question' : '+ Add Question'}
                            </button>
                        </div>

                        <div className="flex gap-3 pt-6">
                            <button onClick={() => handleCreateQuiz(false)} disabled={quizForm.questions.length === 0 || !quizForm.title} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm rounded-2xl disabled:opacity-40 transition-colors border border-white/5">Save Quiz</button>
                            <button onClick={() => handleCreateQuiz(true)} disabled={quizForm.questions.length === 0 || !quizForm.title} className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl disabled:opacity-40 transition-colors shadow-lg shadow-emerald-600/20">Launch Live Class Quiz 🚀</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ──── MAIN DASHBOARD ────
    return (
        <div className="bg-slate-950 min-h-screen pb-24 font-sans text-white max-w-md mx-auto relative">

            {/* Header */}
            <header className="bg-slate-900/95 backdrop-blur-md px-5 pt-6 pb-4 sticky top-0 z-20 border-b border-white/5">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center text-sm">🎓</span>
                            <span className="text-lg font-extrabold tracking-tight">Vidya Setu</span>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold">Teacher Dashboard · <span className={`${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>{isOnline ? '🟢' : '🟡'}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="relative p-2 bg-slate-800 border border-white/10 rounded-full"><svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span></button>
                    </div>
                </div>
            </header>

            <main className="px-5 pt-5 space-y-6 pb-4">

                {/* ──── OVERVIEW TAB ──── */}
                {activeTab === 'overview' && (<>
                    {/* Teacher Hero */}
                    <div className="bg-gradient-to-br from-violet-700 to-indigo-800 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full"></div>
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-violet-400/10 rounded-full"></div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-200 mb-1">Teacher Dashboard</p>
                            <h2 className="text-2xl font-extrabold mb-0.5">{user?.name || 'Teacher'}</h2>
                            <p className="text-sm text-violet-200 font-medium mb-4">Mathematics · Class 8A</p>
                            <div className="flex divide-x divide-white/20 text-center">
                                <div className="flex-1"><p className="text-2xl font-black">{students.length}</p><p className="text-[10px] text-violet-200 uppercase font-bold">Students</p></div>
                                <div className="flex-1"><p className="text-2xl font-black text-emerald-300">{onlineStudents}</p><p className="text-[10px] text-violet-200 uppercase font-bold">Online</p></div>
                                <div className="flex-1"><p className="text-2xl font-black">{students.length}</p><p className="text-[10px] text-violet-200 uppercase font-bold">Present</p></div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Avg Quiz Score</p>
                            <p className={`text-3xl font-black ${avgScore >= 70 ? 'text-emerald-400' : avgScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{avgScore}%</p>
                            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div className={`h-1.5 rounded-full ${avgScore >= 70 ? 'bg-emerald-500' : avgScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${avgScore}%` }} /></div>
                        </div>
                        <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Published</p>
                            <p className="text-3xl font-black text-indigo-400">{lessons.filter(l => l.isPublished !== false).length}/{lessons.length}</p>
                            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${lessons.length > 0 ? (lessons.filter(l => l.isPublished !== false).length / lessons.length) * 100 : 0}%` }} /></div>
                        </div>
                    </div>

                    {/* Live Class Control */}
                    {isClassLive ? (
                        <div className="bg-slate-800 rounded-2xl p-5 border border-red-500/20">
                            <div className="flex items-center gap-2 mb-4"><span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span><span className="font-extrabold text-sm text-red-300">LIVE — Class 8A Mathematics</span></div>
                            <p className="text-xs text-slate-400 font-semibold mb-4">{onlineStudents} of {students.length} students online</p>
                            <div className="flex gap-2">
                                <button onClick={() => { if (quizzes.length > 0) launchLiveQuiz(quizzes[0]); }} className="flex-1 py-3 bg-indigo-600 rounded-xl text-xs font-bold">📊 Launch Quiz</button>
                                <button onClick={() => setShowAnnouncement(true)} className="flex-1 py-3 bg-amber-600 rounded-xl text-xs font-bold">📢 Broadcast</button>
                                <button onClick={handleEndClass} className="py-3 px-4 bg-red-600 rounded-xl text-xs font-bold">🛑 End</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={handleStartClass} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-500 active:scale-95 transition-all">▶ Start Live Class</button>
                    )}

                    {/* Announcement Modal */}
                    {showAnnouncement && (
                        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
                            <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4">
                                <h3 className="font-extrabold text-lg">📢 Broadcast Announcement</h3>
                                <input value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white text-sm font-semibold focus:border-indigo-500 outline-none" placeholder="Title..." />
                                <textarea value={announcement.body} onChange={e => setAnnouncement({ ...announcement, body: e.target.value })} rows={3} className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white text-sm font-semibold focus:border-indigo-500 outline-none resize-none" placeholder="Message..." />
                                <div className="flex gap-3"><button onClick={() => setShowAnnouncement(false)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold text-sm">Cancel</button><button onClick={handleBroadcast} className="flex-1 py-3 bg-amber-600 rounded-xl font-bold text-sm">Send to All</button></div>
                            </div>
                        </div>
                    )}

                    {/* Live Roster - Spec 14 */}
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Live Class Roster</p>
                        <div className="bg-slate-800 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                            {students.map((s, i) => (
                                <div key={s.studentId || i} className="flex items-center justify-between p-3.5 hover:bg-slate-700/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">{s.studentName?.split(' ').map(n => n[0]).join('')}</div>
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${s.status === 'online' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                                        </div>
                                        <div><p className="text-sm font-bold">{s.studentName}</p><p className="text-[10px] text-slate-500 font-semibold">{s.chapter || 'Not started'}</p></div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-extrabold ${s.score >= 70 ? 'text-emerald-400' : s.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{s.score}%</p>
                                        <div className="w-16 bg-slate-700 rounded-full h-1 mt-1"><div className={`h-1 rounded-full ${s.score >= 70 ? 'bg-emerald-500' : s.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.score}%` }} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Recent Activity</p>
                        <div className="space-y-2">
                            {activityFeed.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Waiting for student activity...</p>}
                            {activityFeed.slice(0, 8).map((a, i) => (
                                <div key={i} className="bg-slate-800 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                                    <p className="text-xs font-semibold text-slate-300">{a.text}</p>
                                    <span className="text-[10px] text-slate-600 font-bold shrink-0 ml-2">{relativeTime(a.time)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>)}

                {/* ──── LESSONS TAB ──── */}
                {activeTab === 'lessons' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">My Lessons</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setShowQuizBuilder(true)} className="bg-emerald-600 text-white text-xs font-bold py-2.5 px-3 rounded-xl">+ Quiz</button>
                                <button onClick={() => { setEditingLesson(null); setLessonForm({ title: '', subject: 'Mathematics', grade: '8', language: 'English', description: '', contentUrl: '', pdfUrl: '', duration: 30, isPublished: false, isDownloadable: true, tags: '' }); setShowLessonBuilder(true); }} className="bg-indigo-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl">+ Lesson</button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {lessons.map((lesson, i) => (
                                <div key={lesson._id || i} className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${['bg-blue-500/10 text-blue-400', 'bg-emerald-500/10 text-emerald-400', 'bg-purple-500/10 text-purple-400'][i % 3]}`}>{['📐', '🔬', '📖'][i % 3]}</div>
                                            <div><p className="text-sm font-bold">{lesson.title}</p><p className="text-[10px] text-slate-500 font-semibold">{lesson.subject} · {lesson.language || 'English'}</p></div>
                                        </div>
                                        <button onClick={() => handleTogglePublish(lesson)} className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-md cursor-pointer hover:opacity-80 ${lesson.isPublished !== false ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600/30 text-slate-400'}`}>{lesson.isPublished !== false ? 'Published' : 'Draft'}</button>
                                    </div>
                                    {lesson.description && <p className="text-[11px] text-slate-400 mb-2 line-clamp-2">{lesson.description}</p>}
                                    {lesson.tags && lesson.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{(lesson.tags || []).map((t, ti) => <span key={ti} className="text-[9px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full font-bold">{t}</span>)}</div>}
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => handleEditLesson(lesson)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-bold text-slate-300 transition-colors">✏️ Edit</button>
                                        <button onClick={() => setActiveTab('analytics')} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-bold text-slate-300 transition-colors">📊 Analytics</button>
                                        <button onClick={() => handleDeleteLesson(lesson._id)} className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-[10px] font-bold text-red-400 transition-colors">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ──── ANALYTICS TAB ──── */}
                {activeTab === 'analytics' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Class Analytics</h2>
                            <button onClick={exportCSV} className="bg-indigo-600 text-white text-[10px] font-bold py-2 px-3 rounded-lg">📥 Export CSV</button>
                        </div>

                        {/* Filters Row */}
                        <div className="flex gap-2">
                            <select value={analyticsFilter.grade} onChange={e => setAnalyticsFilter({ ...analyticsFilter, grade: e.target.value })} className="flex-1 p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-[10px] font-bold focus:border-indigo-500 outline-none">
                                {['All', '6A', '7A', '8A', '9A', '10A'].map(g => <option key={g} value={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>)}
                            </select>
                            <select value={analyticsFilter.subject} onChange={e => setAnalyticsFilter({ ...analyticsFilter, subject: e.target.value })} className="flex-1 p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-[10px] font-bold focus:border-indigo-500 outline-none">
                                {['All', 'Mathematics', 'Science', 'English'].map(s => <option key={s} value={s}>{s === 'All' ? 'All Subjects' : s}</option>)}
                            </select>
                        </div>

                        {/* Summary Cards — 2x2 grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                <p className="text-[10px] font-extrabold uppercase text-slate-500 mb-1">Avg Quiz Score</p>
                                <p className={`text-3xl font-black ${avgScore >= 70 ? 'text-emerald-400' : avgScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{avgScore}%</p>
                                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div className={`h-1.5 rounded-full ${avgScore >= 70 ? 'bg-emerald-500' : avgScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${avgScore}%` }} /></div>
                            </div>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                <p className="text-[10px] font-extrabold uppercase text-slate-500 mb-1">At-Risk Students</p>
                                <p className="text-3xl font-black text-rose-400">{students.filter(s => s.score < 50).length}</p>
                                <p className="text-[10px] text-slate-500 mt-1">Below 50% quiz avg</p>
                            </div>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                <p className="text-[10px] font-extrabold uppercase text-slate-500 mb-1">Active Students</p>
                                <p className="text-3xl font-black text-violet-400">{onlineStudents}</p>
                                <p className="text-[10px] text-slate-500 mt-1">Active this session</p>
                            </div>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                <p className="text-[10px] font-extrabold uppercase text-slate-500 mb-1">Lessons Published</p>
                                <p className="text-3xl font-black text-indigo-400">{lessons.filter(l => l.isPublished !== false).length}/{lessons.length}</p>
                                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${lessons.length > 0 ? (lessons.filter(l => l.isPublished !== false).length / lessons.length) * 100 : 0}%` }} /></div>
                            </div>
                        </div>

                        {/* Score Distribution — Recharts Bar */}
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Score Distribution</p>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5 h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={students.map(s => ({ name: s.studentName?.split(' ')[0], score: s.score }))}>
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis hide domain={[0, 100]} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} />
                                        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                            {students.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.score >= 70 ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Lesson Completion — Recharts Donut */}
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Lesson Completion</p>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={[{ name: 'Completed', value: 3 }, { name: 'In Progress', value: 2 }, { name: 'Not Started', value: Math.max(0, students.length - 5) }]} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                                                <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#475569" />
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-center gap-4 mt-2">
                                    {[{ label: 'Completed', color: 'bg-emerald-500' }, { label: 'In Progress', color: 'bg-amber-500' }, { label: 'Not Started', color: 'bg-slate-600' }].map(l => (
                                        <div key={l.label} className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${l.color}`} /><span className="text-[10px] text-slate-400 font-semibold">{l.label}</span></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Weekly Activity Heatmap */}
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Weekly Activity Heatmap</p>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-white/5">
                                <div className="grid grid-cols-7 gap-1.5 mb-2">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d} className="text-[8px] text-slate-500 font-bold text-center">{d}</span>)}
                                </div>
                                {[0, 1, 2, 3].map(week => (
                                    <div key={week} className="grid grid-cols-7 gap-1.5 mb-1.5">
                                        {[0, 1, 2, 3, 4, 5, 6].map(day => {
                                            const activity = Math.floor(Math.random() * students.length + 1);
                                            const intensity = activity / students.length;
                                            return <div key={day} className="h-6 rounded-md flex items-center justify-center text-[8px] font-bold text-white/60" style={{ backgroundColor: `rgba(99,102,241,${0.1 + intensity * 0.7})` }} title={`${activity} students active`}>{activity}</div>;
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Per Student Progress Table */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Per-Student Progress</p>
                                <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)} className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-white text-[10px] font-semibold focus:border-indigo-500 outline-none w-32" placeholder="Search..." />
                            </div>
                            <div className="space-y-2">
                                {students.filter(s => s.studentName?.toLowerCase().includes(searchStudent.toLowerCase())).map((s, i) => (
                                    <div key={i} className="bg-slate-800 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">{s.studentName?.split(' ').map(n => n[0]).join('')}</div>
                                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${s.status === 'online' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{s.studentName}</p>
                                                <p className="text-[10px] text-slate-500">{s.chapter}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${s.score >= 70 ? 'bg-emerald-500/10 text-emerald-400' : s.score >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{s.score >= 70 ? '🟢 On Track' : s.score >= 50 ? '🟡 Attention' : '🔴 At Risk'}</span>
                                            <div className="w-16"><div className="w-full bg-slate-700 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${s.score >= 70 ? 'bg-emerald-500' : s.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.score}%` }} /></div></div>
                                            <p className={`text-sm font-extrabold ${s.score >= 70 ? 'text-emerald-400' : s.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{s.score}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ──── CHAT TAB ──── */}
                {activeTab === 'chat' && (
                    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center font-bold text-sm">8A</div>
                                <div><h3 className="font-bold text-sm">Class 8A Chat</h3><p className="text-[11px] text-emerald-400 font-semibold">👥 {onlineCount} online</p></div>
                            </div>
                            <button onClick={() => setShowAnnouncement(true)} className="text-xs font-bold bg-amber-600/20 text-amber-300 px-3 py-1.5 rounded-lg">📢 Broadcast</button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {chatMessages.map((msg, i) => {
                                const isMe = msg.senderRole === 'teacher';
                                if (msg.type === 'announcement') return (
                                    <div key={msg._id || i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                        <p className="text-xs font-bold text-amber-300">📢 {msg.text}</p>
                                    </div>
                                );
                                return (
                                    <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] ${isMe ? 'bg-violet-600 rounded-2xl rounded-tr-sm' : 'bg-slate-700 rounded-2xl rounded-tl-sm'} p-3 px-4`}>
                                            {!isMe && <p className="text-[10px] font-bold text-indigo-300 mb-1">{msg.senderName}</p>}
                                            <p className="text-sm">{msg.text}</p>
                                            <p className="text-[9px] text-white/40 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="flex gap-2 mt-3">
                            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                className="flex-1 px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm font-semibold focus:border-violet-500 outline-none" placeholder="Message your class..." />
                            <button onClick={sendChat} className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center shrink-0 hover:bg-violet-500 active:scale-95"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Nav — Spec 14 */}
            <nav className="fixed bottom-0 w-full max-w-md bg-slate-900/95 backdrop-blur-md border-t border-white/5 z-50">
                <ul className="flex justify-around items-center h-[72px] px-2">
                    {[{ id: 'overview', icon: '📊', label: 'Overview' }, { id: 'lessons', icon: '📋', label: 'Lessons' }, { id: 'analytics', icon: '📈', label: 'Analytics' }, { id: 'chat', icon: '💬', label: 'Chat' }].map(tab => (
                        <li key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center cursor-pointer transition-all ${activeTab === tab.id ? 'text-violet-400' : 'text-slate-500'}`}>
                            {activeTab === tab.id && <div className="w-6 h-0.5 bg-violet-400 rounded-full mb-1"></div>}
                            <span className="text-lg mb-0.5">{tab.icon}</span>
                            <span className={`text-[10px] ${activeTab === tab.id ? 'font-extrabold' : 'font-bold'}`}>{tab.label}</span>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
}
