import React, { useState } from 'react';
import { 
  Menu, 
  LogIn, 
  UserCheck, 
  Bell, 
  Check, 
  CheckCheck, 
  LogOut, 
  Sparkles,
  User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl } from '../../services/socket';

export default function Header({ onOpenMobileMenu }) {
  const { 
    currentUser, 
    activeTab, 
    openAuthModal,
    logout,
    notifications,
    unreadNotificationsCount,
    markAllNotificationsAsRead,
    handleNotificationClick
  } = useAuth();

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Campus Dashboard',
          subtitle: 'Welcome to your collegiate student hub & live feed'
        };
      case 'discover':
        return {
          title: 'Discover Students',
          subtitle: 'Find peers who share your technical skills, branch, and ambitions'
        };
      case 'connections':
        return {
          title: 'My Campus Connections',
          subtitle: 'Manage your verified network of peers and pending invitations'
        };
      case 'messages':
        return {
          title: 'Direct Messages',
          subtitle: 'Private one-to-one communication with your campus peers'
        };
      case 'profile':
        return {
          title: 'My Student Profile',
          subtitle: 'Showcase your technical skills, branch, and personal bio'
        };
      case 'settings':
        return {
          title: 'Account Settings',
          subtitle: 'Preferences, security credentials, and app information'
        };
      default:
        return {
          title: 'Campus Connect',
          subtitle: 'Find your people. Share your skills. Grow together.'
        };
    }
  };

  const pageInfo = getPageInfo();

  const formatNotificationTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E7EAF0] px-4 md:px-8 py-3.5 flex items-center justify-between transition-all">
      {/* Left: Mobile Toggle & Page Info */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-[#18233F] hover:bg-[#F5F6FA] border border-[#E7EAF0] transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg md:text-xl font-bold text-[#18233F] tracking-tight">
            {pageInfo.title}
          </h1>
          <p className="text-xs text-[#747D91] hidden sm:block">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: Notifications & Auth State */}
      <div className="flex items-center gap-2 sm:gap-3">
        {currentUser ? (
          <>
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl border border-[#E7EAF0] bg-[#F5F6FA] hover:bg-slate-100 text-[#18233F] transition-all"
                title="Notifications"
                aria-label="View campus notifications"
              >
                <Bell className="w-4 h-4 text-[#18233F]" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#FF6B5B] text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#E7EAF0] py-2 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-[#E7EAF0] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#18233F] uppercase tracking-wider">
                        Notifications
                      </span>
                      {unreadNotificationsCount > 0 && (
                        <span className="text-[10px] bg-[#FFC93C]/30 text-[#18284F] px-1.5 py-0.5 rounded-md font-bold">
                          {unreadNotificationsCount} unread
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-[#0F1B3D] hover:underline flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E7EAF0]/60">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            handleNotificationClick(notif);
                            setNotificationsOpen(false);
                          }}
                          className={`p-3.5 hover:bg-[#F5F6FA] cursor-pointer transition-colors flex items-start gap-3 ${
                            !notif.isRead ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                            {notif.type === 'new_student_registration' ? '🎉' : '🔔'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#18233F] leading-snug">
                              {notif.message}
                            </p>
                            <span className="text-[10px] text-[#747D91] mt-1 block">
                              {formatNotificationTime(notif.createdAt)}
                            </span>
                          </div>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#FF6B5B] shrink-0 mt-1.5"></span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-8 px-4 text-center">
                        <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-[#18233F]">No notifications yet</p>
                        <p className="text-[11px] text-[#747D91] mt-0.5">
                          You'll be notified automatically whenever a new student joins campus!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Authenticated Student Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#E7EAF0]">
              {currentUser.avatarUrl ? (
                <img 
                  src={resolveAssetUrl(currentUser.avatarUrl)} 
                  alt={currentUser.name} 
                  className="w-7 h-7 rounded-full object-cover shrink-0 shadow-2xs border border-[#E7EAF0]" 
                />
              ) : (
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: currentUser.color || '#0F1B3D' }}
                >
                  {currentUser.initials || 'CC'}
                </div>
              )}
              <span className="text-xs font-bold text-[#18233F] hidden md:inline truncate max-w-[130px]">
                {currentUser.name}
              </span>
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-lg text-[#747D91] hover:text-[#FF6B5B] hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => openAuthModal('Please log in to your student account.')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E7EAF0] bg-white hover:bg-slate-50 text-xs font-semibold text-[#18233F] transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-[#0F1B3D]" />
              <span>Log In</span>
            </button>

            <button
              onClick={() => openAuthModal('Create your student account to connect with peers.', 'register')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-semibold text-xs shadow-xs transition-all active:scale-95"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Account</span>
              <span className="sm:hidden">Join</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
