import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { MongoClient } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { createServer as createViteServer } from 'vite';

const app = express();
const httpServer = http.createServer(app);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'campus_connect_local_dev_secret');

if (isProd && !JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in the production environment.');
}

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB persistence. Caches are loaded at startup and each mutation is written to MongoDB.
let mongoDb: import('mongodb').Db;
async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI must be configured.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  mongoDb = client.db();
  await Promise.all([
    mongoDb.collection('users').createIndex({ uid: 1 }, { unique: true }),
    mongoDb.collection('users').createIndex({ email: 1 }, { unique: true }),
    mongoDb.collection('connections').createIndex({ id: 1 }, { unique: true }),
    mongoDb.collection('messages').createIndex({ id: 1 }, { unique: true }),
    mongoDb.collection('messages').createIndex({ participants: 1, createdAt: -1 }),
    mongoDb.collection('notifications').createIndex({ id: 1 }, { unique: true }),
    mongoDb.collection('notifications').createIndex({ recipientId: 1, createdAt: -1 })
  ]);
  usersCache = await mongoDb.collection('users').find({}, { projection: { _id: 0 } }).toArray() as User[];
  connectionsCache = await mongoDb.collection('connections').find({}, { projection: { _id: 0 } }).toArray() as Connection[];
  messagesCache = await mongoDb.collection('messages').find({}, { projection: { _id: 0 } }).toArray() as Message[];
  notificationsCache = await mongoDb.collection('notifications').find({}, { projection: { _id: 0 } }).toArray() as Notification[];
  console.log(`[MongoDB] Connected. Loaded ${usersCache.length} users, ${connectionsCache.length} connections, ${messagesCache.length} messages and ${notificationsCache.length} notifications.`);
}
async function saveRecord(collectionName: string, key: string, record: any) {
  if (!mongoDb) throw new Error('MongoDB is not connected.');
  const { _id, ...document } = record;
  await mongoDb.collection(collectionName).updateOne({ [key]: document[key] }, { $set: document }, { upsert: true });
}
async function removeRecord(collectionName: string, key: string, value: string) {
  if (!mongoDb) throw new Error('MongoDB is not connected.');
  await mongoDb.collection(collectionName).deleteOne({ [key]: value });
}
let usersCache: User[] = [];
let connectionsCache: Connection[] = [];
let messagesCache: Message[] = [];
let notificationsCache: Notification[] = [];

// Socket.io Setup with robust transport configuration
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

// Socket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.warn('[Socket Auth] Connection rejected: No auth token');
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; name?: string; email?: string };
    socket.data.userId = decoded.uid;
    socket.data.user = decoded;
    console.log(`[Socket Auth] Authenticated user: ${decoded.uid} (${decoded.name || 'Student'})`);
    return next();
  } catch (err) {
    console.warn('[Socket Auth] JWT token invalid:', err instanceof Error ? err.message : err);
    return next(new Error('Invalid token'));
  }
});

// Socket Connections
io.on('connection', (socket) => {
  const userId = socket.data.userId;
  const privateRoom = `user:${userId}`;
  socket.join(privateRoom);

  console.log(`[Socket] Connected: ${userId} (Socket ID: ${socket.id}). Joined private room: ${privateRoom}`);

  // Message sending
  socket.on('send_message', async (payload: { to: string; text: string; tempId?: string }) => {
    const { to, text, tempId } = payload || {};

    if (!to || !text || !text.trim()) {
      socket.emit('message_error', { error: 'Recipient and text are required', tempId });
      return;
    }

    if (to === userId) {
      socket.emit('message_error', { error: 'Cannot send message to yourself', tempId });
      return;
    }

    const message: Message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      from: userId,
      to: to,
      participants: [userId, to].sort(),
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    // Save to persistent storage
    messagesCache.push(message);
    await saveRecord('messages', 'id', message);

    console.log(`[Socket Message] From ${userId} -> ${to} | ID: ${message.id} | "${message.text.substring(0, 30)}..."`);

    // Acknowledge back to sender
    socket.emit('message_saved', { message, tempId });

    // Deliver directly to recipient's private room
    const recipientRoom = `user:${to}`;
    io.to(recipientRoom).emit('receive_message', message);
    console.log(`[Socket Message] Delivered 'receive_message' to room ${recipientRoom}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] User ${userId} disconnected: ${reason}`);
  });
});

