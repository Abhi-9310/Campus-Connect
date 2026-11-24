import React from 'react';
import { 
  X, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  UserPlus, 
  Check, 
  Sparkles,
  Mail,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl } from '../../services/socket';

export default function StudentProfileModal() {
  const { 
    currentUser, 
    selectedStudentForModal, 
    closeStudentProfile, 
    connections, 
    sendConnectionRequest, 
    openChatWith 
  } = useAuth();

  if (!selectedStudentForModal) return null;

  const student = selectedStudentForModal;
  const isMe = currentUser?.uid === student.uid;
  const isAuthed = Boolean(currentUser);
  const existingConn = isAuthed ? connections.find(
    c => (c.requesterId === student.uid && c.recipientId === currentUser?.uid) ||
         (c.recipientId === student.uid && c.requesterId === currentUser?.uid)
  ) : null;

  const displayName = isAuthed ? student.name : "User";
  const displayInitials = isAuthed ? (student.initials || "U") : "U";
  const displayBio = isAuthed ? (student.bio || 'No bio shared yet.') : 'Campus Connect Student';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={closeStudentProfile}
      />

      {/* Modal Dialog */}
      <div 
        className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden z-10 border border-[#E7EAF0] animate-in zoom-in-95 duration-200"
      >
        {/* Cover Banner */}
        <div 
          className="h-28 w-full relative"
          style={{ 
            background: 'linear-gradient(135deg, #0F1B3D 0%, #18284F 50%, #2B3B6D 100%)' 
          }}
        >
          <div className="absolute top-3 right-3">
            <button
              onClick={closeStudentProfile}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar and Top Actions */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            {isAuthed && student.avatarUrl ? (
              <img 
                src={resolveAssetUrl(student.avatarUrl)} 
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md bg-white" 
              />
            ) : (
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-md"
                style={{ backgroundColor: isAuthed ? (student.color || '#0F1B3D') : '#0F1B3D' }}
              >
                {displayInitials}
              </div>
            )}

            {!isMe && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    closeStudentProfile();
                    openChatWith(student.uid);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>

                {isAuthed && existingConn?.status === 'accepted' ? (
                  <span className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-xs flex items-center gap-1 border border-emerald-200">
                    <Check className="w-4 h-4" />
                    <span>Connected</span>
                  </span>
                ) : isAuthed && existingConn?.status === 'pending' ? (
                  <span className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-700 font-semibold text-xs flex items-center gap-1 border border-amber-200">
                    <span>Pending</span>
                  </span>
                ) : (
                  <button
                    onClick={() => sendConnectionRequest(student)}
                    className="px-3.5 py-2 rounded-xl bg-[#F5F6FA] hover:bg-slate-200 text-[#18233F] font-semibold text-xs flex items-center gap-1.5 border border-[#E7EAF0] transition-all"
                  >
                    <UserPlus className="w-4 h-4 text-[#0F1B3D]" />
                    <span>Connect</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Student Info */}
          <div>
            <h2 className="text-xl font-bold text-[#18233F]">{displayName}</h2>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-[#747D91] mt-1 font-medium">
              <span className="flex items-center gap-1 text-[#18284F] font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-[#0F1B3D]" />
                {student.branch}
              </span>
              <span>•</span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                {student.year}
              </span>
              {isAuthed && student.email && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <Mail className="w-3 h-3" />
                    {student.email}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* About Section */}
          <div className="mt-5 pt-4 border-t border-[#E7EAF0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#747D91] mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#0F1B3D]" />
              About Me
            </h3>
            <p className="text-xs md:text-sm text-[#18233F] leading-relaxed bg-[#F5F6FA] p-3.5 rounded-xl border border-[#E7EAF0]">
              {displayBio}
            </p>
          </div>

          {/* Skills Section */}
          <div className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#747D91] mb-2.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#0F1B3D]" />
              Technical Skills & Proficiencies
            </h3>
            <div className="flex flex-wrap gap-2">
              {student.skills && student.skills.length > 0 ? (
                student.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#18284F]/5 text-[#0F1B3D] border border-[#18284F]/15 flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC93C]"></span>
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No skills listed yet</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
