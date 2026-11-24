import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Mail, 
  GraduationCap, 
  BookOpen, 
  Code, 
  Plus, 
  X, 
  Check, 
  Save, 
  Edit3, 
  Sparkles,
  ShieldCheck,
  Camera,
  Upload,
  Trash2,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAssetUrl } from '../services/socket';
import { BRANCHES, ACADEMIC_YEARS } from '../data/seedStudents';

export default function Profile() {
  const { 
    currentUser, 
    updateUserProfile, 
    uploadAvatar, 
    removeAvatar, 
    firebaseUser, 
    openAuthModal 
  } = useAuth();

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [branch, setBranch] = useState(currentUser?.branch || 'Computer Science & Engineering');
  const [year, setYear] = useState(currentUser?.year || '3rd Year');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [skills, setSkills] = useState(currentUser?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser && !isEditing) {
      setName(currentUser.name || '');
      setBranch(currentUser.branch || 'Computer Science & Engineering');
      setYear(currentUser.year || '3rd Year');
      setBio(currentUser.bio || '');
      setSkills(Array.isArray(currentUser.skills) ? currentUser.skills : []);
    }
  }, [currentUser, isEditing]);

  if (!currentUser) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-[#E7EAF0] max-w-lg mx-auto shadow-xs my-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center mx-auto mb-4 border border-[#FFC93C]/40">
          <User className="w-8 h-8 text-[#0F1B3D]" />
        </div>
        <h3 className="text-xl font-bold text-[#18233F]">
          Student Profile
        </h3>
        <p className="text-xs text-[#747D91] mt-2 max-w-sm mx-auto leading-relaxed">
          Please log in to manage your technical skills, branch details, and showcase your student profile across campus.
        </p>
        <button
          onClick={() => openAuthModal('Please log in or register to view and customize your student profile.')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-colors inline-flex items-center gap-2 shadow-xs active:scale-95"
        >
          <span>Log In to View Profile</span>
        </button>
      </div>
    );
  }

  // Calculate actual completion percentage
  const calculateCompletion = () => {
    let score = 0;
    if (name?.trim()) score += 20;
    if (currentUser?.email) score += 20;
    if (branch) score += 20;
    if (year) score += 10;
    if (bio?.trim() && bio.length > 20) score += 15;
    if (skills?.length >= 3) score += 15;
    return Math.min(100, score);
  };

  const completionPercentage = calculateCompletion();

  const handleAddSkill = (e) => {
    e?.preventDefault();
    const trimmed = skillInput.trim();
    if (!trimmed) return;

    // Check duplicate case-insensitively
    const exists = skills.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setSkills(prev => [...prev, trimmed]);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(prev => prev.filter(s => s !== skillToRemove));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    try {
      setIsSaving(true);
      await updateUserProfile({
        name: name.trim(),
        branch,
        year,
        bio: bio.trim(),
        skills
      });
      setStatusMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(currentUser?.name || '');
    setBranch(currentUser?.branch || 'Computer Science & Engineering');
    setYear(currentUser?.year || '3rd Year');
    setBio(currentUser?.bio || '');
    setSkills(currentUser?.skills || []);
    setIsEditing(false);
  };

  // Avatar Image Handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME format
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setStatusMessage({ 
        type: 'error', 
        text: 'Invalid file type. Only JPG, JPEG, PNG, and WebP images are supported.' 
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size limit: 5 MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setStatusMessage({ 
        type: 'error', 
        text: 'File size exceeds 5 MB. Please select a smaller photo.' 
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setStatusMessage({
      type: 'info',
      text: 'Previewing photo. Click "Save Photo" to save it to your student profile.'
    });
  };

  const handleSaveAvatar = async () => {
    if (!selectedFile) return;

    try {
      setIsUploadingAvatar(true);
      await uploadAvatar(selectedFile);
      setStatusMessage({ type: 'success', text: 'Profile picture updated successfully!' });
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to upload profile picture' 
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCancelAvatarPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatusMessage(null);
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsRemovingAvatar(true);
      await removeAvatar();
      setStatusMessage({ type: 'success', text: 'Profile picture removed.' });
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to remove profile picture' 
      });
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Hidden file input for picture upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Profile Banner Card */}
      <div className="bg-white rounded-3xl border border-[#E7EAF0] shadow-xs overflow-hidden">
        {/* Banner header */}
        <div 
          className="h-32 w-full relative"
          style={{ 
            background: 'linear-gradient(135deg, #0F1B3D 0%, #18284F 60%, #2B3B6D 100%)' 
          }}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Info Header */}
        <div className="px-6 md:px-8 pb-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 mb-6 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Circular Avatar Container with Hover Upload Trigger */}
              <div className="relative group self-start sm:self-auto">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#FFC93C] shadow-lg bg-white ring-2 ring-[#0F1B3D]" 
                  />
                ) : currentUser?.avatarUrl ? (
                  <img 
                    src={resolveAssetUrl(currentUser.avatarUrl)} 
                    alt={currentUser.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md bg-white" 
                  />
                ) : (
                  <div 
                    className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-md"
                    style={{ backgroundColor: currentUser?.color || '#0F1B3D' }}
                  >
                    {currentUser?.initials || 'CC'}
                  </div>
                )}

                {/* Floating Camera Button on Avatar */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload profile picture"
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-[#0F1B3D] text-[#FFC93C] hover:bg-[#18284F] shadow-md border-2 border-white transition-transform active:scale-90 flex items-center justify-center"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-extrabold text-[#18233F]">
                    {currentUser?.name}
                  </h2>
                  {firebaseUser && (
                    <span className="p-1 rounded-full bg-emerald-50 text-emerald-600" title="Google Verified">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#747D91] font-medium flex items-center gap-1.5 mt-0.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#0F1B3D]" />
                  <span>{currentUser?.branch}</span>
                  <span>•</span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.2 rounded font-semibold text-[10px]">
                    {currentUser?.year}
                  </span>
                </p>

                {/* Avatar Action Controls */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {previewUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveAvatar}
                        disabled={isUploadingAvatar}
                        className="px-3 py-1.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                      >
                        {isUploadingAvatar ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Photo</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelAvatarPreview}
                        disabled={isUploadingAvatar}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#18233F] font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-[#F5F6FA] hover:bg-slate-200 border border-[#E7EAF0] text-[#18233F] font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#0F1B3D]" />
                        <span>{currentUser?.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>

                      {currentUser?.avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={isRemovingAvatar}
                          className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-semibold text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {isRemovingAvatar ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Remove</span>
                        </button>
                      )}
                    </>
                  )}
                  <span className="text-[10px] text-[#747D91]">
                    JPG, PNG, or WebP (max 5MB)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Completion Bar */}
          <div className="bg-[#F5F6FA] p-4 rounded-2xl border border-[#E7EAF0] mb-6">
            <div className="flex items-center justify-between text-xs font-bold text-[#18233F] mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFC93C]" />
                Profile Strength
              </span>
              <span className="text-[#0F1B3D]">{completionPercentage}% complete</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${completionPercentage}%`,
                  backgroundColor: completionPercentage > 75 ? '#10B981' : '#FFC93C'
                }}
              />
            </div>
          </div>

          {/* Feedback Alert */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {statusMessage.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Edit Mode vs Read-only Mode */}
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs md:text-sm text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                    Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-[#E7EAF0] text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                    Academic Branch
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs font-medium text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  >
                    {BRANCHES.filter(b => b !== 'All Branches').map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                    Academic Year
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs font-medium text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  >
                    {ACADEMIC_YEARS.filter(y => y !== 'All Years').map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                  About Me / Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell campus peers about your projects, interests, and what you are learning..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs md:text-sm text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D] focus:bg-white leading-relaxed"
                />
              </div>

              {/* Skills Manager */}
              <div>
                <label className="block text-xs font-bold text-[#18233F] mb-1.5">
                  Technical Skills & Proficiencies
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Type a skill and press Enter (e.g. React, C++, Docker)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#18284F]/10 text-[#0F1B3D] border border-[#18284F]/20 flex items-center gap-1.5"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="p-0.5 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#E7EAF0]">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-xl bg-[#F5F6FA] hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* About Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#747D91] mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#0F1B3D]" />
                  About Me
                </h3>
                <p className="text-xs md:text-sm text-[#18233F] leading-relaxed bg-[#F5F6FA] p-4 rounded-2xl border border-[#E7EAF0]">
                  {currentUser?.bio || 'You haven\'t added a bio yet. Click "Edit Profile" above to share your projects and background.'}
                </p>
              </div>

              {/* Skills Tags */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#747D91] mb-2 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-[#0F1B3D]" />
                  Technical Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {currentUser?.skills?.length > 0 ? (
                    currentUser.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#18284F]/5 text-[#0F1B3D] border border-[#18284F]/15 flex items-center gap-1.5"
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
          )}
        </div>
      </div>
    </div>
  );
}
