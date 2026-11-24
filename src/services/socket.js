import { io } from 'socket.io-client';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/') && API_BASE_URL) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? 'Unexpected response format from server'
        : `Server error (${res.status}). Please verify the backend service is running.`
    );
  }
}

let socket = null;
let currentToken = null;
const messageListeners = new Set();
const savedListeners = new Set();
const errorListeners = new Set();
const connectionListeners = new Set();
const notificationListeners = new Set();
const registrationListeners = new Set();
const userUpdateListeners = new Set();

export function getStoredToken(uid) {
  const globalToken = sessionStorage.getItem('cc_token');
  if (globalToken) return globalToken;
  if (uid) {
    return sessionStorage.getItem(`cc_token_${uid}`);
  }
  return null;
}

export function clearStoredTokens(uid) {
  currentToken = null;
  sessionStorage.removeItem('cc_token');
  if (uid) {
    sessionStorage.removeItem(`cc_token_${uid}`);
  }
}

/**
 * Obtain a signed JWT for the authenticated student from backend
 */
export async function getAuthToken(user) {
  if (!user || !user.uid) return null;

  const cached = getStoredToken(user.uid);
  if (cached) {
    currentToken = cached;
    return cached;
  }

  try {
    const res = await fetch(apiUrl('/api/auth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        name: user.name || 'Student',
        email: user.email || ''
      })
    });

    if (!res.ok) {
      throw new Error(`Auth token request failed: ${res.statusText}`);
    }

    const data = await parseJsonSafely(res);
    if (data?.token) {
      sessionStorage.setItem('cc_token', data.token);
      sessionStorage.setItem(`cc_token_${user.uid}`, data.token);
      currentToken = data.token;
      return data.token;
    }
  } catch (err) {
    console.error('[Socket Client] Failed to retrieve JWT token:', err);
  }
  return null;
}

/**
 * Verify JWT and load latest student profile from backend
 */
export async function apiFetchMe(token) {
  const authToken = token || currentToken || sessionStorage.getItem('cc_token');
  if (!authToken) return null;

  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 404) {
      clearStoredTokens();
    }
    return null;
  }

  currentToken = authToken;
  return await parseJsonSafely(res);
}

/**
 * Initialize and connect Socket.io instance with authenticated user
 * Uses polling-first transport to prevent 'WebSocket closed without opened' errors in iframes
 */
export async function initSocket(user) {
  if (!user || !user.uid) return null;

  if (socket && socket.connected && socket._userId === user.uid) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const token = await getAuthToken(user);
  if (!token) {
    console.warn('[Socket Client] Cannot connect socket: No JWT token available');
    return null;
  }

  currentToken = token;

  socket = io(API_BASE_URL || window.location.origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  socket._userId = user.uid;

  socket.on('connect', () => {
    console.log(`[Socket Client] Connected successfully as ${user.name} (${user.uid}) | Socket ID: ${socket.id}`);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket Client] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket Client] Disconnected: ${reason}`);
  });

  socket.on('receive_message', (message) => {
    console.log(`[Socket Client] Received incoming message from ${message.from}:`, message);
    messageListeners.forEach(fn => fn(message));
  });

  socket.on('message_saved', (payload) => {
    console.log('[Socket Client] Message saved confirmation received:', payload);
    savedListeners.forEach(fn => fn(payload));
  });

  socket.on('connection_updated', (conn) => {
    console.log('[Socket Client] Connection updated:', conn);
    connectionListeners.forEach(fn => fn({ type: 'update', connection: conn }));
  });

  socket.on('connection_removed', (payload) => {
    console.log('[Socket Client] Connection removed:', payload);
    connectionListeners.forEach(fn => fn({ type: 'remove', id: payload.id }));
  });

  socket.on('receive_notification', (notif) => {
    console.log('[Socket Client] Received notification:', notif);
    notificationListeners.forEach(fn => fn(notif));
  });

  socket.on('user_registered', (payload) => {
    console.log('[Socket Client] New student registered broadcast:', payload);
    registrationListeners.forEach(fn => fn(payload));
  });

  socket.on('user_updated', (payload) => {
    console.log('[Socket Client] Student updated broadcast:', payload);
    userUpdateListeners.forEach(fn => fn(payload));
  });

  socket.on('message_error', (err) => {
    console.error('[Socket Client] Message error from server:', err);
    errorListeners.forEach(fn => fn(err));
  });

  return socket;
}

/**
 * Send real-time private message via Socket.io
 */
export function sendSocketMessage(to, text, tempId) {
  if (!socket || !socket.connected) {
    console.warn('[Socket Client] Socket not connected. Attempting HTTP fallback...');
    return sendRestMessage(to, text);
  }

  return new Promise((resolve, reject) => {
    const tid = tempId || 'temp_' + Date.now();

    const timeout = setTimeout(() => {
      console.warn('[Socket Client] Socket ack timed out, falling back to REST');
      sendRestMessage(to, text).then(resolve).catch(reject);
    }, 4000);

    const onSaved = (payload) => {
      if (payload.tempId === tid || payload.message?.to === to) {
        clearTimeout(timeout);
        savedListeners.delete(onSaved);
        resolve(payload.message);
      }
    };

    savedListeners.add(onSaved);

    socket.emit('send_message', {
      to,
      text,
      tempId: tid
    });
  });
}

/**
 * REST fallback to send message
 */
export async function sendRestMessage(to, text) {
  if (!currentToken) return null;
  const res = await fetch(apiUrl(`/api/messages/${to}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    throw new Error('Failed to send message via REST API');
  }

  return await res.json();
}