// REST Authentication Middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; name?: string; email?: string };
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ==================== REST API ENDPOINTS ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    usersCount: usersCache.length,
    connectionsCount: connectionsCache.length,
    messagesCount: messagesCache.length,
    activeSockets: io.engine.clientsCount
  });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// Register new student account
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, branch, year, bio, skills } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid collegiate email is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = usersCache.find(u => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const initials = name.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#4F46E5', '#059669', '#DB2777', '#D97706', '#7C3AED', '#2563EB'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const newUser: User = {
    uid: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    branch: branch || 'Computer Science & Engineering',
    year: year || '1st Year',
    bio: bio || 'Campus Connect Student',
    skills: Array.isArray(skills) && skills.length > 0 ? skills : [],
    initials: initials || 'CC',
    color
  };

  // 1. Save new student in database
  usersCache.push(newUser);
  await saveRecord('users', 'uid', newUser);

  // 2. Notify all existing registered students (excluding the new student)
  const existingUsers = usersCache.filter(u => u.uid !== newUser.uid);
  const now = new Date().toISOString();

  for (const existingUser of existingUsers) {
    // Prevent duplicate notifications
    const alreadyNotified = notificationsCache.some(
      n => n.recipientId === existingUser.uid && 
           n.type === 'new_student_registration' && 
           n.relatedUserId === newUser.uid
    );
    if (!alreadyNotified) {
      const notif: Notification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        recipientId: existingUser.uid,
        senderId: newUser.uid,
        senderName: newUser.name,
        senderAvatarUrl: newUser.avatarUrl || '',
        senderInitials: newUser.initials || 'CC',
        type: 'new_student_registration',
        message: `🎉 ${newUser.name} just joined Campus Connect! Welcome your new campus mate.`,
        relatedUserId: newUser.uid,
        isRead: false,
        createdAt: now
      };
      notificationsCache.push(notif);
      await saveRecord('notifications', 'id', notif);

      // Real-time delivery via Socket.io to online user
      io.to(`user:${existingUser.uid}`).emit('receive_notification', notif);
      console.log(`[Notification] Delivered new student registration alert to user:${existingUser.uid}`);
    }
  }

  // 3. Broadcast real-time student directory update
  io.emit('user_registered', {
    user: sanitizeUser(newUser, false),
    timestamp: now
  });

  const token = jwt.sign(
    { uid: newUser.uid, name: newUser.name, email: newUser.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: sanitizeUser(newUser, true)
  });
});

// ==================== NOTIFICATIONS ENDPOINTS ====================

// List notifications for authenticated user
app.get('/api/notifications', requireAuth, (req, res) => {
  const userId = (req as any).user.uid;
  const userNotifs = notificationsCache
    .filter(n => n.recipientId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(userNotifs);
});

// Mark single notification as read
app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const userId = (req as any).user.uid;
  const notifId = req.params.id;

  const notif = notificationsCache.find(n => n.id === notifId && n.recipientId === userId);
  if (!notif) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  notif.isRead = true;
  await saveRecord('notifications', 'id', notif);
  res.json(notif);
});

// Mark all notifications as read
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  const userId = (req as any).user.uid;
  let count = 0;

  notificationsCache.forEach(n => {
    if (n.recipientId === userId && !n.isRead) {
      n.isRead = true;
      count++;
    }
  });

  if (count > 0) {
    await Promise.all(notificationsCache.filter(n => n.recipientId === userId && n.isRead).map(n => saveRecord('notifications', 'id', n)));
  }

  res.json({ success: true, markedCount: count });
});

