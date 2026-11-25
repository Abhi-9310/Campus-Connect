import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  initSocket,
  sendSocketMessage,
  subscribeToMessages,
  fetchConversationHistory,
  disconnectSocket,
  apiFetchUsers,
  apiFetchConnections,
  apiSendConnection,
  apiUpdateConnection,
  apiDeleteConnection,
  apiUpdateProfile,
  subscribeToConnectionUpdates,
  apiLogin,
  apiRegister,
  apiFetchMe,
  getStoredToken,
  clearStoredTokens,
  apiFetchNotifications,
  apiFetchMyMessages,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  subscribeToNotifications,
  subscribeToUserRegistrations,
  subscribeToUserUpdates,
  apiUploadAvatar,
  apiRemoveAvatar
} from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Navigation & View state
  const [activeTab, setActiveTab] = useState('discover');
  const [activeChatStudentId, setActiveChatStudentId] = useState(null);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  // Authentication Modal & Action Preservation State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState('');
  const [authModalInitialTab, setAuthModalInitialTab] = useState('login');
  const [pendingAction, setPendingAction] = useState(null); // { type: 'connect' | 'message', targetStudentId: string }
  const isResumingRef = useRef(false);

  // State for students, connections, real-time messages, and notifications
  const [allStudents, setAllStudents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Fetch registered students directly from backend database
  const refreshUsers = async (user = currentUser) => {
    try {
      const data = await apiFetchUsers(user);
      if (Array.isArray(data)) {
        setAllStudents(data);
      }
    } catch (err) {
      console.warn('[AuthContext] Could not fetch students from API:', err);
    }
  };

  // Sync notifications from backend API whenever currentUser changes
  const refreshNotifications = async (user = currentUser) => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const data = await apiFetchNotifications(user);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn('[AuthContext] Could not fetch notifications:', err);
    }
  };

  // Sync persisted messages for current user from database
  const refreshMessages = async (user = currentUser) => {
    if (!user) {
      setMessages([]);
      return;
    }
    try {
      const data = await apiFetchMyMessages(user);
      if (Array.isArray(data)) {
        const sorted = [...data].sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        setMessages(sorted);
      }
    } catch (err) {
      console.warn('[AuthContext] Could not fetch messages:', err);
    }
  };

  // Restore active session cleanly from database on boot without unmounting modals later
  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        sessionStorage.removeItem('cc_user');
        const activeUid = sessionStorage.getItem('cc_active_uid');
        const token = getStoredToken(activeUid);

        if (token) {
          const verifiedUser = await apiFetchMe(token);
          if (!cancelled && verifiedUser && verifiedUser.uid) {
            sessionStorage.setItem('cc_active_uid', verifiedUser.uid);
            setCurrentUser(verifiedUser);
            setUserProfile(verifiedUser);
            await Promise.all([
              refreshUsers(verifiedUser),
              refreshNotifications(verifiedUser),
              refreshMessages(verifiedUser)
            ]);
            return;
          }
        }

        // No valid session: clear stale session markers and load public Discover profiles from DB
        clearStoredTokens(activeUid);
        sessionStorage.removeItem('cc_active_uid');
        if (!cancelled) {
          setCurrentUser(null);
          setUserProfile(null);
          setMessages([]);
          await refreshUsers(null);
        }
      } catch (err) {
        console.warn('[AuthContext] Session bootstrap error:', err);
        if (!cancelled) {
          setCurrentUser(null);
          setUserProfile(null);
          setMessages([]);
          await refreshUsers(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync connections from backend API whenever currentUser changes
  useEffect(() => {
    if (!currentUser) {
      setConnections([]);
      return;
    }

    apiFetchConnections(currentUser)
      .then(data => {
        if (Array.isArray(data)) {
          setConnections(data);
        }
      })
      .catch(err => {
        console.warn('[AuthContext] Could not load connections:', err);
      });

    const unsubConn = subscribeToConnectionUpdates(event => {
      if (event.type === 'update') {
        setConnections(prev => {
          const idx = prev.findIndex(c => c.id === event.connection.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.connection;
            return next;
          }
          return [...prev, event.connection];
        });
      } else if (event.type === 'remove') {
        setConnections(prev => prev.filter(c => c.id !== event.id));
      }
    });

    return () => {
      unsubConn();
    };
  }, [currentUser]);

  // Real-time Socket.io connection, messages, notifications, and registration events
  useEffect(() => {
    if (!currentUser) {
      disconnectSocket();
      return;
    }

    initSocket(currentUser);

    const unsubSocket = subscribeToMessages((incomingMsg) => {
      if (incomingMsg.participants && incomingMsg.participants.includes(currentUser.uid)) {
        setMessages(prev => {
          if (prev.some(m => m.id === incomingMsg.id)) return prev;
          const updated = [...prev, incomingMsg];
          updated.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          return updated;
        });
      }
    });

    const unsubNotif = subscribeToNotifications((incomingNotif) => {
      if (incomingNotif.recipientId === currentUser.uid) {
        setNotifications(prev => {
          if (prev.some(n => n.id === incomingNotif.id)) return prev;
          return [incomingNotif, ...prev];
        });
      }
    });

    const unsubReg = subscribeToUserRegistrations(() => {
      refreshUsers(currentUser);
    });

    const unsubUserUpdate = subscribeToUserUpdates((payload) => {
      if (!payload?.uid) return;
      const patch = {};
      ['name', 'branch', 'year', 'bio', 'skills', 'avatarUrl', 'initials'].forEach((key) => {
        if (payload[key] !== undefined) {
          patch[key] = payload[key];
        }
      });

      if (currentUser && payload.uid === currentUser.uid) {
        setCurrentUser(prev => prev ? ({ ...prev, ...patch }) : prev);
        setUserProfile(prev => prev ? ({ ...prev, ...patch }) : prev);
      }
      setAllStudents(prev => prev.map(s => s.uid === payload.uid ? { ...s, ...patch } : s));
    });

    return () => {
      unsubSocket();
      unsubNotif();
      unsubReg();
      unsubUserUpdate();
    };
  }, [currentUser]);

  // Load conversation history whenever activeChatStudentId changes
  useEffect(() => {
    if (!currentUser || !activeChatStudentId) return;

    fetchConversationHistory(activeChatStudentId, currentUser).then(history => {
      if (Array.isArray(history) && history.length > 0) {
        setMessages(prev => {
          const map = new Map();
          prev.forEach(m => map.set(m.id, m));
          history.forEach(m => map.set(m.id, m));
          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          return merged;
        });
      }
    });
  }, [currentUser, activeChatStudentId]);

  // ==================== AUTH PROTECTION & MODAL HELPERS ====================

  const requireAuth = (actionType, targetStudentId, customMessage) => {
    if (currentUser) {
      return true;
    }

    setPendingAction({
      type: actionType,
      targetStudentId
    });
    setAuthModalInitialTab('login');
    setAuthModalMessage(customMessage || 'Please log in to continue.');
    setAuthModalOpen(true);
    return false;
  };

  const openAuthModal = (message = 'Please log in or create an account.', initialTab = 'login') => {
    setAuthModalInitialTab(initialTab);
    setAuthModalMessage(message);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setPendingAction(null);
  };

  const resumePendingAction = async (authedUser) => {
    if (isResumingRef.current) return;
    if (!pendingAction) return;

    const action = pendingAction;
    isResumingRef.current = true;
    setPendingAction(null);
    setAuthModalOpen(false);

    try {
      if (action.type === 'connect') {
        await apiSendConnection(action.targetStudentId, authedUser);
        const updatedConns = await apiFetchConnections(authedUser);
        if (Array.isArray(updatedConns)) setConnections(updatedConns);
      } else if (action.type === 'message') {
        setActiveChatStudentId(action.targetStudentId);
        setActiveTab('messages');
      }
    } catch (err) {
      console.warn('[AuthContext] Error resuming preserved action:', err);
    } finally {
      isResumingRef.current = false;
    }
  };

  // ==================== AUTHENTICATION ACTIONS ====================

  const loginWithCredentials = async (email, password) => {
    const data = await apiLogin(email, password);
    if (!data?.user?.uid || !data?.token) {
      throw new Error('Unexpected login response from server');
    }

    sessionStorage.setItem('cc_active_uid', data.user.uid);
    sessionStorage.removeItem('cc_user');
    setCurrentUser(data.user);
    setUserProfile(data.user);
    await Promise.all([
      refreshUsers(data.user),
      refreshNotifications(data.user),
      refreshMessages(data.user)
    ]);
    setAuthModalOpen(false);
    await resumePendingAction(data.user);
    return data.user;
  };

  const registerWithCredentials = async (payload) => {
    const data = await apiRegister(payload);
    if (!data?.user?.uid) {
      throw new Error('Account creation failed. Please try again.');
    }

    // Refresh Discover list from backend database so the registered profile is persisted & visible
    await refreshUsers(currentUser);
    return data;
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    setFirebaseUser(result.user);
    return result.user;
  };

  const logout = async () => {
    try {
      const uid = currentUser?.uid || sessionStorage.getItem('cc_active_uid');
      clearStoredTokens(uid);
      sessionStorage.removeItem('cc_active_uid');
      sessionStorage.removeItem('cc_user');
      disconnectSocket();
      if (firebaseUser) {
        await signOut(auth).catch(() => {});
        setFirebaseUser(null);
      }
      setCurrentUser(null);
      setUserProfile(null);
      setNotifications([]);
      setConnections([]);
      setMessages([]);
      setActiveTab('discover');
      setActiveChatStudentId(null);
      // Immediately fetch all registered student profiles so logged-out profiles remain visible in Discover
      await refreshUsers(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // ==================== NOTIFICATIONS ACTIONS ====================

  const markNotificationAsRead = async (id) => {
    if (!currentUser) return;
    try {
      await apiMarkNotificationRead(id, currentUser);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('[AuthContext] Error marking notification read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!currentUser) return;
    try {
      await apiMarkAllNotificationsRead(currentUser);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('[AuthContext] Error marking all notifications read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif) return;
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
    }
    if (notif.relatedUserId) {
      let student = allStudents.find(s => s.uid === notif.relatedUserId);
      if (!student) {
        try {
          const freshList = await apiFetchUsers(currentUser);
          if (Array.isArray(freshList)) {
            setAllStudents(freshList);
            student = freshList.find(s => s.uid === notif.relatedUserId);
          }
        } catch {}
      }
      if (student) {
        openStudentProfile(student);
      } else {
        openStudentProfile({
          uid: notif.relatedUserId,
          name: notif.senderName || 'Student',
          initials: notif.senderInitials || 'CC',
          avatarUrl: notif.senderAvatarUrl || '',
          branch: 'Campus Connect',
          year: 'Registered Student',
          bio: 'Campus Connect Student',
          skills: []
        });
      }
    }
  };

  const updateUserProfile = async (updatedData) => {
    if (!currentUser) return;
    const updatedUser = await apiUpdateProfile(updatedData, currentUser);
    if (!updatedUser || !updatedUser.uid) {
      throw new Error('Profile update was not confirmed by the database');
    }
    setCurrentUser(updatedUser);
    setUserProfile(updatedUser);
    await refreshUsers(updatedUser);
    return updatedUser;
  };

  const uploadAvatar = async (file) => {
    if (!currentUser) return;
    const res = await apiUploadAvatar(file, currentUser);
    if (res && res.user) {
      setCurrentUser(res.user);
      setUserProfile(res.user);
      setAllStudents(prev => prev.map(s => s.uid === res.user.uid ? { ...s, avatarUrl: res.user.avatarUrl } : s));
    }
    return res;
  };

  const removeAvatar = async () => {
    if (!currentUser) return;
    const res = await apiRemoveAvatar(currentUser);
    if (res && res.user) {
      setCurrentUser(res.user);
      setUserProfile(res.user);
      setAllStudents(prev => prev.map(s => s.uid === res.user.uid ? { ...s, avatarUrl: '' } : s));
    }
    return res;
  };

  // Connection helpers via Express API
  const sendConnectionRequest = async (targetStudent) => {
    if (!currentUser) {
      requireAuth('connect', targetStudent.uid, 'Please log in to connect with other students.');
      return;
    }
    if (currentUser.uid === targetStudent.uid) return;

    const alreadyConnected = connections.some(
      c => (c.requesterId === currentUser.uid && c.recipientId === targetStudent.uid) ||
           (c.requesterId === targetStudent.uid && c.recipientId === currentUser.uid)
    );
    if (alreadyConnected) return;

    try {
      const created = await apiSendConnection(targetStudent.uid, currentUser);
      if (created) {
        setConnections(prev => [...prev, created]);
      }
    } catch (err) {
      console.error('[AuthContext] Send connection error:', err);
    }
  };

  const acceptConnectionRequest = async (connectionId) => {
    if (!currentUser) return;
    try {
      const updated = await apiUpdateConnection(connectionId, 'accepted', currentUser);
      if (updated) {
        setConnections(prev => prev.map(c => c.id === connectionId ? updated : c));
      }
    } catch (err) {
      console.error('[AuthContext] Accept connection error:', err);
    }
  };

  const rejectConnectionRequest = async (connectionId) => {
    if (!currentUser) return;
    try {
      await apiDeleteConnection(connectionId, currentUser);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (err) {
      console.error('[AuthContext] Reject connection error:', err);
    }
  };

  // Messaging helpers
  const sendMessage = async (recipientId, text) => {
    if (!currentUser) {
      requireAuth('message', recipientId, 'Please log in to message other students and start conversations.');
      return;
    }
    if (!text.trim() || currentUser.uid === recipientId) return;

    const trimmedText = text.trim();
    const tempId = 'temp_' + Date.now();

    try {
      const savedMsg = await sendSocketMessage(recipientId, trimmedText, tempId);

      if (savedMsg) {
        setMessages(prev => {
          if (prev.some(m => m.id === savedMsg.id)) return prev;
          const updated = [...prev, savedMsg];
          updated.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          return updated;
        });
      }

      return savedMsg;
    } catch (err) {
      console.error('[AuthContext] Failed to deliver message:', err);
      throw err;
    }
  };

  const openChatWith = (studentId) => {
    if (!currentUser) {
      requireAuth('message', studentId, 'Please log in to message other students and start conversations.');
      return;
    }
    setActiveChatStudentId(studentId);
    setActiveTab('messages');
  };

  const openStudentProfile = (student) => {
    setSelectedStudentForModal(student);
  };

  const closeStudentProfile = () => {
    setSelectedStudentForModal(null);
  };

  const unreadNotificationsCount = Array.isArray(notifications)
    ? notifications.filter(n => !n.isRead).length
    : 0;
  const unreadCount = unreadNotificationsCount;

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: Boolean(currentUser),
      userProfile,
      firebaseUser,
      loading,
      activeTab,
      setActiveTab,
      activeChatStudentId,
      setActiveChatStudentId,
      openChatWith,
      selectedStudentForModal,
      openStudentProfile,
      closeStudentProfile,
      allStudents,
      refreshUsers,
      connections,
      messages,
      unreadCount,
      notifications,
      unreadNotificationsCount,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      handleNotificationClick,
      authModalOpen,
      authModalMessage,
      authModalInitialTab,
      requireAuth,
      openAuthModal,
      closeAuthModal,
      loginWithCredentials,
      registerWithCredentials,
      loginWithGoogle,
      logout,
      updateUserProfile,
      uploadAvatar,
      removeAvatar,
      sendConnectionRequest,
      acceptConnectionRequest,
      rejectConnectionRequest,
      sendMessage
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
