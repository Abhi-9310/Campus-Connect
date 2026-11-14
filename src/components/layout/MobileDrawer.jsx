import React from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  Users, 
  MessageSquare, 
  User, 
  Settings, 
  LogOut,
  X,
  Share2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MobileDrawer({ isOpen, onClose }) {
  const { 
    currentUser, 
    activeTab, 
    setActiveTab, 
    connections, 
    messages, 
    logout 
  } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'discover', label: 'Discover Students', icon: Compass },
    { id: 'connections', label: 'My Connections', icon: Users, badge: connections.filter(c => c.status === 'pending' && c.recipientId === currentUser?.uid).length || null },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: messages.length > 0 ? messages.length : null },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div 
        className="relative flex-1 flex flex-col max-w-[280px] w-full text-white shadow-2xl z-10 animate-in slide-in-from-left duration-200"
        style={{ backgroundColor: '#0F1B3D' }}
      >
        {/* Top Header */}
        <div className="p-5 border-b border-[#18284F] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#18284F] flex items-center justify-center border border-[#FFC93C]/40">
              <Share2 className="w-4 h-4 text-[#FFC93C]" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white">CAMPUS </span>
              <span className="font-extrabold text-sm text-[#FFC93C]">CONNECT</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#18284F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#18284F] text-[#FFC93C] font-semibold border-l-4 border-[#FFC93C]'
                    : 'text-slate-300 hover:bg-[#18284F]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#FFC93C]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-[#FFC93C] text-[#0F1B3D] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer profile info */}
        <div className="p-4 border-t border-[#18284F]">
          <div className="flex items-center justify-between bg-[#18284F]/60 p-2.5 rounded-xl border border-[#18284F]">
            <div className="flex items-center gap-2 overflow-hidden">
              {currentUser?.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#FFC93C]/40" 
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                  style={{ backgroundColor: currentUser?.color || '#2563EB' }}
                >
                  {currentUser?.initials || 'CC'}
                </div>
              )}
              <div className="truncate text-xs">
                <div className="font-bold text-white truncate">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser?.branch}</div>
              </div>
            </div>
            <button 
              onClick={() => {
                logout();
                onClose();
              }}
              className="text-slate-400 hover:text-red-400 p-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
