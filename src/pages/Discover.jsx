import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Filter, 
  GraduationCap, 
  MessageSquare, 
  UserPlus, 
  Check, 
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUGGESTED_SKILLS, BRANCHES, ACADEMIC_YEARS } from '../data/seedStudents';

export default function Discover() {
  const { 
    currentUser, 
    allStudents, 
    connections, 
    sendConnectionRequest, 
    openChatWith, 
    openStudentProfile,
    openAuthModal 
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [selectedSkillChip, setSelectedSkillChip] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter out current user and apply search query & filters
  const filteredStudents = useMemo(() => {
    return allStudents.filter(student => {
      // Exclude self if authenticated
      if (currentUser?.uid && student.uid === currentUser.uid) return false;

      // Filter by Branch
      if (selectedBranch !== 'All Branches' && student.branch !== selectedBranch) {
        return false;
      }

      // Filter by Year
      if (selectedYear !== 'All Years' && student.year !== selectedYear) {
        return false;
      }

      // Filter by Skill Chip if active
      if (selectedSkillChip) {
        const hasSkill = student.skills?.some(s => 
          s.toLowerCase() === selectedSkillChip.toLowerCase()
        );
        if (!hasSkill) return false;
      }

      // Filter by text search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = currentUser ? student.name?.toLowerCase().includes(query) : query === 'user';
        const matchesBio = currentUser ? student.bio?.toLowerCase().includes(query) : false;
        const matchesSkill = student.skills?.some(s => s.toLowerCase().includes(query));
        const matchesBranch = student.branch?.toLowerCase().includes(query);

        if (!matchesName && !matchesBio && !matchesSkill && !matchesBranch) {
          return false;
        }
      }

      return true;
    });
  }, [allStudents, currentUser, searchQuery, selectedBranch, selectedYear, selectedSkillChip]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedBranch('All Branches');
    setSelectedYear('All Years');
    setSelectedSkillChip(null);
  };

  const hasActiveFilters = searchQuery || selectedBranch !== 'All Branches' || selectedYear !== 'All Years' || selectedSkillChip;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Search Header Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E7EAF0] shadow-xs">
        <div className="max-w-2xl">
          <h2 className="text-xl md:text-2xl font-extrabold text-[#18233F]">Discover Students</h2>
          <p className="text-xs md:text-sm text-[#747D91] mt-1">
            Find people who share your interests, skills, and ambitions across campus.
          </p>
        </div>

        {/* Large Search Bar */}
        <div className="mt-5 relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-[#747D91] absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, technical skill (e.g., Python, React), or branch..."
              className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0] text-[#18233F] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F1B3D] focus:bg-white transition-all"
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  showFilters || selectedBranch !== 'All Branches' || selectedYear !== 'All Years'
                    ? 'bg-[#0F1B3D] text-[#FFC93C] border-[#0F1B3D]'
                    : 'bg-white text-[#18233F] border-[#E7EAF0] hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Suggested Skill Chips */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-[#747D91] shrink-0">Popular Skills:</span>
          {SUGGESTED_SKILLS.map((skill) => {
            const isSelected = selectedSkillChip === skill;
            return (
              <button
                key={skill}
                onClick={() => setSelectedSkillChip(isSelected ? null : skill)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  isSelected
                    ? 'bg-[#0F1B3D] text-[#FFC93C] shadow-xs'
                    : 'bg-[#F5F6FA] hover:bg-slate-200 text-[#18233F] border border-[#E7EAF0]'
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="mt-5 pt-4 border-t border-[#E7EAF0] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in duration-150">
            <div>
              <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                Academic Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs font-medium text-[#18233F] focus:outline-none focus:ring-1 focus:ring-[#0F1B3D]"
              >
                {BRANCHES.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                Academic Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs font-medium text-[#18233F] focus:outline-none focus:ring-1 focus:ring-[#0F1B3D]"
              >
                {ACADEMIC_YEARS.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearAllFilters}
                className="w-full py-2 px-3 rounded-xl bg-[#F5F6FA] hover:bg-slate-200 text-xs font-bold text-[#747D91] border border-[#E7EAF0] transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-[#747D91]">
          Showing <span className="text-[#18233F] font-extrabold">{filteredStudents.length}</span> students
          {hasActiveFilters && ' (filtered)'}
        </p>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs font-bold text-[#FF6B5B] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Students Cards Grid */}
      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map(student => {
            const existingConn = currentUser ? connections.find(
              c => (c.requesterId === student.uid && c.recipientId === currentUser?.uid) ||
                   (c.recipientId === student.uid && c.requesterId === currentUser?.uid)
            ) : null;

            const isAuthed = Boolean(currentUser);
            const displayName = isAuthed ? student.name : "User";
            const displayInitials = isAuthed ? (student.initials || "U") : "U";
            const displayBio = isAuthed ? (student.bio || "Student at Campus Connect") : "Campus Connect Student";

            return (
              <div
                key={student.uid}
                className="bg-white rounded-3xl p-5 border border-[#E7EAF0] shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top: Avatar & Academic Info */}
                  <div className="flex items-start gap-3.5">
                    {isAuthed && student.avatarUrl ? (
                      <img
                        src={student.avatarUrl}
                        alt={displayName}
                        className="w-14 h-14 rounded-full object-cover shrink-0 border border-[#E7EAF0] shadow-xs"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-base text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: isAuthed ? (student.color || '#0F1B3D') : '#0F1B3D' }}
                      >
                        {displayInitials}
                      </div>
                    )}

                    <div className="truncate flex-1">
                      <h3 className="text-base font-bold text-[#18233F] truncate group-hover:text-[#0F1B3D]">
                        {displayName}
                      </h3>
                      <p className="text-xs text-[#747D91] truncate font-medium mt-0.5">
                        {student.branch}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {student.year}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio Preview */}
                  <p className="text-xs text-[#18233F] mt-3.5 line-clamp-2 leading-relaxed bg-[#F5F6FA] p-2.5 rounded-xl border border-[#E7EAF0]/60">
                    {displayBio}
                  </p>

                  {/* Skills tags */}
                  <div className="mt-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#747D91] block mb-1.5">
                      Skills
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {student.skills?.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-[#18284F]/5 text-[#0F1B3D] border border-[#18284F]/10"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-4 border-t border-[#E7EAF0] flex items-center gap-2">
                  <button
                    onClick={() => openStudentProfile(student)}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-[#18233F] bg-[#F5F6FA] hover:bg-slate-200 border border-[#E7EAF0] transition-colors"
                  >
                    View Profile
                  </button>

                  {isAuthed && existingConn?.status === 'accepted' ? (
                    <button
                      onClick={() => openChatWith(student.uid)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-[#0F1B3D] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  ) : isAuthed && existingConn?.status === 'pending' ? (
                    <span className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 text-center">
                      Pending
                    </span>
                  ) : (
                    <button
                      onClick={() => sendConnectionRequest(student)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-[#FFC93C] bg-[#0F1B3D] hover:bg-[#18284F] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : allStudents.length === 0 ? (
        /* Empty Database State */
        <div className="bg-white rounded-3xl p-12 text-center border border-[#E7EAF0] max-w-lg mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center mx-auto mb-4 border border-[#FFC93C]/40">
            <GraduationCap className="w-8 h-8 text-[#0F1B3D]" />
          </div>
          <h3 className="text-lg font-bold text-[#18233F]">
            No students have joined Campus Connect yet.
          </h3>
          <p className="text-xs font-semibold text-[#0F1B3D] mt-1">
            Be the first to join your campus network!
          </p>
          <p className="text-xs text-[#747D91] mt-1.5 max-w-xs mx-auto leading-relaxed">
            Create your genuine student account to showcase your skills, meet campus peers, and start collaborating.
          </p>
          <button
            onClick={() => openAuthModal('Create your account and be the first student to join Campus Connect!')}
            className="mt-6 px-6 py-2.5 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-all inline-flex items-center gap-2 shadow-xs active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Join Campus Connect</span>
          </button>
        </div>
      ) : (
        /* Filtered Empty State */
        <div className="bg-white rounded-3xl p-12 text-center border border-[#E7EAF0] max-w-lg mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#18233F]">No students found for this search.</h3>
          <p className="text-xs text-[#747D91] mt-1.5 max-w-xs mx-auto">
            Try another skill or explore different branches to connect with fellow campus peers.
          </p>
          <button
            onClick={clearAllFilters}
            className="mt-5 px-4 py-2 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-colors"
          >
            Reset Search & Filters
          </button>
        </div>
      )}
    </div>
  );
}
