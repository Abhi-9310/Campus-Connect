import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { createServer as createViteServer } from 'vite';

const app = express();
const httpServer = http.createServer(app);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

if (isProd && !process.env.JWT_SECRET) {
  console.warn('[Security] JWT_SECRET is not set; using an ephemeral runtime signing key.');
}

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
  'http://localhost:3000'
]
  .map(origin => (origin || '').trim().replace(/\/+$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) return true;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.run.app') ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.onrender.com')
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const DATA_DIR = path.resolve(process.cwd(), 'data');
function readLocalFallback<T>(name: string): T[] {
  try {
    const file = path.join(DATA_DIR, `${name}.json`);
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}
function writeLocalFallback(name: string, data: unknown[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[Storage] Could not write fallback ${name}.json:`, err);
  }
}

// MongoDB persistence. Caches act only as in-process mirrors (or local-dev fallback when NODE_ENV!==production and MONGODB_URI is unset).
let mongoDb: import('mongodb').Db | null = null;
let mongoConnectPromise: Promise<void> | null = null;
let lastDbError: string | null = null;

class DatabaseUnavailableError extends Error {
  statusCode: number;
  constructor(message = 'Database connection is unavailable. Please try again shortly.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.statusCode = 503;
  }
}

function getMongoUri(): string {
  return (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
}

function isLocalMongoUri(uri: string): boolean {
  return /^mongodb(\+srv)?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(uri);
}

function isMongoConnected(): boolean {
  return Boolean(mongoDb);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUserRecord(doc: any): User {
  const uid = String(doc?.uid || (doc?._id ? doc._id.toString() : '') || '');
  const email = typeof doc?.email === 'string' ? doc.email.toLowerCase().trim() : '';
  const legacyHash =
    typeof doc?.password === 'string' && doc.password.startsWith('$2')
      ? doc.password.trim()
      : undefined;
  const passwordHash =
    typeof doc?.passwordHash === 'string' && doc.passwordHash.trim()
      ? doc.passwordHash.trim()
      : legacyHash;
  const name = typeof doc?.name === 'string' && doc.name.trim() ? doc.name.trim() : 'Student';
  const derivedInitials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CC';

  return {
    uid,
    name,
    email,
    ...(passwordHash ? { passwordHash } : {}),
    branch: doc?.branch || 'Computer Science & Engineering',
    year: doc?.year || '1st Year',
    bio: doc?.bio || 'Campus Connect Student',
    skills: Array.isArray(doc?.skills) ? doc.skills : [],
    avatarUrl: doc?.avatarUrl || '',
    avatarPublicId: doc?.avatarPublicId || '',
    initials: doc?.initials || derivedInitials,
    color: doc?.color || '#0F1B3D',
    ...(doc?.createdAt ? { createdAt: new Date(doc.createdAt).toISOString() } : {}),
    ...(doc?.updatedAt ? { updatedAt: new Date(doc.updatedAt).toISOString() } : {})
  };
}

function upsertUserCache(user: User) {
  if (!user.uid) return;
  const idx = usersCache.findIndex(u => u.uid === user.uid);
  if (idx >= 0) {
    usersCache[idx] = user;
  } else {
    usersCache.push(user);
  }
}

async function ensureIndexSafe(collectionName: string, keys: Record<string, 1 | -1>, options: Record<string, unknown> = {}) {
  if (!mongoDb) return;
  try {
    await mongoDb.collection(collectionName).createIndex(keys, options);
  } catch (err) {
    console.warn(`[MongoDB] Index creation warning on ${collectionName}:`, err instanceof Error ? err.message : err);
  }
}

async function connectDatabase() {
  const uri = getMongoUri();
  if (!uri) {
    if (isProd) {
      lastDbError = 'MONGODB_URI environment variable is not configured in production.';
      console.error(`[MongoDB] CRITICAL: ${lastDbError}`);
      throw new DatabaseUnavailableError(lastDbError);
    }
    lastDbError = null;
    console.warn('[MongoDB] MONGODB_URI is not set. Using local JSON/in-memory persistence for development.');
    usersCache = readLocalFallback<User>('users').map(normalizeUserRecord);
    connectionsCache = readLocalFallback<Connection>('connections');
    messagesCache = readLocalFallback<Message>('messages');
    notificationsCache = readLocalFallback<Notification>('notifications');
    return;
  }

  if (isProd && isLocalMongoUri(uri)) {
    lastDbError = 'Production MONGODB_URI must point to MongoDB Atlas, not localhost.';
    console.error(`[MongoDB] CRITICAL: ${lastDbError}`);
    throw new DatabaseUnavailableError(lastDbError);
  }

  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    const db = client.db();
    await db.command({ ping: 1 });
    mongoDb = db;
    lastDbError = null;

    // Create indexes non-fatally so pre-existing Mongoose or Atlas indexes never abort cache loading
    await Promise.all([
      ensureIndexSafe('users', { uid: 1 }, { unique: true }),
      ensureIndexSafe('users', { email: 1 }, { unique: true }),
      ensureIndexSafe('connections', { id: 1 }, { unique: true }),
      ensureIndexSafe('messages', { id: 1 }, { unique: true }),
      ensureIndexSafe('messages', { participants: 1, createdAt: -1 }),
      ensureIndexSafe('notifications', { id: 1 }, { unique: true }),
      ensureIndexSafe('notifications', { recipientId: 1, createdAt: -1 })
    ]);

    const [rawUsers, rawConnections, rawMessages, rawNotifications] = await Promise.all([
      mongoDb.collection('users').find({}).toArray(),
      mongoDb.collection<Connection>('connections').find({}, { projection: { _id: 0 } }).toArray(),
      mongoDb.collection<Message>('messages').find({}, { projection: { _id: 0 } }).toArray(),
      mongoDb.collection<Notification>('notifications').find({}, { projection: { _id: 0 } }).toArray()
    ]);

    usersCache = rawUsers.map(normalizeUserRecord).filter(u => Boolean(u.uid));
    connectionsCache = rawConnections;
    messagesCache = rawMessages;
    notificationsCache = rawNotifications;
    console.log(`[MongoDB] Connected to database "${mongoDb.databaseName}". Loaded ${usersCache.length} users, ${connectionsCache.length} connections, ${messagesCache.length} messages and ${notificationsCache.length} notifications.`);
  } catch (err) {
    mongoDb = null;
    lastDbError = err instanceof Error ? err.message : 'MongoDB connection failed';
    console.error('[MongoDB] Connection error:', lastDbError);
    throw err;
  }
}

async function ensureDatabaseConnected(requirePersistentDb: boolean = false) {
  const uri = getMongoUri();
  if (!uri) {
    if (isProd || requirePersistentDb) {
      throw new DatabaseUnavailableError(
        lastDbError || 'MongoDB Atlas is not configured on the server (MONGODB_URI missing).'
      );
    }
    return;
  }

  if (mongoDb) return;

  if (!mongoConnectPromise) {
    mongoConnectPromise = connectDatabase()
      .catch(err => {
        lastDbError = err instanceof Error ? err.message : 'MongoDB connection failed';
        console.error('[MongoDB] Reconnect attempt failed:', lastDbError);
      })
      .finally(() => {
        mongoConnectPromise = null;
      });
  }
  await mongoConnectPromise;

  if (!mongoDb) {
    throw new DatabaseUnavailableError(
      lastDbError || 'Unable to connect to MongoDB Atlas. Please check database configuration.'
    );
  }
}

async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return null;

  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    let doc = await mongoDb.collection('users').findOne({ email: normalizedEmail });
    if (!doc) {
      doc = await mongoDb.collection('users').findOne({
        email: { $regex: new RegExp(`^\\s*${escapeRegex(normalizedEmail)}\\s*$`, 'i') }
      });
    }
    if (!doc) return null;
    const normalized = normalizeUserRecord(doc);
    upsertUserCache(normalized);
    return normalized;
  }

  return usersCache.find(u => (u.email || '').toLowerCase().trim() === normalizedEmail) || null;
}

async function findUserByUid(uid: string): Promise<User | null> {
  if (!uid) return null;

  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    const filter = ObjectId.isValid(uid)
      ? { $or: [{ uid }, { _id: new ObjectId(uid) }] }
      : { uid };
    const doc = await mongoDb.collection('users').findOne(filter);
    if (!doc) return null;
    const normalized = normalizeUserRecord(doc);
    upsertUserCache(normalized);
    return normalized;
  }

  return usersCache.find(u => u.uid === uid) || null;
}

async function listUsersFromStore(): Promise<User[]> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    const docs = await mongoDb.collection('users').find({}).toArray();
    const normalized = docs.map(normalizeUserRecord).filter(u => Boolean(u.uid));
    usersCache = normalized;
    return normalized;
  }

  return usersCache;
}

async function listNotificationsForUserFromStore(userId: string): Promise<Notification[]> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    const docs = await mongoDb
      .collection<Notification>('notifications')
      .find({ recipientId: userId }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    return docs;
  }

  return notificationsCache
    .filter(n => n.recipientId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function markNotificationReadInStore(notifId: string, userId: string): Promise<Notification | null> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    const result = await mongoDb.collection<Notification>('notifications').findOneAndUpdate(
      { id: notifId, recipientId: userId },
      { $set: { isRead: true } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    if (result) {
      const idx = notificationsCache.findIndex(n => n.id === notifId && n.recipientId === userId);
      if (idx >= 0) notificationsCache[idx] = result;
    }
    return result || null;
  }

  const notif = notificationsCache.find(n => n.id === notifId && n.recipientId === userId);
  if (!notif) return null;
  notif.isRead = true;
  writeLocalFallback('notifications', notificationsCache);
  return notif;
}

async function markAllNotificationsReadInStore(userId: string): Promise<number> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    const res = await mongoDb
      .collection<Notification>('notifications')
      .updateMany({ recipientId: userId, isRead: false }, { $set: { isRead: true } });
    notificationsCache.forEach(n => {
      if (n.recipientId === userId) n.isRead = true;
    });
    return res.modifiedCount || 0;
  }

  let count = 0;
  notificationsCache.forEach(n => {
    if (n.recipientId === userId && !n.isRead) {
      n.isRead = true;
      count++;
    }
  });
  if (count > 0) writeLocalFallback('notifications', notificationsCache);
  return count;
}

async function listConnectionsForUserFromStore(userId: string): Promise<Connection[]> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    return await mongoDb
      .collection<Connection>('connections')
      .find({ $or: [{ requesterId: userId }, { recipientId: userId }] }, { projection: { _id: 0 } })
      .toArray();
  }

  return connectionsCache.filter(c => c.requesterId === userId || c.recipientId === userId);
}

async function findConnectionBetweenFromStore(uid1: string, uid2: string): Promise<Connection | null> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    return await mongoDb.collection<Connection>('connections').findOne(
      {
        $or: [
          { requesterId: uid1, recipientId: uid2 },
          { requesterId: uid2, recipientId: uid1 }
        ]
      },
      { projection: { _id: 0 } }
    );
  }

  return (
    connectionsCache.find(
      c =>
        (c.requesterId === uid1 && c.recipientId === uid2) ||
        (c.requesterId === uid2 && c.recipientId === uid1)
    ) || null
  );
}

async function findConnectionByIdFromStore(requestId: string): Promise<Connection | null> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    return await mongoDb
      .collection<Connection>('connections')
      .findOne({ id: requestId }, { projection: { _id: 0 } });
  }

  return connectionsCache.find(c => c.id === requestId) || null;
}

async function listMessagesForUserFromStore(userId: string): Promise<Message[]> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    const docs = await mongoDb
      .collection<Message>('messages')
      .find(
        { $or: [{ participants: userId }, { from: userId }, { to: userId }] },
        { projection: { _id: 0 } }
      )
      .sort({ createdAt: 1 })
      .toArray();
    return docs;
  }

  return messagesCache
    .filter(m => (m.participants && m.participants.includes(userId)) || m.from === userId || m.to === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function listConversationMessagesFromStore(uid1: string, uid2: string): Promise<Message[]> {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);

  if (mongoDb) {
    return await mongoDb
      .collection<Message>('messages')
      .find(
        {
          $or: [
            { from: uid1, to: uid2 },
            { from: uid2, to: uid1 }
          ]
        },
        { projection: { _id: 0 } }
      )
      .sort({ createdAt: 1 })
      .toArray();
  }

  return messagesCache
    .filter(m => (m.from === uid1 && m.to === uid2) || (m.from === uid2 && m.to === uid1))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function saveRecord(collectionName: string, key: string, record: any) {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);
  if (!mongoDb) {
    const cacheMap: Record<string, any[]> = {
      users: usersCache,
      connections: connectionsCache,
      messages: messagesCache,
      notifications: notificationsCache
    };
    const current = cacheMap[collectionName];
    if (current) {
      const idx = current.findIndex(item => item && item[key] === record[key]);
      const nextList = idx >= 0
        ? current.map((item, i) => (i === idx ? record : item))
        : [...current, record];
      writeLocalFallback(collectionName, nextList);
    }
    return;
  }
  const { _id, ...document } = record;
  const filter =
    collectionName === 'users' && key === 'uid' && ObjectId.isValid(String(document.uid || ''))
      ? { $or: [{ uid: document.uid }, { _id: new ObjectId(String(document.uid)) }] }
      : { [key]: document[key] };
  await mongoDb.collection(collectionName).updateOne(filter, { $set: document }, { upsert: true });
}

async function removeRecord(collectionName: string, key: string, value: string) {
  await ensureDatabaseConnected(Boolean(getMongoUri()) || isProd);
  if (!mongoDb) {
    const cacheMap: Record<string, any[]> = {
      users: usersCache,
      connections: connectionsCache,
      messages: messagesCache,
      notifications: notificationsCache
    };
    const current = cacheMap[collectionName];
    if (current) {
      const nextList = current.filter(item => item && item[key] !== value);
      writeLocalFallback(collectionName, nextList);
    }
    return;
  }
  await mongoDb.collection(collectionName).deleteOne({ [key]: value });
}
interface User {
  uid: string;
  name: string;
  email: string;
  passwordHash?: string;
  branch: string;
  year: string;
  bio: string;
  skills: string[];
  avatarUrl?: string;
  avatarPublicId?: string;
  initials: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

function sanitizeUser(u: User, isAuthenticated: boolean = true) {
  if (!isAuthenticated) {
    return {
      uid: u.uid,
      name: 'User',
      email: '',
      branch: u.branch,
      year: u.year,
      bio: 'Campus Connect Student',
      skills: u.skills || [],
      avatarUrl: '',
      initials: 'U',
      color: '#0F1B3D'
    };
  }

  const { passwordHash: _passwordHash, avatarPublicId: _avatarPublicId, ...safe } = u;
  return safe;
}

interface Connection {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterName: string;
  recipientName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  from: string;
  to: string;
  participants: string[];
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  senderInitials: string;
  type: 'new_student_registration' | 'connection_request' | 'connection_accepted' | 'message';
  message: string;
  relatedUserId: string;
  isRead: boolean;
  createdAt: string;
}

let usersCache: User[] = [];
let connectionsCache: Connection[] = [];
let messagesCache: Message[] = [];
let notificationsCache: Notification[] = [];

// Socket.io Setup with robust transport configuration
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
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

    try {
      // Save to persistent storage before confirming delivery
      await saveRecord('messages', 'id', message);
      messagesCache.push(message);

      console.log(`[Socket Message] From ${userId} -> ${to} | ID: ${message.id} | "${message.text.substring(0, 30)}..."`);

      // Acknowledge back to sender
      socket.emit('message_saved', { message, tempId });

      // Deliver directly to recipient's private room
      const recipientRoom = `user:${to}`;
      io.to(recipientRoom).emit('receive_message', message);
      console.log(`[Socket Message] Delivered 'receive_message' to room ${recipientRoom}`);
    } catch (err) {
      console.error('[Socket Message] Failed to persist message:', err);
      socket.emit('message_error', {
        error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to store message in database',
        tempId
      });
    }
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

// Health check (reports live MongoDB Atlas status & counts without exposing secrets)
app.get('/api/health', async (req, res) => {
  try {
    if (!mongoDb && getMongoUri()) {
      await ensureDatabaseConnected(false).catch(() => null);
    }

    const dbMode = isMongoConnected()
      ? 'mongodb'
      : !isProd && !getMongoUri()
        ? 'local-dev-fallback'
        : 'disconnected';

    let usersCount = usersCache.length;
    let connectionsCount = connectionsCache.length;
    let messagesCount = messagesCache.length;

    if (mongoDb) {
      await mongoDb.command({ ping: 1 });
      [usersCount, connectionsCount, messagesCount] = await Promise.all([
        mongoDb.collection('users').countDocuments(),
        mongoDb.collection('connections').countDocuments(),
        mongoDb.collection('messages').countDocuments()
      ]);
    }

    const healthy = isMongoConnected() || (!isProd && !getMongoUri());
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        connected: isMongoConnected(),
        mode: dbMode,
        databaseName: mongoDb ? mongoDb.databaseName : null,
        error: lastDbError
      },
      usersCount,
      connectionsCount,
      messagesCount,
      activeSockets: io.engine.clientsCount
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Health check database failure';
    lastDbError = message;
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        mode: 'disconnected',
        databaseName: null,
        error: message
      },
      usersCount: 0,
      connectionsCount: 0,
      messagesCount: 0,
      activeSockets: io.engine.clientsCount
    });
  }
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// Register new student account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, branch, year, bio, skills } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid collegiate email is required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trimmedName = name.trim();
    const initials = trimmedName.split(/\s+/).filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['#4F46E5', '#059669', '#DB2777', '#D97706', '#7C3AED', '#2563EB'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const now = new Date().toISOString();
    const newUser: User = {
      uid: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      branch: typeof branch === 'string' && branch.trim() ? branch.trim() : 'Computer Science & Engineering',
      year: typeof year === 'string' && year.trim() ? year.trim() : '1st Year',
      bio: typeof bio === 'string' && bio.trim() ? bio.trim() : 'Campus Connect Student',
      skills: Array.isArray(skills) && skills.length > 0 ? skills : [],
      initials: initials || 'CC',
      color,
      createdAt: now,
      updatedAt: now
    };

    // 1. Save new student in database first (never keep unpersisted cache entries if DB write fails)
    try {
      await saveRecord('users', 'uid', newUser);
      upsertUserCache(newUser);
    } catch (saveErr: any) {
      if (saveErr?.code === 11000) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw saveErr;
    }

    // 2. Notify all existing registered students (excluding the new student)
    const allUsers = await listUsersFromStore();
    const existingUsers = allUsers.filter(u => u.uid !== newUser.uid);

    for (const existingUser of existingUsers) {
      const existingNotifs = await listNotificationsForUserFromStore(existingUser.uid);
      const alreadyNotified = existingNotifs.some(
        n => n.type === 'new_student_registration' && n.relatedUserId === newUser.uid
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
        await saveRecord('notifications', 'id', notif);
        notificationsCache.push(notif);

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
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    if (err instanceof DatabaseUnavailableError) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
  }
});

// ==================== NOTIFICATIONS ENDPOINTS ====================

// List notifications for authenticated user
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const userNotifs = await listNotificationsForUserFromStore(userId);
    res.json(userNotifs);
  } catch (err) {
    console.error('[Notifications] List error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load notifications'
    });
  }
});

// Mark single notification as read
app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const notifId = req.params.id;
    const notif = await markNotificationReadInStore(notifId, userId);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notif);
  } catch (err) {
    console.error('[Notifications] Mark read error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to update notification'
    });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const count = await markAllNotificationsReadInStore(userId);
    res.json({ success: true, markedCount: count });
  } catch (err) {
    console.error('[Notifications] Mark all read error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to update notifications'
    });
  }
});

// Login with email and password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email address' });
    }

    if (!user.passwordHash || typeof user.passwordHash !== 'string') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { uid: user.uid, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const resPayload = {
      token,
      user: sanitizeUser(user, true)
    };
    res.setHeader('Cache-Control', 'no-store');
    res.json(resPayload);
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Unable to log in right now. Please try again.'
    });
  }
});

// Get currently authenticated student profile
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const user = await findUserByUid(userId);
    if (!user) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(sanitizeUser(user, true));
  } catch (err) {
    console.error('[Auth] Fetch profile error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to verify session'
    });
  }
});

// Issue JWT Token for verified registered student session
app.post('/api/auth/token', async (req, res) => {
  try {
    const { uid, name, email } = req.body || {};
    if (typeof uid !== 'string' || !uid.trim()) {
      return res.status(400).json({ error: 'Student UID is required' });
    }

    const user = await findUserByUid(uid.trim());
    if (!user) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentName = user.name || name || 'Student';
    const studentEmail = user.email || email || '';

    const token = jwt.sign(
      { uid: user.uid, name: studentName, email: studentEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, uid: user.uid, name: studentName, email: studentEmail });
  } catch (err) {
    console.error('[Auth] Token error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to issue session token'
    });
  }
});

// ==================== USERS ENDPOINTS ====================

// USERS: List all students (masked as "User" for anonymous visitors, real names for authenticated students)
app.get('/api/users', async (req, res) => {
  try {
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

    const allUsers = await listUsersFromStore();
    res.setHeader('Cache-Control', 'no-store');

    if (authenticatedUid) {
      // Authenticated: show real names and exclude the current student from their own discover results
      const list = allUsers
        .filter(u => u.uid !== authenticatedUid)
        .map(u => sanitizeUser(u, true));
      return res.json(list);
    }

    // Anonymous visitor: mask names as "User", hide email and private bio
    const anonymousList = allUsers.map(u => sanitizeUser(u, false));
    res.json(anonymousList);
  } catch (err) {
    console.error('[Users] List error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load students'
    });
  }
});

// USERS: Get single student by ID
app.get('/api/users/:id', async (req, res) => {
  try {
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

    const user = await findUserByUid(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json(sanitizeUser(user, isAuthenticated));
  } catch (err) {
    console.error('[Users] Get single error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load student profile'
    });
  }
});

// USERS: Update current user's profile
app.put('/api/users/me', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { name, branch, year, bio, skills, avatarUrl } = req.body || {};

    const existingUser = await findUserByUid(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'Student account not found' });
    }

    const nextName = typeof name === 'string' && name.trim() ? name.trim() : existingUser.name;
    const nextInitials =
      nextName
        .split(/\s+/)
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || existingUser.initials;

    const updatedUser: User = {
      ...existingUser,
      name: nextName,
      initials: nextInitials,
      ...(typeof branch === 'string' && branch.trim() ? { branch: branch.trim() } : {}),
      ...(typeof year === 'string' && year.trim() ? { year: year.trim() } : {}),
      ...(bio !== undefined ? { bio: String(bio) } : {}),
      ...(Array.isArray(skills) ? { skills: skills.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) } : {}),
      ...(typeof avatarUrl === 'string' ? { avatarUrl } : {}),
      updatedAt: new Date().toISOString()
    };

    await saveRecord('users', 'uid', updatedUser);
    upsertUserCache(updatedUser);
    io.emit('user_updated', {
      uid: userId,
      name: updatedUser.name,
      branch: updatedUser.branch,
      year: updatedUser.year,
      bio: updatedUser.bio,
      skills: updatedUser.skills,
      avatarUrl: updatedUser.avatarUrl || '',
      initials: updatedUser.initials
    });
    res.json(sanitizeUser(updatedUser, true));
  } catch (err) {
    console.error('[Users] Update profile error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to update student profile'
    });
  }
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

    try {
      const userId = (req as any).user.uid;
      const user = await findUserByUid(userId);
      if (!user) return res.status(404).json({ error: 'Student account not found' });

      let uploaded: { url: string; publicId: string };
      try {
        uploaded = await uploadAvatar(req.file.buffer, userId);
      } catch (uploadError) {
        console.error('[Avatar Upload] Storage failed:', uploadError);
        return res.status(502).json({ error: 'Could not store profile picture. Please try again.' });
      }

      const oldPublicId = user.avatarPublicId;
      const updatedUser = {
        ...user,
        avatarUrl: uploaded.url,
        avatarPublicId: uploaded.publicId,
        updatedAt: new Date().toISOString()
      };

      await saveRecord('users', 'uid', updatedUser);
      upsertUserCache(updatedUser);

      if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId).catch(() => null);
      io.emit('user_updated', { uid: userId, avatarUrl: uploaded.url });
      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        avatarUrl: uploaded.url,
        user: sanitizeUser(updatedUser, true)
      });
    } catch (dbErr) {
      console.error('[Avatar Upload] Database error:', dbErr);
      res.status(dbErr instanceof DatabaseUnavailableError ? 503 : 500).json({
        error: dbErr instanceof DatabaseUnavailableError ? dbErr.message : 'Failed to save profile picture.'
      });
    }
  });
});

app.delete('/api/users/me/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;
    const user = await findUserByUid(userId);
    if (!user) return res.status(404).json({ error: 'Student account not found' });

    const oldPublicId = user.avatarPublicId;
    const updatedUser = {
      ...user,
      avatarUrl: '',
      avatarPublicId: '',
      updatedAt: new Date().toISOString()
    };

    await saveRecord('users', 'uid', updatedUser);
    upsertUserCache(updatedUser);

    if (oldPublicId) {
      try {
        configureCloudinary();
        await cloudinary.uploader.destroy(oldPublicId);
      } catch (error) {
        console.warn('[Avatar Remove] Cloudinary cleanup failed:', error);
      }
    }

    io.emit('user_updated', { uid: userId, avatarUrl: '' });
    res.json({
      success: true,
      message: 'Profile picture removed successfully',
      avatarUrl: '',
      user: sanitizeUser(updatedUser, true)
    });
  } catch (dbErr) {
    console.error('[Avatar Remove] Database error:', dbErr);
    res.status(dbErr instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: dbErr instanceof DatabaseUnavailableError ? dbErr.message : 'Failed to remove profile picture.'
    });
  }
});

// CONNECTIONS: Get connections for current user
app.get('/api/connections', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const userConnections = await listConnectionsForUserFromStore(userId);
    res.json(userConnections);
  } catch (err) {
    console.error('[Connections] List error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load connections'
    });
  }
});

// CONNECTIONS: Send connection request
app.post('/api/connections/:userId', requireAuth, async (req, res) => {
  try {
    const requesterId = (req as any).user.uid;
    const recipientId = req.params.userId;
    if (recipientId === requesterId) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    const [requesterUser, recipientUser, existing] = await Promise.all([
      findUserByUid(requesterId),
      findUserByUid(recipientId),
      findConnectionBetweenFromStore(requesterId, recipientId)
    ]);

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

    await saveRecord('connections', 'id', newConn);
    connectionsCache.push(newConn);

    // Notify recipient via socket if connected
    io.to(`user:${recipientId}`).emit('connection_updated', newConn);

    res.status(201).json(newConn);
  } catch (err) {
    console.error('[Connections] Create error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to send connection request'
    });
  }
});

// CONNECTIONS: Accept or update request
app.put('/api/connections/:requestId', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { status } = req.body || {};
    const requestId = req.params.requestId;

    const conn = await findConnectionByIdFromStore(requestId);
    if (!conn) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    if (conn.recipientId !== userId && conn.requesterId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this connection' });
    }

    const updatedConn: Connection = {
      ...conn,
      status: status === 'rejected' ? 'rejected' : status === 'pending' ? 'pending' : 'accepted',
      updatedAt: new Date().toISOString()
    };
    await saveRecord('connections', 'id', updatedConn);
    const idx = connectionsCache.findIndex(c => c.id === requestId);
    if (idx >= 0) connectionsCache[idx] = updatedConn;
    else connectionsCache.push(updatedConn);

    // Notify both participants in real time
    io.to(`user:${updatedConn.requesterId}`).emit('connection_updated', updatedConn);
    io.to(`user:${updatedConn.recipientId}`).emit('connection_updated', updatedConn);

    res.json(updatedConn);
  } catch (err) {
    console.error('[Connections] Update error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to update connection request'
    });
  }
});

// CONNECTIONS: Delete or reject connection
app.delete('/api/connections/:requestId', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const requestId = req.params.requestId;

    const conn = await findConnectionByIdFromStore(requestId);
    if (!conn) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (conn.recipientId !== userId && conn.requesterId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this connection' });
    }

    await removeRecord('connections', 'id', requestId);
    connectionsCache = connectionsCache.filter(c => c.id !== requestId);

    // Notify both participants in real time
    io.to(`user:${conn.requesterId}`).emit('connection_removed', { id: requestId });
    io.to(`user:${conn.recipientId}`).emit('connection_removed', { id: requestId });

    res.json({ success: true, id: requestId });
  } catch (err) {
    console.error('[Connections] Delete error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to delete connection'
    });
  }
});

// MESSAGES: Get all persisted messages for the authenticated student
app.get('/api/messages', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const userMessages = await listMessagesForUserFromStore(userId);
    res.setHeader('Cache-Control', 'no-store');
    res.json(userMessages);
  } catch (err) {
    console.error('[Messages] List all error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load messages'
    });
  }
});

// MESSAGES: Get active conversation previews
app.get('/api/messages/conversations', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const userMessages = await listMessagesForUserFromStore(userId);

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

    res.setHeader('Cache-Control', 'no-store');
    res.json(sorted);
  } catch (err) {
    console.error('[Messages] Conversations error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load conversations'
    });
  }
});

// MESSAGES: Get full bidirectional message history between current user and peer
app.get('/api/messages/:userId', requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).user.uid;
    const targetUserId = req.params.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const conversation = await listConversationMessagesFromStore(currentUserId, targetUserId);
    res.setHeader('Cache-Control', 'no-store');
    res.json(conversation);
  } catch (err) {
    console.error('[Messages] Conversation history error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to load conversation history'
    });
  }
});

// MESSAGES: REST fallback to send message
app.post('/api/messages/:userId', requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).user.uid;
    const targetUserId = req.params.userId;
    const { text } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
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

    await saveRecord('messages', 'id', message);
    messagesCache.push(message);

    // Deliver via Socket.io to recipient's private room
    io.to(`user:${targetUserId}`).emit('receive_message', message);

    res.status(201).json(message);
  } catch (err) {
    console.error('[Messages] Send REST error:', err);
    res.status(err instanceof DatabaseUnavailableError ? 503 : 500).json({
      error: err instanceof DatabaseUnavailableError ? err.message : 'Failed to store message'
    });
  }
});

// Start Server and Mount Vite (with HMR disabled in middleware mode)
async function startServer() {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('[MongoDB] Startup connection failed; continuing with in-memory/local fallback:', err);
  }
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
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      console.log('[Server] Starting in production mode serving dist + API + Socket.IO...');
      app.use(express.static(distDir));
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        return res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      console.log('[Server] Starting API and Socket.IO in production mode...');
      app.use((req, res) => {
        res.status(404).json({ error: 'API route not found' });
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Campus Connect] Full-stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
