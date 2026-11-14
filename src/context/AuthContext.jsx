import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
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
  getAuthToken,
  apiFetchNotifications,
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
  const [pendingAction, setPendingAction] = useState(null); // { type: 'connect' | 'message', targetStudentId: string }
  const isResumingRef = useRef(false);

  // State for students, connections, real-time messages, and notifications
  const [allStudents, setAllStudents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Fetch real students from Express API based on current authentication state
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

  // Initial user fetch on boot
  useEffect(() => {
    refreshUsers(currentUser);
  }, []);

  // Monitor Firebase Auth / session restoration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          let profile = null;
          if (snap.exists()) {
            profile = snap.data();
          } else {
            profile = {
              uid: user.uid,
              name: user.displayName || 'Campus Scholar',
              email: user.email,
              branch: 'Computer Science & Engineering',
              year: '3rd Year',
              bio: 'Passionate student eager to connect and build awesome projects.',
              skills: ['React', 'JavaScript', 'Python'],
              avatarUrl: user.photoURL || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, profile);
          }
          const loadedUser = {
            ...profile,
            initials: (profile.name || 'CS').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          };
          setCurrentUser(loadedUser);
          setUserProfile(loadedUser);
          refreshUsers(loadedUser);
          refreshNotifications(loadedUser);
          resumePendingAction(loadedUser);
        } catch (err) {
          console.warn('[AuthContext] Firebase auth sync skipped:', err);
        }
      } else {
        // Restore genuine registered user from sessionStorage if available
        const savedUserStr = sessionStorage.getItem('cc_user');
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed && parsed.uid) {
              setCurrentUser(parsed);
              setUserProfile(parsed);
              refreshUsers(parsed);
              refreshNotifications(parsed);
            }
          } catch {
            setCurrentUser(null);
            setUserProfile(null);
            refreshUsers(null);
          }
        } else {
          // Anonymous visitor by default
          setCurrentUser(null);
          setUserProfile(null);
          refreshUsers(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync notifications from Express API whenever currentUser changes
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

  useEffect(() => {
    refreshNotifications(currentUser);
  }, [currentUser]);

  // Sync connections from Express API whenever currentUser changes
  useEffect(() => {
    if (!currentUser) {
      setConnections([]);
      return;
    }

    apiFetchConnections(currentUser).then(data => {
      if (Array.isArray(data)) {
        setConnections(data);
      }
    }).catch(err => {
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
      console.log('[AuthContext] Real-time message arrived:', incomingMsg);
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
      console.log('[AuthContext] Real-time notification received:', incomingNotif);
      if (incomingNotif.recipientId === currentUser.uid) {
        setNotifications(prev => {
          if (prev.some(n => n.id === incomingNotif.id)) return prev;
          return [incomingNotif, ...prev];
        });
      }
    });

    const unsubReg = subscribeToUserRegistrations((payload) => {
      console.log('[AuthContext] Live campus registration event:', payload);
      refreshUsers(currentUser);
    });

    const unsubUserUpdate = subscribeToUserUpdates((payload) => {
      console.log('[AuthContext] Live student update event:', payload);
      if (currentUser && payload.uid === currentUser.uid) {
        setCurrentUser(prev => prev ? ({ ...prev, avatarUrl: payload.avatarUrl }) : prev);
        setUserProfile(prev => prev ? ({ ...prev, avatarUrl: payload.avatarUrl }) : prev);
      }
      setAllStudents(prev => prev.map(s => s.uid === payload.uid ? { ...s, avatarUrl: payload.avatarUrl } : s));
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

  /**
   * Guards protected actions (Connect, Message).
   * Returns true if authenticated. If anonymous, opens the login modal and stores intended action.
   */
  const requireAuth = (actionType, targetStudentId, customMessage) => {
    if (currentUser) {
      return true;
    }

    // Preserve the intended student and action
    setPendingAction({
      type: actionType,
      targetStudentId
    });
    setAuthModalMessage(customMessage || 'Please log in to continue.');
    setAuthModalOpen(true);
    return false;
  };

  const openAuthModal = (message = 'Please log in or create an account.') => {
    setAuthModalMessage(message);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    // User closed the dialogue: cancel pending action
    setPendingAction(null);
  };

  /**
   * Resumes preserved action after successful login or registration
   */
  const resumePendingAction = async (authedUser) => {
    if (isResumingRef.current) return;
    if (!pendingAction) return;

    const action = pendingAction;
    isResumingRef.current = true;
    setPendingAction(null);
    setAuthModalOpen(false);

    try {
      if (action.type === 'connect') {
        console.log(`[AuthContext] Resuming preserved connection request to ${action.targetStudentId}`);
        await apiSendConnection(action.targetStudentId, authedUser);
        // Refresh connections
        const updatedConns = await apiFetchConnections(authedUser);
        if (Array.isArray(updatedConns)) setConnections(updatedConns);
      } else if (action.type === 'message') {
        console.log(`[AuthContext] Resuming preserved conversation with ${action.targetStudentId}`);
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
    try {
      setLoading(true);
      const data = await apiLogin(email, password);
      sessionStorage.setItem('cc_active_uid', data.user.uid);
      sessionStorage.setItem('cc_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setUserProfile(data.user);
      await refreshUsers(data.user);
      await refreshNotifications(data.user);
      setAuthModalOpen(false);
      await resumePendingAction(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const registerWithCredentials = async (payload) => {
    try {
      setLoading(true);
      const data = await apiRegister(payload);
      sessionStorage.setItem('cc_active_uid', data.user.uid);
      sessionStorage.setItem('cc_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setUserProfile(data.user);
      await refreshUsers(data.user);
      await refreshNotifications(data.user);
      setAuthModalOpen(false);
      await resumePendingAction(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.error('Google Sign in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem('cc_active_uid');
      sessionStorage.removeItem('cc_user');
      disconnectSocket();
      if (firebaseUser) {
        await signOut(auth);
      }
      setCurrentUser(null);
      setUserProfile(null);
      setNotifications([]);
      setActiveTab('discover');
      setActiveChatStudentId(null);
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
    const merged = { ...currentUser, ...updatedData, updatedAt: new Date().toISOString() };
    setCurrentUser(merged);
    setUserProfile(merged);
    
    try {
      await apiUpdateProfile(updatedData, currentUser);
    } catch (err) {
      console.warn('[AuthContext] Profile update via API:', err);
    }

    if (firebaseUser) {
      try {
        const ref = doc(db, 'users', firebaseUser.uid);
        await updateDoc(ref, updatedData);
      } catch (err) {
        console.warn('[AuthContext] Firestore profile sync skipped:', err);
      }
    }
  };

  // Upload student profile picture
  const uploadAvatar = async (file) => {
    if (!currentUser) return;
    const res = await apiUploadAvatar(file, currentUser);
    if (res && res.user) {
      setCurrentUser(res.user);
      setUserProfile(res.user);
      sessionStorage.setItem('cc_user', JSON.stringify(res.user));
      setAllStudents(prev => prev.map(s => s.uid === res.user.uid ? { ...s, avatarUrl: res.user.avatarUrl } : s));
    }
    return res;
  };

  // Remove student profile picture
  const removeAvatar = async () => {
    if (!currentUser) return;
    const res = await apiRemoveAvatar(currentUser);
    if (res && res.user) {
      setCurrentUser(res.user);
      setUserProfile(res.user);
      sessionStorage.setItem('cc_user', JSON.stringify(res.user));
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

    // Check duplicate
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

  // Unread notifications count (synchronizes with database, real-time socket, mark-as-read, and resets to 0 on logout/anonymous)
  const unreadNotificationsCount = Array.isArray(notifications)
    ? notifications.filter(n => !n.isRead).length
    : 0;
  // Expose unreadCount as direct alias so any consumer accessing either property name receives the correct count
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
      connections,
      messages,
      unreadCount,
      // Notifications
      notifications,
      unreadNotificationsCount,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      handleNotificationClick,
      // Auth Modal & Protection API
      authModalOpen,
      authModalMessage,
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
