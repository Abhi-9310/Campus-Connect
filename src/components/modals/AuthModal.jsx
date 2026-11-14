import React, { useState, useEffect } from 'react';
import { 
  X, 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  GraduationCap, 
  Sparkles, 
  AlertCircle,
  Share2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BRANCHES, ACADEMIC_YEARS } from '../../data/seedStudents';

export default function AuthModal() {
  const { 
    authModalOpen, 
    authModalMessage, 
    closeAuthModal, 
    loginWithCredentials, 
    registerWithCredentials, 
    loginWithGoogle 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBranch, setRegBranch] = useState(BRANCHES[1]);
  const [regYear, setRegYear] = useState(ACADEMIC_YEARS[1]);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && authModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  // Reset form when modal opens
  useEffect(() => {
    if (authModalOpen) {
      setError(null);
      setLoading(false);
    }
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      await loginWithCredentials(loginEmail.trim(), loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!regEmail.trim()) {
      setError('Please enter a valid collegiate email.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      await registerWithCredentials({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        branch: regBranch,
        year: regYear
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Dialog */}
      <div 
        className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden z-10 border border-[#E7EAF0] animate-in zoom-in-95 duration-200"
      >
        {/* Top Header */}
        <div 
          className="p-6 text-white relative"
          style={{ 
            background: 'linear-gradient(135deg, #0F1B3D 0%, #18284F 60%, #2B3B6D 100%)' 
          }}
        >
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Dismiss dialogue"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#18284F] flex items-center justify-center border border-[#FFC93C]/40">
              <Share2 className="w-4 h-4 text-[#FFC93C]" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-wider">CAMPUS </span>
              <span className="font-extrabold text-sm text-[#FFC93C] tracking-wider">CONNECT</span>
            </div>
          </div>

          <h3 className="text-base md:text-lg font-bold text-white mt-1">
            {activeTab === 'login' ? 'Welcome Back!' : 'Join Campus Connect'}
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {authModalMessage || 'Please log in or create an account to connect with students.'}
          </p>
        </div>

        {/* Tab Switcher: Log In vs Create Account */}
        <div className="flex border-b border-[#E7EAF0] bg-[#F5F6FA]/50 p-1">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(null); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-[#0F1B3D] shadow-xs'
                : 'text-[#747D91] hover:text-[#18233F]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(null); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-[#0F1B3D] shadow-xs'
                : 'text-[#747D91] hover:text-[#18233F]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1">
                  Collegiate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#747D91] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. sarah.jenkins@campus.edu"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#747D91] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{loading ? 'Authenticating...' : 'Log In & Continue'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#747D91] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Maya Chen"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1">
                  Collegiate Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#747D91] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. maya.chen@campus.edu"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1">
                  Password (min 6 characters) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#747D91] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#18233F] mb-1">Branch</label>
                  <select
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F]"
                  >
                    {BRANCHES.filter(b => b !== 'All Branches').map(b => (
                      <option key={b} value={b}>{b.split('&')[0]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#18233F] mb-1">Year</label>
                  <select
                    value={regYear}
                    onChange={(e) => setRegYear(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F]"
                  >
                    {ACADEMIC_YEARS.filter(y => y !== 'All Years').map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{loading ? 'Creating Account...' : 'Register & Continue'}</span>
              </button>
            </form>
          )}

          {/* Google Sign In option */}
          <div className="mt-4 pt-3 border-t border-[#E7EAF0]">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E7EAF0] text-xs font-semibold text-[#18233F] flex items-center justify-center gap-2 transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFC93C]" />
              <span>Continue with Google Sign-In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
