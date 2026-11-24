import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Send, 
  Search, 
  MessageSquare, 
  GraduationCap, 
  Compass, 
  User, 
  CheckCheck,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAssetUrl } from '../services/socket';

export default function Messages() {
  const { 
    currentUser, 
    allStudents, 
    messages, 
    sendMessage, 
    activeChatStudentId, 
    setActiveChatStudentId,
    setActiveTab,
    openStudentProfile,
    openAuthModal 
  } = useAuth();

  const [inputMessage, setInputMessage] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  if (!currentUser) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-[#E7EAF0] max-w-lg mx-auto shadow-xs my-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center mx-auto mb-4 border border-[#FFC93C]/40">
          <MessageSquare className="w-8 h-8 text-[#0F1B3D]" />
        </div>
        <h3 className="text-xl font-bold text-[#18233F]">
          Direct Student Messaging
        </h3>
        <p className="text-xs text-[#747D91] mt-2 max-w-sm mx-auto leading-relaxed">
          Please log in to message other students and start conversations.
        </p>
        <button
          onClick={() => openAuthModal('Please log in to message other students and start conversations.')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-colors inline-flex items-center gap-2 shadow-xs active:scale-95"
        >
          <span>Log In to Message</span>
        </button>
      </div>
    );
  }

  // Derive conversation summaries cleanly
  const conversations = useMemo(() => {
    if (!currentUser) return [];
    const map = {};

    messages.forEach(msg => {
      const isMeFrom = msg.from === currentUser.uid;
      const isMeTo = msg.to === currentUser.uid;
      if (!isMeFrom && !isMeTo) return;

      const peerId = isMeFrom ? msg.to : msg.from;
      if (!peerId) return;

      if (!map[peerId]) {
        map[peerId] = {
          peerId,
          lastMessage: msg
        };
      } else {
        const existingTime = new Date(map[peerId].lastMessage?.createdAt || 0).getTime();
        const msgTime = new Date(msg.createdAt || 0).getTime();
        if (msgTime > existingTime) {
          map[peerId].lastMessage = msg;
        }
      }
    });

    // Ensure active chat peer is listed even before first message
    if (activeChatStudentId && !map[activeChatStudentId] && activeChatStudentId !== currentUser.uid) {
      map[activeChatStudentId] = {
        peerId: activeChatStudentId,
        lastMessage: null
      };
    }

    return Object.values(map).sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [messages, currentUser, activeChatStudentId]);

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    const peer = allStudents.find(s => s.uid === conv.peerId);
    if (!peer) return false;
    if (!conversationSearch.trim()) return true;
    return peer.name.toLowerCase().includes(conversationSearch.toLowerCase().trim()) ||
           peer.branch.toLowerCase().includes(conversationSearch.toLowerCase().trim());
  });

  // Active chat peer
  const activePeer = allStudents.find(s => s.uid === activeChatStudentId);

  // Derive current conversation messages strictly for this peer, deduplicated and sorted
  const currentChatMessages = useMemo(() => {
    if (!activeChatStudentId || !currentUser) return [];
    const map = new Map();
    messages.forEach(m => {
      const isBetweenUs = 
        (m.from === currentUser.uid && m.to === activeChatStudentId) ||
        (m.from === activeChatStudentId && m.to === currentUser.uid);
      if (isBetweenUs) {
        map.set(m.id, m);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  }, [messages, currentUser, activeChatStudentId]);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChatMessages, activeChatStudentId]);

  useEffect(() => {
    if (activeChatStudentId) {
      setShowMobileChat(true);
    }
  }, [activeChatStudentId]);

  const handleSend = async (e) => {
    e.preventDefault();
    const textToSend = inputMessage.trim();
    if (!textToSend || !activeChatStudentId || isSending) return;

    try {
      setIsSending(true);
      await sendMessage(activeChatStudentId, textToSend);
      setInputMessage('');
    } catch (err) {
      console.error('[Messages] Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] min-h-[550px] bg-white rounded-3xl border border-[#E7EAF0] shadow-sm flex overflow-hidden">
      {/* LEFT PANEL: Conversation Sidebar (approx 320px) */}
      <div 
        className={`w-full md:w-[320px] md:shrink-0 flex flex-col border-r border-[#E7EAF0] bg-white z-10 ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#E7EAF0]">
          <h2 className="text-lg font-bold text-[#18233F] tracking-tight">Messages</h2>
          
          {/* Conversation Search */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-[#747D91] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs text-[#18233F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F1B3D]"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E7EAF0]">
          {filteredConversations.length > 0 ? (
            filteredConversations.map(conv => {
              const peer = allStudents.find(s => s.uid === conv.peerId);
              if (!peer) return null;
              const isActive = activeChatStudentId === peer.uid;

              return (
                <button
                  key={conv.peerId}
                  onClick={() => {
                    setActiveChatStudentId(peer.uid);
                    setShowMobileChat(true);
                  }}
                  className={`w-full p-3.5 flex items-start gap-3 transition-colors text-left ${
                    isActive ? 'bg-[#0F1B3D]/5 border-l-4 border-[#0F1B3D]' : 'hover:bg-[#F5F6FA]'
                  }`}
                >
                  {peer.avatarUrl ? (
                    <img 
                      src={resolveAssetUrl(peer.avatarUrl)} 
                      alt={peer.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#E7EAF0]"
                    />
                  ) : (
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                      style={{ backgroundColor: peer.color || '#0F1B3D' }}
                    >
                      {peer.initials || 'CC'}
                    </div>
                  )}

                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#18233F] truncate">{peer.name}</h4>
                      <span className="text-[10px] text-[#747D91]">
                        {conv.lastMessage ? formatMessageTime(conv.lastMessage.createdAt) : ''}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#747D91] truncate mt-0.5">
                      {conv.lastMessage 
                        ? (conv.lastMessage.from === currentUser?.uid ? 'You: ' : '') + conv.lastMessage.text
                        : 'Started a new conversation'}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-[#747D91]">No chats found</p>
              <button
                onClick={() => setActiveTab('discover')}
                className="mt-3 text-xs font-bold text-[#0F1B3D] hover:underline"
              >
                Find peers on campus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Chat Window */}
      <div 
        className={`flex-1 flex flex-col bg-[#F5F6FA] ${
          !showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activePeer ? (
          <>
            {/* Chat Header */}
            <div className="p-3.5 px-4 bg-white border-b border-[#E7EAF0] flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {activePeer.avatarUrl ? (
                  <img 
                    src={resolveAssetUrl(activePeer.avatarUrl)} 
                    alt={activePeer.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#E7EAF0]"
                  />
                ) : (
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                    style={{ backgroundColor: activePeer.color || '#0F1B3D' }}
                  >
                    {activePeer.initials || 'CC'}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold text-[#18233F]">{activePeer.name}</h3>
                  <p className="text-[11px] text-[#747D91] flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-[#0F1B3D]" />
                    <span>{activePeer.branch}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => openStudentProfile(activePeer)}
                className="px-3 py-1.5 rounded-xl bg-[#F5F6FA] hover:bg-slate-200 border border-[#E7EAF0] text-xs font-semibold text-[#18233F] transition-colors"
              >
                View Profile
              </button>
            </div>

            {/* Chat Messages History */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3.5">
              {currentChatMessages.length > 0 ? (
                currentChatMessages.map((msg, index) => {
                  const isSentByMe = msg.from === currentUser?.uid;

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col ${isSentByMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs md:text-sm shadow-2xs ${
                          isSentByMe
                            ? 'bg-[#0F1B3D] text-white rounded-br-xs'
                            : 'bg-white text-[#18233F] border border-[#E7EAF0] rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      </div>

                      <span className="text-[10px] text-[#747D91] mt-1 px-1">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-xs mb-3 border border-[#E7EAF0]">
                    <MessageSquare className="w-6 h-6 text-[#0F1B3D]" />
                  </div>
                  <h4 className="text-sm font-bold text-[#18233F]">Say hello to {activePeer.name}!</h4>
                  <p className="text-xs text-[#747D91] max-w-xs mt-1">
                    Ask about their projects, technical skills in {activePeer.skills?.[0] || 'engineering'}, or collaborate on coursework.
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Bar */}
            <div className="p-3 bg-white border-t border-[#E7EAF0]">
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Write a message to ${activePeer.name}...`}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F5F6FA] border border-[#E7EAF0] text-xs md:text-sm text-[#18233F] focus:outline-none focus:ring-2 focus:ring-[#0F1B3D] focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="p-2.5 rounded-2xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] disabled:opacity-40 disabled:hover:bg-[#0F1B3D] shadow-xs transition-all active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty Chat Window State */
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-3xl bg-[#0F1B3D]/5 text-[#0F1B3D] flex items-center justify-center mb-4 border border-[#0F1B3D]/10">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#18233F]">Your conversations start here.</h3>
            <p className="text-xs text-[#747D91] max-w-sm mt-1.5 leading-relaxed">
              Find a student and send your first message to discuss hackathon projects, academic skills, and college clubs.
            </p>
            <button
              onClick={() => setActiveTab('discover')}
              className="mt-5 px-5 py-2.5 rounded-xl bg-[#0F1B3D] hover:bg-[#18284F] text-[#FFC93C] font-bold text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              <Compass className="w-4 h-4" />
              <span>Discover Students</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
