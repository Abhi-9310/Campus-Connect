import React from 'react';
import { 
  Users, 
  UserCheck, 
  MessageSquare, 
  Code, 
  Search, 
  ArrowRight, 
  Sparkles, 
  GraduationCap, 
  ChevronRight,
  TrendingUp,
  Clock,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { 
    currentUser, 
    allStudents, 
    connections, 
    messages, 
    setActiveTab, 
    openChatWith, 
    openStudentProfile 
  } = useAuth();

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Real statistics
  const totalStudentsCount = allStudents.length;
  const myConnectionsCount = connections.filter(c => c.status === 'accepted').length;
  
  // Unique active conversations
  const activeConversationUserIds = new Set(
    messages.flatMap(m => m.participants || []).filter(id => id !== currentUser?.uid)
  );
  const activeConversationsCount = activeConversationUserIds.size;
  const skillsListedCount = currentUser?.skills ? currentUser.skills.length : 0;

  // Students recommended (excluding current user)
  const recommendedStudents = allStudents
    .filter(s => s.uid !== currentUser?.uid)
    .slice(0, 4);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Welcome Banner */}
      <div 
        className="rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg border border-[#18284F]"
        style={{
          background: 'linear-gradient(135deg, #0F1B3D 0%, #18284F 55%, #1F3366 100%)'
        }}
      >
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FFC93C]/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-[#FF6B5B]/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#FFC93C] text-xs font-semibold mb-3 border border-white/10 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Collegiate Student Hub</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {currentUser 
              ? `${getGreeting()}, ${currentUser.name?.split(' ')[0] || 'Student'}!` 
              : 'Welcome to Campus Connect!'}
          </h2>
          <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed">
            Your campus community is waiting for you. Discover peers by technical skills, share knowledge, and build great projects together.
          </p>

          {/* Quick Actions in banner */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={() => setActiveTab('discover')}
              className="px-4 py-2.5 rounded-xl bg-[#FFC93C] hover:bg-amber-300 text-[#0F1B3D] font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Compass className="w-4 h-4" />
              <span>Discover Students</span>
            </button>
            <button
              onClick={() => currentUser ? setActiveTab('profile') : openStudentProfile(null) || setActiveTab('discover')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs md:text-sm flex items-center gap-2 border border-white/15 backdrop-blur-xs transition-all"
            >
              <span>{currentUser ? 'Update My Profile' : 'Explore Community'}</span>
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs md:text-sm flex items-center gap-2 border border-white/15 backdrop-blur-xs transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open Messages</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Compact Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7EAF0] shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#747D91]">Total Students</span>
            <div className="w-9 h-9 rounded-xl bg-[#0F1B3D]/5 flex items-center justify-center text-[#0F1B3D]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#18233F]">
            {totalStudentsCount}
          </div>
          <p className="text-[11px] text-[#747D91] mt-1">Verified on campus</p>
        </div>

        {/* My Connections */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7EAF0] shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#747D91]">My Connections</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#18233F]">
            {myConnectionsCount}
          </div>
          <p className="text-[11px] text-[#747D91] mt-1">Active peer network</p>
        </div>

        {/* Active Conversations */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7EAF0] shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#747D91]">Active Conversations</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#18233F]">
            {activeConversationsCount}
          </div>
          <p className="text-[11px] text-[#747D91] mt-1">Direct student chats</p>
        </div>

        {/* Skills Listed */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7EAF0] shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#747D91]">Skills Listed</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Code className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#18233F]">
            {skillsListedCount}
          </div>
          <p className="text-[11px] text-[#747D91] mt-1">On your student profile</p>
        </div>
      </div>

      {/* Discover Section: "People You May Want to Know" */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#18233F]">People You May Want to Know</h3>
            <p className="text-xs text-[#747D91]">Connect with students learning or teaching complementary skills</p>
          </div>
          <button
            onClick={() => setActiveTab('discover')}
            className="text-xs font-bold text-[#0F1B3D] hover:text-[#18284F] flex items-center gap-1 group"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {recommendedStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendedStudents.map(student => {
              const isAuthed = Boolean(currentUser);
              const displayName = isAuthed ? student.name : "User";
              const displayInitials = isAuthed ? (student.initials || "U") : "U";

              return (
                <div
                  key={student.uid}
                  className="bg-white rounded-2xl p-4 border border-[#E7EAF0] shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Student Avatar & Basic Info */}
                    <div className="flex items-center gap-3">
                      {isAuthed && student.avatarUrl ? (
                        <img
                          src={student.avatarUrl}
                          alt={displayName}
                          className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[#E7EAF0]"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0"
                          style={{ backgroundColor: isAuthed ? (student.color || '#0F1B3D') : '#0F1B3D' }}
                        >
                          {displayInitials}
                        </div>
                      )}

                      <div className="truncate">
                        <h4 className="text-sm font-bold text-[#18233F] truncate group-hover:text-[#0F1B3D]">
                          {displayName}
                        </h4>
                        <p className="text-[11px] text-[#747D91] truncate font-medium">
                          {student.branch.split('&')[0]}
                        </p>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                          {student.year}
                        </span>
                      </div>
                    </div>

                    {/* Skills tags preview */}
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      {student.skills?.slice(0, 3).map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F5F6FA] text-[#18233F] border border-[#E7EAF0]"
                        >
                          {skill}
                        </span>
                      ))}
                      {student.skills?.length > 3 && (
                        <span className="text-[10px] text-[#747D91] self-center">
                          +{student.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#E7EAF0]">
                    <button
                      onClick={() => openStudentProfile(student)}
                      className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-[#18233F] bg-[#F5F6FA] hover:bg-slate-200 border border-[#E7EAF0] transition-colors"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => openChatWith(student.uid)}
                      className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-[#FFC93C] bg-[#0F1B3D] hover:bg-[#18284F] transition-colors flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 border border-[#E7EAF0] text-center shadow-xs">
            <p className="text-xs font-semibold text-[#18233F]">
              No other students have joined yet. Be the first to build your collegiate network!
            </p>
            <button
              onClick={() => setActiveTab('discover')}
              className="mt-3 px-4 py-1.5 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-colors"
            >
              Explore Discover
            </button>
          </div>
        )}
      </div>

      {/* Recent Activity & Community Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Recent Joined Students */}
        <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-[#E7EAF0] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#18233F] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0F1B3D]" />
              Recently Active on Campus
            </h3>
            <span className="text-[11px] text-[#747D91]">Real-time campus directory</span>
          </div>

          <div className="space-y-3">
            {allStudents.length > 0 ? (
              allStudents.slice(0, 3).map((student) => {
                const isAuthed = Boolean(currentUser);
                const displayName = isAuthed ? student.name : "User";
                const displayInitials = isAuthed ? (student.initials || "U") : "U";

                return (
                  <div
                    key={student.uid}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#F5F6FA] hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isAuthed && student.avatarUrl ? (
                        <img 
                          src={student.avatarUrl} 
                          alt={displayName} 
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#E7EAF0]" 
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white"
                          style={{ backgroundColor: isAuthed ? (student.color || '#0F1B3D') : '#0F1B3D' }}
                        >
                          {displayInitials}
                        </div>
                      )}
                      <div>
                        <h5 className="text-xs font-bold text-[#18233F]">{displayName}</h5>
                        <p className="text-[11px] text-[#747D91]">{student.branch} • {student.year}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openStudentProfile(student)}
                      className="text-xs font-semibold text-[#0F1B3D] hover:underline"
                    >
                      View Profile
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-[#747D91]">
                No student profiles registered on campus yet.
              </div>
            )}
          </div>
        </div>

        {/* Quick Tips Card */}
        <div className="bg-[#18284F] text-white rounded-2xl p-5 border border-[#18284F] shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-[#FFC93C]/20 text-[#FFC93C] flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">Campus Networking Tip</h4>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Add at least 4 technical skills to your student profile so students searching for teammates for hackathons, college projects, and study groups can discover you quickly.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('profile')}
            className="w-full mt-4 py-2 px-3 rounded-xl bg-[#FFC93C] hover:bg-amber-300 text-[#0F1B3D] font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Complete My Skills</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