// Login with email and password
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = usersCache.find(u => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  let match = false;
  if (user.passwordHash) {
    match = await bcrypt.compare(password, user.passwordHash);
  } else {
    // For default seed accounts, verify password123
    match = (password === 'password123');
  }

  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { uid: user.uid, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: sanitizeUser(user, true)
  });
});

// Get currently authenticated student profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  const userId = (req as any).user.uid;
  const user = usersCache.find(u => u.uid === userId);
  if (!user) {
    return res.status(404).json({ error: 'Student not found' });
  }
  res.json(sanitizeUser(user, true));
});

// Issue JWT Token for quick persona session
app.post('/api/auth/token', (req, res) => {
  const { uid, name, email } = req.body;
  if (!uid) {
    return res.status(400).json({ error: 'Student UID is required' });
  }

  const user = usersCache.find(u => u.uid === uid);
  const studentName = user?.name || name || 'Student';
  const studentEmail = user?.email || email || '';

  const token = jwt.sign(
    { uid, name: studentName, email: studentEmail },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, uid, name: studentName, email: studentEmail });
});

// ==================== USERS ENDPOINTS ====================

// USERS: List all students (masked as "User" for anonymous visitors, real names for authenticated students)
app.get('/api/users', (req, res) => {
  let authenticatedUid: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { uid: string };
      authenticatedUid = decoded.uid;
    } catch {
      authenticatedUid = null;
    }
  }

  if (authenticatedUid) {
    // Authenticated: show real names and exclude the current student from their own discover results
    const list = usersCache
      .filter(u => u.uid !== authenticatedUid)
      .map(u => sanitizeUser(u, true));
    return res.json(list);
  }

  // Anonymous visitor: mask names as "User", hide email and private bio
  const anonymousList = usersCache.map(u => sanitizeUser(u, false));
  res.json(anonymousList);
});

// USERS: Get single student by ID
app.get('/api/users/:id', (req, res) => {
  let isAuthenticated = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  const user = usersCache.find(u => u.uid === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Student not found' });
  }

  res.json(sanitizeUser(user, isAuthenticated));
});

// USERS: Update current user's profile
app.put('/api/users/me', requireAuth, async (req, res) => {
  const userId = (req as any).user.uid;
  const { name, branch, year, bio, skills, avatarUrl } = req.body;

  let userIndex = usersCache.findIndex(u => u.uid === userId);
  if (userIndex >= 0) {
    usersCache[userIndex] = {
      ...usersCache[userIndex],
      ...(name && { name }),
      ...(branch && { branch }),
      ...(year && { year }),
      ...(bio !== undefined && { bio }),
      ...(skills && { skills }),
      ...(avatarUrl && { avatarUrl }),
    };
  } else {
    // Create new profile record
    const newUser: User = {
      uid: userId,
      name: name || 'Student',
      email: (req as any).user.email || '',
      branch: branch || 'Computer Science',
      year: year || '3rd Year',
      bio: bio || '',
      skills: skills || ['React', 'JavaScript'],
      initials: (name || 'ST').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    };
    usersCache.push(newUser);
    userIndex = usersCache.length - 1;
  }

  await saveRecord('users', 'uid', usersCache[userIndex]);
  res.json(sanitizeUser(usersCache[userIndex], true));
});

// Avatar images are stored in Cloudinary, not on the Render instance filesystem.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) cb(null, true);
    else cb(new Error('INVALID_FILE_TYPE'));
  }
});

function configureCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary environment variables are not configured.');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function uploadAvatar(buffer: Buffer, userId: string): Promise<{ url: string; publicId: string }> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'campus-connect/avatars', public_id: `${userId}_${Date.now()}`, resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

