import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';
import Header from './Header';
import StudentProfileModal from '../modals/StudentProfileModal';
import AuthModal from '../modals/AuthModal';
import Dashboard from '../../pages/Dashboard';
import Discover from '../../pages/Discover';
import Connections from '../../pages/Connections';
import Messages from '../../pages/Messages';
import Profile from '../../pages/Profile';
import Settings from '../../pages/Settings';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { activeTab, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Render active view
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'discover':
        return <Discover />;
      case 'connections':
        return <Connections />;
      case 'messages':
        return <Messages />;
      case 'profile':
        return <Profile />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0F1B3D] flex items-center justify-center animate-bounce shadow-md">
            <span className="text-[#FFC93C] font-extrabold text-lg">CC</span>
          </div>
          <p className="text-xs font-bold text-[#18233F]">Loading Campus Connect...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F5F6FA] text-[#18233F]">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar />

      {/* Mobile / Tablet Drawer */}
      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Central-to-Right Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8">
          {renderContent()}
        </main>
      </div>

      {/* Global Student Profile Modal */}
      <StudentProfileModal />

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
}
