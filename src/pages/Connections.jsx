import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  MessageSquare, 
  Check, 
  X, 
  Compass, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Connections() {
  const { 
    currentUser, 
    allStudents, 
    connections, 
    acceptConnectionRequest, 
    rejectConnectionRequest, 
    openChatWith, 
    openStudentProfile,
    setActiveTab,
    openAuthModal 
  } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('accepted'); // 'accepted' | 'pending'

  if (!currentUser) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-[#E7EAF0] max-w-lg mx-auto shadow-xs my-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center mx-auto mb-4 border border-[#FFC93C]/40">
          <Users className="w-8 h-8 text-[#0F1B3D]" />
        </div>
        <h3 className="text-xl font-bold text-[#18233F]">
          Connect with Your Campus Peers
        </h3>
        <p className="text-xs text-[#747D91] mt-2 max-w-sm mx-auto leading-relaxed">
          Please log in to send and manage connection requests, collaborate with students across departments, and build your collegiate network.
        </p>
        <button
          onClick={() => openAuthModal('Please log in to connect with other students.')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-colors inline-flex items-center gap-2 shadow-xs active:scale-95"
        >
          <span>Log In to Connect</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Accepted connections
  const acceptedConnections = connections.filter(c => c.status === 'accepted');

  // Pending incoming requests (other students requesting to connect with me)
  const incomingRequests = connections.filter(
    c => c.status === 'pending' && c.recipientId === currentUser?.uid
  );

  // Pending outgoing requests (requests I sent to others)
  const outgoingRequests = connections.filter(
    c => c.status === 'pending' && c.requesterId === currentUser?.uid
  );

  // Find student entity for a given connection
  const getPeerStudent = (conn) => {
    const peerId = conn.requesterId === currentUser?.uid ? conn.recipientId : conn.requesterId;
    return allStudents.find(s => s.uid === peerId) || {
      uid: peerId,
      name: conn.requesterId === currentUser?.uid ? (conn.recipientName || 'Student') : (conn.requesterName || 'Student'),
      branch: 'Engineering & Technology',
      year: 'Student',
      skills: ['Campus Connect'],
      initials: 'CC'
    };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E7EAF0] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-[#18233F]">My Connections</h2>
            <p className="text-xs md:text-sm text-[#747D91] mt-1">
              Your verified campus networking circle and incoming collaboration requests.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('discover')}
            className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>Discover New Peers</span>
          </button>
        </div>

        {/* Sub-tabs: Accepted vs Pending */}
        <div className="flex items-center gap-2 mt-6 border-b border-[#E7EAF0] pb-2">
          <button
            onClick={() => setActiveSubTab('accepted')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'accepted'
                ? 'bg-[#0F1B3D] text-[#FFC93C]'
                : 'text-[#747D91] hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Connected Students ({acceptedConnections.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
              activeSubTab === 'pending'
                ? 'bg-[#0F1B3D] text-[#FFC93C]'
                : 'text-[#747D91] hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Invitations & Requests ({incomingRequests.length})</span>
            {incomingRequests.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#FF6B5B] animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {/* Accepted Connections Tab */}
      {activeSubTab === 'accepted' && (
        <>
          {acceptedConnections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {acceptedConnections.map(conn => {
                const peer = getPeerStudent(conn);
                return (
                  <div
                    key={conn.id}
                    className="bg-white rounded-3xl p-5 border border-[#E7EAF0] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3.5">
                        {peer.avatarUrl ? (
                          <img
                            src={peer.avatarUrl}
                            alt={peer.name}
                            className="w-12 h-12 rounded-full object-cover shrink-0 border border-[#E7EAF0]"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                            style={{ backgroundColor: peer.color || '#0F1B3D' }}
                          >
                            {peer.initials || 'CC'}
                          </div>
                        )}

                        <div className="truncate flex-1">
                          <h3 className="text-sm font-bold text-[#18233F] truncate">
                            {peer.name}
                          </h3>
                          <p className="text-xs text-[#747D91] truncate font-medium">
                            {peer.branch}
                          </p>
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md inline-block mt-1">
                            Connected Student
                          </span>
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="mt-4">
                        <div className="flex flex-wrap gap-1.5">
                          {peer.skills?.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F5F6FA] text-[#18233F] border border-[#E7EAF0]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-5 pt-3.5 border-t border-[#E7EAF0]">
                      <button
                        onClick={() => openStudentProfile(peer)}
                        className="w-full py-2 px-2 rounded-xl text-xs font-bold text-[#18233F] bg-[#F5F6FA] hover:bg-slate-200 border border-[#E7EAF0] transition-colors"
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => openChatWith(peer.uid)}
                        className="w-full py-2 px-2 rounded-xl text-xs font-bold text-[#FFC93C] bg-[#0F1B3D] hover:bg-[#18284F] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-[#E7EAF0] max-w-lg mx-auto shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-[#0F1B3D] flex items-center justify-center mx-auto mb-4 border border-[#FFC93C]/40">
                <Users className="w-8 h-8 text-[#0F1B3D]" />
              </div>
              <h3 className="text-lg font-bold text-[#18233F]">
                Your network starts with one connection.
              </h3>
              <p className="text-xs text-[#747D91] mt-1.5 max-w-sm mx-auto leading-relaxed">
                Connect with peers across departments, exchange technical skills, collaborate on college projects, and message directly.
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="mt-5 px-5 py-2.5 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <span>Discover Students</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Pending Invitations Tab */}
      {activeSubTab === 'pending' && (
        <div className="space-y-6">
          {/* Incoming Requests */}
          <div className="bg-white rounded-3xl p-6 border border-[#E7EAF0] shadow-xs">
            <h3 className="text-sm font-bold text-[#18233F] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF6B5B]"></span>
              Incoming Requests ({incomingRequests.length})
            </h3>

            {incomingRequests.length > 0 ? (
              <div className="divide-y divide-[#E7EAF0]">
                {incomingRequests.map(req => {
                  const peer = allStudents.find(s => s.uid === req.requesterId) || {
                    name: req.requesterName || 'Student',
                    branch: 'Engineering',
                    initials: 'CC'
                  };

                  return (
                    <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {peer.avatarUrl ? (
                          <img
                            src={peer.avatarUrl}
                            alt={peer.name}
                            className="w-11 h-11 rounded-full object-cover shrink-0 border border-[#E7EAF0]"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                            style={{ backgroundColor: peer.color || '#0F1B3D' }}
                          >
                            {peer.initials}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-[#18233F]">{peer.name}</h4>
                          <p className="text-xs text-[#747D91]">{peer.branch}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => acceptConnectionRequest(req.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => rejectConnectionRequest(req.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#F5F6FA] hover:bg-red-50 text-slate-600 hover:text-red-600 font-semibold text-xs border border-[#E7EAF0] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#747D91] py-4 text-center">
                No pending incoming requests right now.
              </p>
            )}
          </div>

          {/* Outgoing Requests */}
          <div className="bg-white rounded-3xl p-6 border border-[#E7EAF0] shadow-xs">
            <h3 className="text-sm font-bold text-[#18233F] mb-4">
              Sent Invitations ({outgoingRequests.length})
            </h3>

            {outgoingRequests.length > 0 ? (
              <div className="divide-y divide-[#E7EAF0]">
                {outgoingRequests.map(req => {
                  const peer = allStudents.find(s => s.uid === req.recipientId) || {
                    name: req.recipientName || 'Student',
                    branch: 'Engineering',
                    initials: 'CC'
                  };

                  return (
                    <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0"
                          style={{ backgroundColor: peer.color || '#0F1B3D' }}
                        >
                          {peer.initials}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#18233F]">{peer.name}</h4>
                          <p className="text-xs text-[#747D91]">{peer.branch}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          Waiting for approval
                        </span>
                        <button
                          onClick={() => rejectConnectionRequest(req.id)}
                          className="text-xs text-slate-400 hover:text-red-500 underline ml-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#747D91] py-4 text-center">
                No outgoing requests sent.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