app.post('/api/users/me/avatar', requireAuth, (req: Request, res: Response) => {
  avatarUpload.single('avatar')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File size exceeds 5 MB. Please select a smaller photo.' });
      if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ error: 'Invalid file type. Only JPG, JPEG, PNG, and WebP images are supported.' });
      return res.status(400).json({ error: err.message || 'Error processing upload' });
    }
    if (!req.file) return res.status(400).json({ error: 'No image file was provided.' });

    const userId = (req as any).user.uid;
    const userIndex = usersCache.findIndex(u => u.uid === userId);
    if (userIndex === -1) return res.status(404).json({ error: 'Student account not found' });

    try {
      const uploaded = await uploadAvatar(req.file.buffer, userId);
      const oldPublicId = usersCache[userIndex].avatarPublicId;
      usersCache[userIndex].avatarUrl = uploaded.url;
      usersCache[userIndex].avatarPublicId = uploaded.publicId;
      await saveRecord('users', 'uid', usersCache[userIndex]);
      if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId).catch(() => null);
      io.emit('user_updated', { uid: userId, avatarUrl: uploaded.url });
      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        avatarUrl: uploaded.url,
        user: sanitizeUser(usersCache[userIndex], true)
      });
    } catch (uploadError) {
      console.error('[Avatar Upload] Failed:', uploadError);
      res.status(502).json({ error: 'Could not store profile picture. Please try again.' });
    }
  });
});

app.delete('/api/users/me/avatar', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.uid;
  const userIndex = usersCache.findIndex(u => u.uid === userId);
  if (userIndex === -1) return res.status(404).json({ error: 'Student account not found' });
  const oldPublicId = usersCache[userIndex].avatarPublicId;
  if (oldPublicId) {
    try {
      configureCloudinary();
      await cloudinary.uploader.destroy(oldPublicId);
    } catch (error) {
      console.warn('[Avatar Remove] Cloudinary cleanup failed:', error);
    }
  }
  usersCache[userIndex].avatarUrl = '';
  usersCache[userIndex].avatarPublicId = '';
  await saveRecord('users', 'uid', usersCache[userIndex]);
  io.emit('user_updated', { uid: userId, avatarUrl: '' });
  res.json({
    success: true,
    message: 'Profile picture removed successfully',
    avatarUrl: '',
    user: sanitizeUser(usersCache[userIndex], true)
  });
});

// CONNECTIONS: Get connections for current user
app.get('/api/connections', requireAuth, (req, res) => {
  const userId = (req as any).user.uid;
  const userConnections = connectionsCache.filter(
    c => c.requesterId === userId || c.recipientId === userId
  );
  res.json(userConnections);
});

