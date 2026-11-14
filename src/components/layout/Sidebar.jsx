import React from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  Users, 
  MessageSquare, 
  User, 
  Settings, 
  LogOut,
  Sparkles,
  Share2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { 
    currentUser, 
    activeTab, 
    setActiveTab, 
    connections, 
    messages, 
    logout,
    firebaseUser,
    openAuthModal 
  } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'discover',
      label: 'Discover Students',
      icon: Compass,
      badge: null
    },
    {
      id: 'connections',
      label: 'My Connections',
      icon: Users,
      badge: connections.filter(c => c.status === 'pending' && c.recipientId === currentUser?.uid).length || null
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      badge: messages.length > 0 ? messages.length : null
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: User,
      badge: null
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside 
      className="hidden md:flex flex-col w-[260px] h-screen sticky top-0 shrink-0 text-white z-30 select-none border-r border-[#18284F]"
      style={{ backgroundColor: '#0F1B3D' }}
    >
      {/* Top Section - Brand */}
      <div className="p-5 border-b border-[#18284F]/80">
        <div className="flex items-center gap-3">
          {/* Logo Mark: Two connected user symbols */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#18284F] to-[#2B3B6D] flex items-center justify-center border border-[#FFC93C]/40 shadow-sm relative group">
            <div className="flex items-center -space-x-1">
              <Share2 className="w-5 h-5 text-[#FFC93C] transform -rotate-12" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-base text-white">CAMPUS</span>
              <span className="font-extrabold tracking-wider text-base text-[#FFC93C]">CONNECT</span>
            </div>
            <p className="text-[11px] text-[#747D91] font-medium tracking-tight">Your campus, connected.</p>
          </div>
        </div>
      </div>

      {/* Main Navigation Section */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[#747D91] uppercase">
          Navigation
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 group text-left relative ${
                isActive
                  ? 'bg-[#18284F] text-[#FFC93C] shadow-sm font-semibold'
                  : 'text-[#cbd5e1] hover:bg-[#18284F]/50 hover:text-white'
              }`}
            >
              {/* Highlight Bar */}
              {isActive && (
                <span 
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#FFC93C]" 
                />
              )}

              <div className="flex items-center gap-3">
                <Icon 
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-[#FFC93C]' : 'text-[#747D91] group-hover:text-[#cbd5e1]'
                  }`} 
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== null && (
                <span 
                  className={`px-2 py-0.5 text-xs rounded-full font-bold transition-colors ${
                    isActive 
                      ? 'bg-[#FFC93C] text-[#0F1B3D]' 
                      : 'bg-[#18284F] text-[#FFC93C]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Status Pill */}
      <div className="px-4 py-2">
        <div className="bg-[#18284F]/60 rounded-lg p-2.5 border border-[#18284F] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">Campus Network</span>
          </div>
          <span className="text-[11px] text-[#FFC93C] font-semibold">Active</span>
        </div>
      </div>

      {/* Sidebar Bottom Section - User Profile or Sign In */}
      <div className="p-3 border-t border-[#18284F]">
        {currentUser ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#18284F]/40 hover:bg-[#18284F] transition-colors border border-[#18284F]/60">
            <button 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2.5 overflow-hidden text-left flex-1"
            >
              {currentUser?.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full object-cover border border-[#FFC93C]/40 shrink-0" 
                />
              ) : (
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-inner"
                  style={{ backgroundColor: currentUser?.color || '#2563EB' }}
                >
                  {currentUser?.initials || 'CC'}
                </div>
              )}
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                  {currentUser?.name || 'Student'}
                  {firebaseUser && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC93C]" title="Verified Google Session"></span>
                  )}
                </div>
                <div className="text-[11px] text-[#747D91] truncate font-medium">
                  {currentUser?.branch ? currentUser.branch.split('&')[0] : 'Student'}
                </div>
              </div>
            </button>

            <button
              onClick={logout}
              title="Log Out"
              className="p-1.5 text-[#747D91] hover:text-[#FF6B5B] hover:bg-[#0F1B3D]/80 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('Please log in or create an account to get started.')}
            className="w-full py-2.5 px-3 rounded-xl bg-[#18284F] hover:bg-[#2B3B6D] text-[#FFC93C] text-xs font-bold flex items-center justify-center gap-2 border border-[#FFC93C]/30 shadow-xs transition-colors"
          >
            <span>Log In / Register</span>
          </button>
        )}
      </div>
    </aside>
  );
}