/**
 * Fetch persistent message history between current user and target user
 */
export async function fetchConversationHistory(targetUserId, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return [];

  try {
    const res = await fetch(apiUrl(`/api/messages/${targetUserId}`), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('[Socket Client] Error fetching conversation history:', err);
    return [];
  }
}

/**
 * Register account with Express backend
 */
export async function apiRegister(payload) {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Registration failed');
  }

  return data;
}

/**
 * Login with email and password with Express backend
 */
export async function apiLogin(email, password) {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Login failed');
  }

  if (data?.token && data?.user?.uid) {
    currentToken = data.token;
    sessionStorage.setItem('cc_token', data.token);
    sessionStorage.setItem(`cc_token_${data.user.uid}`, data.token);
  }

  return data;
}

/**
 * Fetch all students from Express backend (authenticated with token if available)
 */
export async function apiFetchUsers(user) {
  const token = user ? (currentToken || await getAuthToken(user)) : null;
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(apiUrl('/api/users'), { headers });
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  } catch (err) {
    console.error('[API Client] Error fetching users:', err);
    return null;
  }
}

/**
 * Fetch connections for current user from Express backend
 */
export async function apiFetchConnections(user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return [];

  try {
    const res = await fetch(apiUrl('/api/connections'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch connections');
    return await res.json();
  } catch (err) {
    console.error('[API Client] Error fetching connections:', err);
    return [];
  }
}

/**
 * Send connection request via Express backend
 */
export async function apiSendConnection(targetUserId, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return null;

  const res = await fetch(apiUrl(`/api/connections/${targetUserId}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error('Failed to send connection request');
  }
  return await res.json();
}

/**
 * Update connection status (accept/reject) via Express backend
 */
export async function apiUpdateConnection(requestId, status, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return null;

  const res = await fetch(apiUrl(`/api/connections/${requestId}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  if (!res.ok) {
    throw new Error('Failed to update connection request');
  }
  return await res.json();
}

/**
 * Delete connection via Express backend
 */
export async function apiDeleteConnection(requestId, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return null;

  const res = await fetch(apiUrl(`/api/connections/${requestId}`), {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Failed to delete connection');
  }
  return await res.json();
}

/**
 * Update profile via Express backend
 */
export async function apiUpdateProfile(updatedData, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return null;

  const res = await fetch(apiUrl('/api/users/me'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updatedData)
  });

  if (!res.ok) {
    throw new Error('Failed to update profile via API');
  }
  return await res.json();
}

/**
 * Subscribe to incoming message events
 */
export function subscribeToMessages(callback) {
  messageListeners.add(callback);
  return () => messageListeners.delete(callback);
}

/**
 * Subscribe to connection update events
 */
export function subscribeToConnectionUpdates(callback) {
  connectionListeners.add(callback);
  return () => connectionListeners.delete(callback);
}

/**
 * Subscribe to message saved events
 */
export function subscribeToMessageSaved(callback) {
  savedListeners.add(callback);
  return () => savedListeners.delete(callback);
}

/**
 * Fetch all notifications for current authenticated user
 */
export async function apiFetchNotifications(user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return [];

  try {
    const res = await fetch(apiUrl('/api/notifications'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return await res.json();
  } catch (err) {
    console.error('[API Client] Error fetching notifications:', err);
    return [];
  }
}

/**
 * Mark a single notification as read
 */
export async function apiMarkNotificationRead(notificationId, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return null;

  try {
    const res = await fetch(apiUrl(`/api/notifications/${notificationId}/read`), {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to mark notification read');
    return await res.json();
  } catch (err) {
    console.error('[API Client] Error marking notification read:', err);
    return null;
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function apiMarkAllNotificationsRead(user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) return null;

  try {
    const res = await fetch(apiUrl('/api/notifications/read-all'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to mark all notifications read');
    return await res.json();
  } catch (err) {
    console.error('[API Client] Error marking all notifications read:', err);
    return null;
  }
}

/**
 * Subscribe to real-time notification events
 */
export function subscribeToNotifications(callback) {
  notificationListeners.add(callback);
  return () => notificationListeners.delete(callback);
}

/**
 * Subscribe to new student registration events across campus
 */
export function subscribeToUserRegistrations(callback) {
  registrationListeners.add(callback);
  return () => registrationListeners.delete(callback);
}

/**
 * Subscribe to student profile updates across campus
 */
export function subscribeToUserUpdates(callback) {
  userUpdateListeners.add(callback);
  return () => userUpdateListeners.delete(callback);
}

/**
 * Upload student profile picture
 */
export async function apiUploadAvatar(file, user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) throw new Error('Authentication required');

  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch(apiUrl('/api/users/me/avatar'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload profile picture');
  }
  return data;
}

/**
 * Remove student profile picture
 */
export async function apiRemoveAvatar(user) {
  const token = currentToken || await getAuthToken(user);
  if (!token) throw new Error('Authentication required');

  const res = await fetch(apiUrl('/api/users/me/avatar'), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove profile picture');
  }
  return data;
}

/**
 * Disconnect socket cleanly
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