// CONNECTIONS: Send connection request
app.post('/api/connections/:userId', requireAuth, async (req, res) => {
  const requesterId = (req as any).user.uid;
  const recipientId = req.params.userId;
  const requesterUser = usersCache.find(u => u.uid === requesterId);
  const recipientUser = usersCache.find(u => u.uid === recipientId);

  if (recipientId === requesterId) {
    return res.status(400).json({ error: 'Cannot connect with yourself' });
  }

  // Check if connection already exists
  const existing = connectionsCache.find(
    c => (c.requesterId === requesterId && c.recipientId === recipientId) ||
         (c.requesterId === recipientId && c.recipientId === requesterId)
  );

  if (existing) {
    return res.status(400).json({ error: 'Connection request already exists', connection: existing });
  }

  const newConn: Connection = {
    id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    requesterId,
    recipientId,
    requesterName: requesterUser?.name || 'Student',
    recipientName: recipientUser?.name || 'Student',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  connectionsCache.push(newConn);
  await saveRecord('connections', 'id', newConn);

  // Notify recipient via socket if connected
  io.to(`user:${recipientId}`).emit('connection_updated', newConn);

  res.status(201).json(newConn);
});

// CONNECTIONS: Accept or update request
app.put('/api/connections/:requestId', requireAuth, async (req, res) => {
  const userId = (req as any).user.uid;
  const { status } = req.body;
  const requestId = req.params.requestId;

  const conn = connectionsCache.find(c => c.id === requestId);
  if (!conn) {
    return res.status(404).json({ error: 'Connection request not found' });
  }

  if (conn.recipientId !== userId && conn.requesterId !== userId) {
    return res.status(403).json({ error: 'Unauthorized to modify this connection' });
  }

  conn.status = status || 'accepted';
  conn.updatedAt = new Date().toISOString();
  await saveRecord('connections', 'id', conn);

  // Notify both participants in real time
  io.to(`user:${conn.requesterId}`).emit('connection_updated', conn);
  io.to(`user:${conn.recipientId}`).emit('connection_updated', conn);

  res.json(conn);
});

// CONNECTIONS: Delete or reject connection
app.delete('/api/connections/:requestId', requireAuth, async (req, res) => {
  const userId = (req as any).user.uid;
  const requestId = req.params.requestId;

  const connIndex = connectionsCache.findIndex(c => c.id === requestId);
  if (connIndex === -1) {
    return res.status(404).json({ error: 'Connection not found' });
  }

  const conn = connectionsCache[connIndex];
  if (conn.recipientId !== userId && conn.requesterId !== userId) {
    return res.status(403).json({ error: 'Unauthorized to delete this connection' });
  }

  connectionsCache.splice(connIndex, 1);
  await removeRecord('connections', 'id', requestId);

  // Notify both participants in real time
  io.to(`user:${conn.requesterId}`).emit('connection_removed', { id: requestId });
  io.to(`user:${conn.recipientId}`).emit('connection_removed', { id: requestId });

  res.json({ success: true, id: requestId });
});

// MESSAGES: Get active conversation previews
app.get('/api/messages/conversations', requireAuth, (req, res) => {
  const userId = (req as any).user.uid;
  const userMessages = messagesCache.filter(m => m.participants && m.participants.includes(userId));

  const convMap: { [peerId: string]: { peerId: string; lastMessage: Message } } = {};

  userMessages.forEach(m => {
    const peerId = m.from === userId ? m.to : m.from;
    if (!peerId) return;

    if (!convMap[peerId] || new Date(m.createdAt) > new Date(convMap[peerId].lastMessage.createdAt)) {
      convMap[peerId] = {
        peerId,
        lastMessage: m
      };
    }
  });

  const sorted = Object.values(convMap).sort((a, b) => 
    new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
  );

  res.json(sorted);
});

// MESSAGES: Get full bidirectional message history between current user and peer
app.get('/api/messages/:userId', requireAuth, (req, res) => {
  const currentUserId = (req as any).user.uid;
  const targetUserId = req.params.userId;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user ID is required' });
  }

  const conversation = messagesCache.filter(m => 
    (m.from === currentUserId && m.to === targetUserId) ||
    (m.from === targetUserId && m.to === currentUserId)
  );

  conversation.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json(conversation);
});

// MESSAGES: REST fallback to send message
app.post('/api/messages/:userId', requireAuth, async (req, res) => {
  const currentUserId = (req as any).user.uid;
  const targetUserId = req.params.userId;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  if (targetUserId === currentUserId) {
    return res.status(400).json({ error: 'Cannot send message to yourself' });
  }

  const message: Message = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    from: currentUserId,
    to: targetUserId,
    participants: [currentUserId, targetUserId].sort(),
    text: text.trim(),
    createdAt: new Date().toISOString()
  };

  messagesCache.push(message);
  await saveRecord('messages', 'id', message);

  // Deliver via Socket.io to recipient's private room
  io.to(`user:${targetUserId}`).emit('receive_message', message);

  res.status(201).json(message);
});

// Start Server and Mount Vite (with HMR disabled in middleware mode)
async function startServer() {
  await connectDatabase();
  if (!isProd) {
    console.log('[Server] Starting in development mode with Vite middlewares attached to httpServer...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
          clientPort: 443,
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server] Starting API and Socket.IO in production mode...');
    app.use((req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Campus Connect] Full-stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
