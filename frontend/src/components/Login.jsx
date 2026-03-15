import React, { useState } from 'react';
import { API_BASE } from '../config';

const API = `${API_BASE}/users`;

export default function Login({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState('student');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [otpMessage, setOtpMessage] = useState('');
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('serverUrl') || '');
    const [serverSaved, setServerSaved] = useState(false);
    
    // Student registration fields
    const [studentClass, setStudentClass] = useState('');  // Standard (1-12)
    const [section, setSection] = useState('');  // Section (A-E)
    const [age, setAge] = useState('');
    const [parentName, setParentName] = useState('');
    const [parentOccupation, setParentOccupation] = useState('');
    const [parentMobile, setParentMobile] = useState('');
    const [address, setAddress] = useState('');
    
    // Teacher registration fields
    const [teacherSubject, setTeacherSubject] = useState('');
    const [teacherPhone, setTeacherPhone] = useState('');
    const [teacherAge, setTeacherAge] = useState('');
    const [teacherAddress, setTeacherAddress] = useState('');
    const [teacherQualification, setTeacherQualification] = useState('');
    const [teacherExperience, setTeacherExperience] = useState('');

    const handleSaveServer = () => {
        const trimmed = serverUrl.trim().replace(/\/+$/, '');
        if (trimmed) {
            localStorage.setItem('serverUrl', trimmed);
        } else {
            localStorage.removeItem('serverUrl');
        }
        setServerSaved(true);
        setTimeout(() => setServerSaved(false), 2000);
        window.location.reload();
    };

    const handleSendOtp = async () => {
        if (!email) {
            setError('Please enter your email first.');
            return;
        }
        setSendingOtp(true); 
        setError('');
        
        try {
            const res = await fetch(`${API}/send-otp`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ email }) 
            });

            const data = await res.json();

            if (res.ok || data.message?.includes('sent')) {
                setOtpSent(true);
                setOtpMessage(`OTP sent to ${email}`);
                setTimeout(() => setOtpMessage(''), 5000);
            } else {
                setError(data.message || 'Failed to send OTP');
            }
        } catch (err) {
            setError(err.message === 'Failed to fetch' 
                ? 'Network connection refused. Is the server running?' 
                : `Error: ${err.message}`);
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            setError('Please enter a valid 6-digit OTP');
            return;
        }

        setVerifyingOtp(true);
        setError('');

        try {
            const res = await fetch(`${API}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });

            const data = await res.json();

            if (data.verified) {
                setOtpVerified(true);
                setError('');
            } else {
                setError(data.message || 'Invalid OTP');
            }
        } catch (err) {
            setError('Failed to verify OTP. Please try again.');
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); 
        setError('');

        try {
            // For registration: check if OTP is verified
            if (!isLogin && !otpVerified) {
                setError('Please verify your OTP first.');
                setLoading(false);
                return;
            }

            // Backend authentication
            const url = isLogin ? `${API}/login` : `${API}/register`;
            const body = isLogin
                ? { email, password }
                : role === 'teacher'
                    ? { name, email, password, role, otp, subject: teacherSubject, phone: teacherPhone, age: teacherAge, address: teacherAddress, qualification: teacherQualification, experience: teacherExperience }
                    : { name, email, password, role, otp, standard: studentClass, section, age, parentName, parentOccupation, parentMobile, address };

            const res = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(body) 
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('userInfo', JSON.stringify(data));
                
                // Cache credentials locally
                const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                localUsers[email] = { ...data, password };
                localStorage.setItem('registeredUsers', JSON.stringify(localUsers));
                
                onLogin(data);
            } else {
                // Try local cache fallback
                if (isLogin) {
                    const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                    if (localUsers[email] && localUsers[email].password === password) {
                        const cachedUser = localUsers[email];
                        localStorage.setItem('userInfo', JSON.stringify(cachedUser));
                        onLogin(cachedUser);
                        return;
                    }
                }
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            // Offline fallback
            const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
            if (localUsers[email] && localUsers[email].password === password) {
                const cachedUser = localUsers[email];
                localStorage.setItem('userInfo', JSON.stringify(cachedUser));
                onLogin(cachedUser);
                return;
            }

            const cachedUser = localStorage.getItem('userInfo') 
                ? JSON.parse(localStorage.getItem('userInfo')) 
                : null;

            if (email === 'admin@nabha.edu') {
                const dummyAdmin = { _id: 'admin1', name: 'System Admin', email, role: 'admin', token: 'offline-token' };
                localStorage.setItem('userInfo', JSON.stringify(dummyAdmin));
                onLogin(dummyAdmin);
            } else if (email === 'teacher@nabha.edu') {
                const dummyTeacher = { _id: 'teacher1', name: 'Master Ji', email, role: 'teacher', token: 'offline-token' };
                localStorage.setItem('userInfo', JSON.stringify(dummyTeacher));
                onLogin(dummyTeacher);
            } else if (email === 'aarav@student.nabha.edu') {
                const dummyStudent = { _id: 'student1', name: 'Aarav Kumar', email, role: 'student', token: 'offline-token' };
                localStorage.setItem('userInfo', JSON.stringify(dummyStudent));
                onLogin(dummyStudent);
            } else if (cachedUser && cachedUser.email === email) {
                onLogin(cachedUser);
            } else {
                setError('Device is offline. Please use cached account or connect to internet.');
            }
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans p-4">
            <div className="w-full max-w-sm space-y-8">

                {/* Logo */}
                <div className="text-center">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 shadow-lg shadow-indigo-600/30">🎓</div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">Vidya Setu</h1>
                    <p className="text-sm text-slate-400 font-semibold mt-1">Digital Learning · Nabha Rural Schools</p>
                </div>

                {/* Role Toggle */}
                <div className="bg-slate-800 rounded-2xl p-1 flex">
                    <button onClick={() => setRole('student')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${role === 'student' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>🧑‍🎓 Student</button>
                    <button onClick={() => setRole('teacher')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${role === 'teacher' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>👩‍🏫 Teacher</button>
                </div>

                <h2 className="text-lg font-bold text-white text-center">
                    {isLogin 
                        ? 'Sign in to your account' 
                        : role === 'teacher' 
                            ? 'Teacher Registration' 
                            : 'Student Registration'}
                </h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                        <p className="text-red-400 text-sm font-semibold">{error}</p>
                    </div>
                )}

                {otpMessage && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                        <p className="text-emerald-400 text-sm font-semibold">✓ {otpMessage}</p>
                        <p className="text-emerald-400/70 text-xs mt-1">Check your inbox for the OTP code</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isLogin ? (
                        <>
                            <div>
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">{role === 'student' ? 'School ID or Email' : 'Teacher ID or Email'}</label>
                                <input 
                                    type="text" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    required
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors" 
                                    placeholder={role === 'student' ? 'School ID or Email' : 'Teacher ID or Email'} 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Password</label>
                                <div className="relative">
                                    <input 
                                        type={showPassword ? 'text' : 'password'} 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        required
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors pr-12" 
                                        placeholder="Password" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)} 
                                        className="absolute right-3 top-3.5 text-slate-500 text-lg"
                                    >
                                        {showPassword ? '🙈' : '👁'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-right">
                                <button type="button" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                                    Forgot password?
                                </button>
                            </p>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${loading ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'}`}
                            >
                                {loading ? <span className="animate-pulse">Signing in...</span> : 'Sign In →'}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Step 1: Email */}
                            {!otpSent && (
                                <>
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Email Address</label>
                                        <input 
                                            type="email" 
                                            value={email} 
                                            onChange={e => setEmail(e.target.value)} 
                                            required 
                                            disabled={otpSent}
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors disabled:opacity-50" 
                                            placeholder="Enter your email" 
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleSendOtp} 
                                        disabled={sendingOtp}
                                        className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${sendingOtp ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'}`}
                                    >
                                        {sendingOtp ? <span className="animate-pulse">Sending OTP...</span> : 'Send OTP →'}
                                    </button>
                                </>
                            )}

                            {/* Step 2: Verify OTP */}
                            {otpSent && !otpVerified && (
                                <>
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 block mb-1.5">Enter 6-Digit OTP</label>
                                        <input 
                                            type="text" 
                                            value={otp} 
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} 
                                            maxLength="6"
                                            className="w-full bg-slate-800 border border-emerald-500/50 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-emerald-500 outline-none transition-colors tracking-widest text-center" 
                                            placeholder="123456" 
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleVerifyOtp} 
                                        disabled={verifyingOtp || otp.length !== 6}
                                        className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${verifyingOtp || otp.length !== 6 ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'}`}
                                    >
                                        {verifyingOtp ? <span className="animate-pulse">Verifying...</span> : 'Verify OTP ✓'}
                                    </button>
                                </>
                            )}

                            {/* Step 3: Complete Registration */}
                            {otpVerified && (
                                <>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                        <p className="text-emerald-400 text-sm font-semibold">✓ Email Verified</p>
                                    </div>
                                    
                                    {role === 'teacher' ? (
                                        <>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Teacher Details</p>
                                            
                                            <div>
                                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Full Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    required
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="Enter your full name"
                                                />
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Teaching Subject <span className="text-red-500">*</span></label>
                                                    <select
                                                        value={teacherSubject}
                                                        onChange={e => setTeacherSubject(e.target.value)}
                                                        required
                                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    >
                                                        <option value="">Select Subject</option>
                                                        <option value="Mathematics">Mathematics</option>
                                                        <option value="Science">Science</option>
                                                        <option value="English">English</option>
                                                        <option value="History">History</option>
                                                        <option value="Social Science">Social Science</option>
                                                        <option value="Hindi">Hindi</option>
                                                        <option value="Punjabi">Punjabi</option>
                                                        <option value="Computer">Computer</option>
                                                        <option value="Digital Literacy">Digital Literacy</option>
                                                        <option value="Physics">Physics</option>
                                                        <option value="Chemistry">Chemistry</option>
                                                        <option value="Biology">Biology</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Age <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="number"
                                                        value={teacherAge}
                                                        onChange={e => setTeacherAge(e.target.value)}
                                                        required
                                                        min="21"
                                                        max="65"
                                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                        placeholder="Age"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                                                <input
                                                    type="tel"
                                                    value={teacherPhone}
                                                    onChange={e => setTeacherPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                    pattern="[0-9]{10}"
                                                    required
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="10-digit mobile number"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Qualification</label>
                                                <input
                                                    type="text"
                                                    value={teacherQualification}
                                                    onChange={e => setTeacherQualification(e.target.value)}
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="e.g., B.Ed, M.Sc, M.A"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Teaching Experience</label>
                                                <input
                                                    type="text"
                                                    value={teacherExperience}
                                                    onChange={e => setTeacherExperience(e.target.value)}
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="e.g., 5 years, Fresher"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Address</label>
                                                <textarea
                                                    value={teacherAddress}
                                                    onChange={e => setTeacherAddress(e.target.value)}
                                                    rows="2"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors resize-none"
                                                    placeholder="Enter residential address"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Student Details</p>
                                            
                                            <div>
                                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Full Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    required
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="Enter student's full name"
                                                />
                                            </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Class <span className="text-red-500">*</span></label>
                                            <select
                                                value={studentClass}
                                                onChange={e => setStudentClass(e.target.value)}
                                                required
                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                            >
                                                <option value="">Select</option>
                                                <option value="1">Class 1</option>
                                                <option value="2">Class 2</option>
                                                <option value="3">Class 3</option>
                                                <option value="4">Class 4</option>
                                                <option value="5">Class 5</option>
                                                <option value="6">Class 6</option>
                                                <option value="7">Class 7</option>
                                                <option value="8">Class 8</option>
                                                <option value="9">Class 9</option>
                                                <option value="10">Class 10</option>
                                                <option value="11">Class 11</option>
                                                <option value="12">Class 12</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Section <span className="text-red-500">*</span></label>
                                            <select
                                                value={section}
                                                onChange={e => setSection(e.target.value)}
                                                required
                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                            >
                                                <option value="">Select</option>
                                                <option value="A">Section A</option>
                                                <option value="B">Section B</option>
                                                <option value="C">Section C</option>
                                                <option value="D">Section D</option>
                                                <option value="E">Section E</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Age <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                value={age}
                                                onChange={e => setAge(e.target.value)}
                                                required
                                                min="5"
                                                max="18"
                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                                placeholder="Age"
                                            />
                                        </div>
                                    </div>
                                    
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Parent/Guardian Details</p>
                                    
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Parent/Guardian Name</label>
                                        <input
                                            type="text"
                                            value={parentName}
                                            onChange={e => setParentName(e.target.value)}
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                            placeholder="Enter parent/guardian name"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Parent/Guardian Occupation</label>
                                        <input
                                            type="text"
                                            value={parentOccupation}
                                            onChange={e => setParentOccupation(e.target.value)}
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                            placeholder="e.g., Farmer, Teacher, Business"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Parent/Guardian Mobile Number</label>
                                        <input
                                            type="tel"
                                            value={parentMobile}
                                            onChange={e => setParentMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            pattern="[0-9]{10}"
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors"
                                            placeholder="10-digit mobile number"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Address</label>
                                        <textarea
                                            value={address}
                                            onChange={e => setAddress(e.target.value)}
                                            rows="2"
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors resize-none"
                                            placeholder="Enter residential address"
                                        />
                                    </div>
                                        </>
                                    )}
                                    
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Password <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                required
                                                minLength="6"
                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors pr-12"
                                                placeholder="Create a password (min 6 characters)"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3.5 text-slate-500 text-lg"
                                            >
                                                {showPassword ? '🙈' : '👁'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${loading ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'}`}
                                    >
                                        {loading ? <span className="animate-pulse">Creating Account...</span> : 'Create Account ✓'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </form>

                <p className="text-center text-sm text-slate-400 font-semibold">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setOtpSent(false);
                            setOtp('');
                            setOtpVerified(false);
                            setName('');
                            setStudentClass('');
                            setSection('');
                            setAge('');
                            setParentName('');
                            setParentOccupation('');
                            setParentMobile('');
                            setAddress('');
                            setPassword('');
                            setTeacherSubject('');
                            setTeacherPhone('');
                            setTeacherAge('');
                            setTeacherAddress('');
                            setTeacherQualification('');
                            setTeacherExperience('');
                        }}
                        className="text-indigo-400 font-bold hover:text-indigo-300"
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>

                {/* Language Footer */}
                <p className="text-center text-xs text-slate-500 font-semibold">Supports English · ਪੰਜਾਬੀ · हिंदी</p>

                {/* Server Configuration */}
                <div className="pt-2">
                    <button 
                        onClick={() => setShowServerConfig(!showServerConfig)} 
                        className="w-full text-center text-[11px] text-slate-500 font-semibold hover:text-slate-300 transition-colors"
                    >
                        {showServerConfig ? '▾ Hide Server Settings' : '⚙ Server Settings'}
                        {localStorage.getItem('serverUrl') && !showServerConfig && (
                            <span className="text-emerald-500 ml-1">● Connected</span>
                        )}
                    </button>
                    {showServerConfig && (
                        <div className="mt-3 bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Server URL</p>
                            <input
                                type="url"
                                value={serverUrl}
                                onChange={e => setServerUrl(e.target.value)}
                                placeholder="http://192.168.x.x:5001"
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold text-sm focus:border-indigo-500 outline-none"
                            />
                            <button 
                                onClick={handleSaveServer} 
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white active:scale-95 transition-all"
                            >
                                {serverSaved ? '✓ Saved — Reloading...' : 'Save & Reconnect'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Institution Footer */}
                <p className="text-center text-[10px] text-slate-600 font-semibold">SIH2025 · Matrusri Engineering College</p>
            </div>
        </div>
    );
}
