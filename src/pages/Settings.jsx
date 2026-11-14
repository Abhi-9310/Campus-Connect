import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Info, 
  LogOut, 
  Check, 
  Globe, 
  Share2, 
  Sparkles,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { currentUser, firebaseUser, logout, loginWithGoogle } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileDiscoverable, setProfileDiscoverable] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const handleToggleDiscoverable = () => {
    setProfileDiscoverable(!profileDiscoverable);
    setToastMessage(`Profile discoverability ${!profileDiscoverable ? 'enabled' : 'restricted'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    setToastMessage(`Campus message alerts ${!notificationsEnabled ? 'enabled' : 'disabled'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Toast alert */}
      {toastMessage && (
        <div className="p-3 bg-[#0F1B3D] text-[#FFC93C] rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-md animate-in fade-in">
          <Check className="w-4 h-4 text-[#FFC93C]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Account Info */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E7EAF0] shadow-xs">
        <h3 className="text-base font-bold text-[#18233F] mb-1 flex items-center gap-2">
          <User className="w-4 h-4 text-[#0F1B3D]" />
          Account Information
        </h3>
        <p className="text-xs text-[#747D91] mb-5">
          Student credentials and primary collegiate contact details
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0]">
            <span className="text-[11px] font-semibold text-[#747D91] block">Full Name</span>
            <span className="text-sm font-bold text-[#18233F] mt-0.5 block">{currentUser?.name}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0]">
            <span className="text-[11px] font-semibold text-[#747D91] block">Collegiate Email</span>
            <span className="text-sm font-bold text-[#18233F] mt-0.5 block truncate">{currentUser?.email}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0]">
            <span className="text-[11px] font-semibold text-[#747D91] block">Academic Branch</span>
            <span className="text-sm font-bold text-[#18233F] mt-0.5 block">{currentUser?.branch}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0]">
            <span className="text-[11px] font-semibold text-[#747D91] block">Academic Year</span>
            <span className="text-sm font-bold text-[#18233F] mt-0.5 block">{currentUser?.year}</span>
          </div>
        </div>
      </div>

      {/* Profile Preferences */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E7EAF0] shadow-xs">
        <h3 className="text-base font-bold text-[#18233F] mb-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#0F1B3D]" />
          Profile & Campus Visibility
        </h3>
        <p className="text-xs text-[#747D91] mb-5">
          Control how other students discover your technical skills and profile
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0]">
            <div>
              <h4 className="text-xs font-bold text-[#18233F]">Campus Student Discovery</h4>
              <p className="text-[11px] text-[#747D91] mt-0.5">
                Allow students across campus to discover you in skill searches
              </p>
            </div>
            <button
              onClick={handleToggleDiscoverable}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                profileDiscoverable ? 'bg-[#0F1B3D]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-[#FFC93C] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profileDiscoverable ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0]">
            <div>
              <h4 className="text-xs font-bold text-[#18233F]">Message Notifications</h4>
              <p className="text-[11px] text-[#747D91] mt-0.5">
                Receive live alerts when students message or connect with you
              </p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                notificationsEnabled ? 'bg-[#0F1B3D]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-[#FFC93C] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Application & Support */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E7EAF0] shadow-xs">
        <h3 className="text-base font-bold text-[#18233F] mb-1 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#0F1B3D]" />
          About Campus Connect
        </h3>
        <p className="text-xs text-[#747D91] mb-5">
          Application architecture and college minor project details
        </p>

        <div className="space-y-3 text-xs text-[#18233F]">
          <div className="flex justify-between py-2 border-b border-[#E7EAF0]">
            <span className="text-[#747D91]">Application Version</span>
            <span className="font-bold">v1.0.0 (Phase 1 Ready)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#E7EAF0]">
            <span className="text-[#747D91]">Project Tagline</span>
            <span className="font-semibold text-[#0F1B3D]">"Find Your People. Share Your Skills. Grow Together."</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#E7EAF0]">
            <span className="text-[#747D91]">Data Persistence</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              <span>Google Firebase Firestore & Auth</span>
            </span>
          </div>
        </div>
      </div>

      {/* Security & Logout */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E7EAF0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#18233F] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF6B5B]" />
            Session Security
          </h3>
          <p className="text-xs text-[#747D91] mt-0.5">
            Log out from your current session on this device.
          </p>
        </div>

        <button
          onClick={logout}
          className="px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center gap-2 border border-red-200 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
