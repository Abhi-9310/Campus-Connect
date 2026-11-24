import mongoose, { Schema, Document, Model } from 'mongoose';
import path from 'path';
import fs from 'fs';

export interface UserRecord {
  uid: string;
  _id?: string;
  name: string;
  email: string;
  passwordHash?: string;
  branch: string;
  year: string;
  bio: string;
  skills: string[];
  avatarUrl?: string;
  initials: string;
  color?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectionRecord {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterName: string;
  recipientName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  from: string;
  to: string;
  participants: string[];
  text: string;
  createdAt: string;
}

export interface NotificationRecord {
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

// ==================== MONGOOSE SCHEMAS & MODELS ====================

interface IUserDoc extends Document {
  uid: string;
  name: string;
  email: string;
  passwordHash?: string;
  branch: string;
  year: string;
  bio: string;
  skills: string[];
  avatarUrl: string;
  initials: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    branch: { type: String, default: 'Computer Science & Engineering', trim: true },
    year: { type: String, default: '1st Year', trim: true },
    bio: { type: String, default: 'Campus Connect Student', maxlength: 1000 },
    skills: { type: [String], default: [] },
    avatarUrl: { type: String, default: '' },
    initials: { type: String, default: 'CC' },
    color: { type: String, default: '#0F1B3D' },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

interface IConnectionDoc extends Document {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterName: string;
  recipientName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnectionDoc>(
  {
    id: { type: String, required: true, unique: true, index: true },
    requesterId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true, index: true },
    requesterName: { type: String, default: 'Student' },
    recipientName: { type: String, default: 'Student' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

interface IMessageDoc extends Document {
  id: string;
  from: string;
  to: string;
  participants: string[];
  text: string;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessageDoc>(
  {
    id: { type: String, required: true, unique: true, index: true },
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    participants: { type: [String], required: true, index: true },
    text: { type: String, required: true, maxlength: 5000 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

interface INotificationDoc extends Document {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string;
  senderInitials: string;
  type: 'new_student_registration' | 'connection_request' | 'connection_accepted' | 'message';
  message: string;
  relatedUserId: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDoc>(
  {
    id: { type: String, required: true, unique: true, index: true },
    recipientId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderName: { type: String, default: 'Student' },
    senderAvatarUrl: { type: String, default: '' },
    senderInitials: { type: String, default: 'CC' },
    type: {
      type: String,
      enum: ['new_student_registration', 'connection_request', 'connection_accepted', 'message'],
      required: true
    },
    message: { type: String, required: true },
    relatedUserId: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const UserModel: Model<IUserDoc> =
  mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema);
export const ConnectionModel: Model<IConnectionDoc> =
  mongoose.models.Connection || mongoose.model<IConnectionDoc>('Connection', ConnectionSchema);
export const MessageModel: Model<IMessageDoc> =
  mongoose.models.Message || mongoose.model<IMessageDoc>('Message', MessageSchema);
export const NotificationModel: Model<INotificationDoc> =
  mongoose.models.Notification || mongoose.model<INotificationDoc>('Notification', NotificationSchema);

// ==================== LOCAL DEV STORAGE FALLBACK (WHEN MONGODB_URI IS UNSET LOCALLY) ====================

const DATA_DIR = path.resolve(process.cwd(), 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) || fallback;
    }
  } catch (err) {
    console.error(`[Storage] Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Storage] Error writing ${filePath}:`, err);
  }
}

let useLocalDevStore = false;
let dbConnectionError: string | null = null;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function isDatabaseReady(): boolean {
  return isMongoConnected() || useLocalDevStore;
}

export function getDatabaseStatus() {
  return {
    mode: isMongoConnected() ? 'mongodb' : useLocalDevStore ? 'local-json-dev' : 'disconnected',
    connected: isDatabaseReady(),
    error: dbConnectionError
  };
}

export async function connectDatabase(): Promise<void> {
  const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000
      });
      useLocalDevStore = false;
      dbConnectionError = null;
      console.log('[Database] Connected to MongoDB Atlas successfully');
      return;
    } catch (err) {
      dbConnectionError = err instanceof Error ? err.message : 'MongoDB connection failed';
      console.error('[Database] MongoDB Atlas connection error:', dbConnectionError);
      // Do not silently fall back when MONGODB_URI is explicitly configured
      throw err;
    }
  }

  if (isProd) {
    dbConnectionError = 'MONGODB_URI environment variable is not configured in production.';
    console.error(`[Database] CRITICAL: ${dbConnectionError}`);
    return;
  }

  // Non-production local sandbox mode when MONGODB_URI is not set
  useLocalDevStore = true;
  dbConnectionError = null;
  console.warn('[Database] MONGODB_URI is not set. Using local JSON file persistence for development testing.');
}

function toUserRecord(doc: any): UserRecord {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const uid = obj.uid || (obj._id ? String(obj._id) : '');
  return {
    uid,
    _id: obj._id ? String(obj._id) : uid,
    name: obj.name,
    email: obj.email,
    passwordHash: obj.passwordHash,
    branch: obj.branch || 'Computer Science & Engineering',
    year: obj.year || '1st Year',
    bio: obj.bio || 'Campus Connect Student',
    skills: Array.isArray(obj.skills) ? obj.skills : [],
    avatarUrl: obj.avatarUrl || '',
    initials: obj.initials || 'CC',
    color: obj.color || '#0F1B3D',
    isActive: obj.isActive !== false,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : undefined,
    updatedAt: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : undefined
  };
}

function toConnectionRecord(doc: any): ConnectionRecord {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: obj.id || String(obj._id),
    requesterId: obj.requesterId,
    recipientId: obj.recipientId,
    requesterName: obj.requesterName,
    recipientName: obj.recipientName,
    status: obj.status,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString()
  };
}

function toMessageRecord(doc: any): MessageRecord {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: obj.id || String(obj._id),
    from: obj.from,
    to: obj.to,
    participants: Array.isArray(obj.participants) ? obj.participants : [obj.from, obj.to].sort(),
    text: obj.text,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString()
  };
}

function toNotificationRecord(doc: any): NotificationRecord {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: obj.id || String(obj._id),
    recipientId: obj.recipientId,
    senderId: obj.senderId,
    senderName: obj.senderName,
    senderAvatarUrl: obj.senderAvatarUrl || '',
    senderInitials: obj.senderInitials || 'CC',
    type: obj.type,
    message: obj.message,
    relatedUserId: obj.relatedUserId,
    isRead: Boolean(obj.isRead),
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString()
  };
}

export class DuplicateEmailError extends Error {
  constructor(message = 'An account with this email already exists') {
    super(message);
    this.name = 'DuplicateEmailError';
  }
}

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database connection is unavailable. Please try again later.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

function ensureReady() {
  if (!isDatabaseReady()) {
    throw new DatabaseUnavailableError(dbConnectionError || 'Database not connected');
  }
}

// ==================== UNIFIED DATABASE REPOSITORY ====================

export const dbStore = {
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    ensureReady();
    const normalized = email.toLowerCase().trim();
    if (isMongoConnected()) {
      const doc = await UserModel.findOne({ email: normalized }).exec();
      return doc ? toUserRecord(doc) : null;
    }
    const users = readJsonFile<UserRecord[]>(USERS_FILE, []);
    return users.find(u => u.email.toLowerCase() === normalized) || null;
  },

  async findUserByUid(uid: string): Promise<UserRecord | null> {
    ensureReady();
    if (isMongoConnected()) {
      const query = mongoose.Types.ObjectId.isValid(uid)
        ? { $or: [{ uid }, { _id: uid }] }
        : { uid };
      const doc = await UserModel.findOne(query).exec();
      return doc ? toUserRecord(doc) : null;
    }
    const users = readJsonFile<UserRecord[]>(USERS_FILE, []);
    return users.find(u => u.uid === uid || u._id === uid) || null;
  },

  async listUsers(): Promise<UserRecord[]> {
    ensureReady();
    if (isMongoConnected()) {
      const docs = await UserModel.find({ isActive: { $ne: false } })
        .sort({ createdAt: -1 })
        .exec();
      return docs.map(toUserRecord);
    }
    const users = readJsonFile<UserRecord[]>(USERS_FILE, []);
    return users
      .filter(u => u.isActive !== false)
      .map(toUserRecord)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },

  async createUser(input: Omit<UserRecord, 'uid' | '_id'>): Promise<UserRecord> {
    ensureReady();
    const now = new Date().toISOString();
    const normalizedEmail = input.email.toLowerCase().trim();

    if (isMongoConnected()) {
      const objectId = new mongoose.Types.ObjectId();
      const permanentId = objectId.toString();
      try {
        const doc = await UserModel.create({
          _id: objectId,
          uid: permanentId,
          name: input.name,
          email: normalizedEmail,
          passwordHash: input.passwordHash,
          branch: input.branch || 'Computer Science & Engineering',
          year: input.year || '1st Year',
          bio: input.bio || 'Campus Connect Student',
          skills: Array.isArray(input.skills) ? input.skills : [],
          avatarUrl: input.avatarUrl || '',
          initials: input.initials || 'CC',
          color: input.color || '#0F1B3D',
          isActive: true
        });
        return toUserRecord(doc);
      } catch (err: any) {
        if (err?.code === 11000) {
          throw new DuplicateEmailError('An account with this email already exists');
        }
        throw err;
      }
    }

    const users = readJsonFile<UserRecord[]>(USERS_FILE, []);
    if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
      throw new DuplicateEmailError('An account with this email already exists');
    }

    const permanentId = new mongoose.Types.ObjectId().toString();
    const newUser: UserRecord = {
      uid: permanentId,
      _id: permanentId,
      name: input.name,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      branch: input.branch || 'Computer Science & Engineering',
      year: input.year || '1st Year',
      bio: input.bio || 'Campus Connect Student',
      skills: Array.isArray(input.skills) ? input.skills : [],
      avatarUrl: input.avatarUrl || '',
      initials: input.initials || 'CC',
      color: input.color || '#0F1B3D',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    users.push(newUser);
    writeJsonFile(USERS_FILE, users);
    return toUserRecord(newUser);
  },

  async updateUser(
    uid: string,
    updates: Partial<Pick<UserRecord, 'name' | 'branch' | 'year' | 'bio' | 'skills' | 'avatarUrl'>>
  ): Promise<UserRecord | null> {
    ensureReady();
    if (isMongoConnected()) {
      const updateSet: Record<string, any> = {};
      if (updates.name !== undefined) {
        updateSet.name = updates.name;
        updateSet.initials =
          updates.name
            .trim()
            .split(' ')
            .filter(Boolean)
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'CC';
      }
      if (updates.branch !== undefined) updateSet.branch = updates.branch;
      if (updates.year !== undefined) updateSet.year = updates.year;
      if (updates.bio !== undefined) updateSet.bio = updates.bio;
      if (updates.skills !== undefined) updateSet.skills = updates.skills;
      if (updates.avatarUrl !== undefined) updateSet.avatarUrl = updates.avatarUrl;

      const doc = await UserModel.findOneAndUpdate(
        { uid },
        { $set: updateSet },
        { new: true }
      ).exec();
      return doc ? toUserRecord(doc) : null;
    }

    const users = readJsonFile<UserRecord[]>(USERS_FILE, []);
    const idx = users.findIndex(u => u.uid === uid);
    if (idx === -1) return null;

    users[idx] = {
      ...users[idx],
      ...(updates.name !== undefined ? {
        name: updates.name,
        initials: updates.name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CC'
      } : {}),
      ...(updates.branch !== undefined ? { branch: updates.branch } : {}),
      ...(updates.year !== undefined ? { year: updates.year } : {}),
      ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
      ...(updates.skills !== undefined ? { skills: updates.skills } : {}),
      ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
      updatedAt: new Date().toISOString()
    };
    writeJsonFile(USERS_FILE, users);
    return toUserRecord(users[idx]);
  },

  async listConnectionsForUser(uid: string): Promise<ConnectionRecord[]> {
    ensureReady();
    if (isMongoConnected()) {
      const docs = await ConnectionModel.find({
        $or: [{ requesterId: uid }, { recipientId: uid }]
      }).exec();
      return docs.map(toConnectionRecord);
    }
    const connections = readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []);
    return connections.filter(c => c.requesterId === uid || c.recipientId === uid);
  },

  async findConnectionBetween(uid1: string, uid2: string): Promise<ConnectionRecord | null> {
    ensureReady();
    if (isMongoConnected()) {
      const doc = await ConnectionModel.findOne({
        $or: [
          { requesterId: uid1, recipientId: uid2 },
          { requesterId: uid2, recipientId: uid1 }
        ]
      }).exec();
      return doc ? toConnectionRecord(doc) : null;
    }
    const connections = readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []);
    return (
      connections.find(
        c =>
          (c.requesterId === uid1 && c.recipientId === uid2) ||
          (c.requesterId === uid2 && c.recipientId === uid1)
      ) || null
    );
  },

  async findConnectionById(id: string): Promise<ConnectionRecord | null> {
    ensureReady();
    if (isMongoConnected()) {
      const doc = await ConnectionModel.findOne({ id }).exec();
      return doc ? toConnectionRecord(doc) : null;
    }
    const connections = readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []);
    return connections.find(c => c.id === id) || null;
  },

  async createConnection(conn: ConnectionRecord): Promise<ConnectionRecord> {
    ensureReady();
    if (isMongoConnected()) {
      const doc = await ConnectionModel.create(conn);
      return toConnectionRecord(doc);
    }
    const connections = readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []);
    connections.push(conn);
    writeJsonFile(CONNECTIONS_FILE, connections);
    return conn;
  },

  async updateConnectionStatus(
    id: string,
    status: 'pending' | 'accepted' | 'rejected'
  ): Promise<ConnectionRecord | null> {
    ensureReady();
    if (isMongoConnected()) {
      const doc = await ConnectionModel.findOneAndUpdate(
        { id },
        { $set: { status } },
        { new: true }
      ).exec();
      return doc ? toConnectionRecord(doc) : null;
    }
    const connections = readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []);
    const idx = connections.findIndex(c => c.id === id);
    if (idx === -1) return null;
    connections[idx].status = status;
    connections[idx].updatedAt = new Date().toISOString();
    writeJsonFile(CONNECTIONS_FILE, connections);
    return connections[idx];
  },

  async deleteConnection(id: string): Promise<boolean> {
    ensureReady();
    if (isMongoConnected()) {
      const res = await ConnectionModel.deleteOne({ id }).exec();
      return res.deletedCount > 0;
    }
    const connections = readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []);
    const idx = connections.findIndex(c => c.id === id);
    if (idx === -1) return false;
    connections.splice(idx, 1);
    writeJsonFile(CONNECTIONS_FILE, connections);
    return true;
  },

  async listMessagesForUser(uid: string): Promise<MessageRecord[]> {
    ensureReady();
    if (isMongoConnected()) {
      const docs = await MessageModel.find({ participants: uid })
        .sort({ createdAt: 1 })
        .exec();
      return docs.map(toMessageRecord);
    }
    const messages = readJsonFile<MessageRecord[]>(MESSAGES_FILE, []);
    return messages.filter(m => m.participants && m.participants.includes(uid));
  },

  async listConversationMessages(uid1: string, uid2: string): Promise<MessageRecord[]> {
    ensureReady();
    if (isMongoConnected()) {
      const docs = await MessageModel.find({
        $or: [
          { from: uid1, to: uid2 },
          { from: uid2, to: uid1 }
        ]
      })
        .sort({ createdAt: 1 })
        .exec();
      return docs.map(toMessageRecord);
    }
    const messages = readJsonFile<MessageRecord[]>(MESSAGES_FILE, []);
    return messages
      .filter(m => (m.from === uid1 && m.to === uid2) || (m.from === uid2 && m.to === uid1))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async createMessage(msg: MessageRecord): Promise<MessageRecord> {
    ensureReady();
    if (isMongoConnected()) {
      const doc = await MessageModel.create(msg);
      return toMessageRecord(doc);
    }
    const messages = readJsonFile<MessageRecord[]>(MESSAGES_FILE, []);
    messages.push(msg);
    writeJsonFile(MESSAGES_FILE, messages);
    return msg;
  },

  async listNotificationsForUser(uid: string): Promise<NotificationRecord[]> {
    ensureReady();
    if (isMongoConnected()) {
      const docs = await NotificationModel.find({ recipientId: uid })
        .sort({ createdAt: -1 })
        .exec();
      return docs.map(toNotificationRecord);
    }
    const notifications = readJsonFile<NotificationRecord[]>(NOTIFICATIONS_FILE, []);
    return notifications
      .filter(n => n.recipientId === uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createNotifications(notifs: NotificationRecord[]): Promise<void> {
    if (notifs.length === 0) return;
    ensureReady();
    if (isMongoConnected()) {
      await NotificationModel.insertMany(notifs, { ordered: false }).catch(err => {
        console.warn('[Database] Partial/duplicate notification insert ignored:', err?.message);
      });
      return;
    }
    const notifications = readJsonFile<NotificationRecord[]>(NOTIFICATIONS_FILE, []);
    for (const notif of notifs) {
      const exists = notifications.some(
        n =>
          n.recipientId === notif.recipientId &&
          n.type === notif.type &&
          n.relatedUserId === notif.relatedUserId
      );
      if (!exists) {
        notifications.push(notif);
      }
    }
    writeJsonFile(NOTIFICATIONS_FILE, notifications);
  },

  async markNotificationRead(id: string, recipientId: string): Promise<NotificationRecord | null> {
    ensureReady();
    if (isMongoConnected()) {
      const doc = await NotificationModel.findOneAndUpdate(
        { id, recipientId },
        { $set: { isRead: true } },
        { new: true }
      ).exec();
      return doc ? toNotificationRecord(doc) : null;
    }
    const notifications = readJsonFile<NotificationRecord[]>(NOTIFICATIONS_FILE, []);
    const notif = notifications.find(n => n.id === id && n.recipientId === recipientId);
    if (!notif) return null;
    notif.isRead = true;
    writeJsonFile(NOTIFICATIONS_FILE, notifications);
    return notif;
  },

  async markAllNotificationsRead(recipientId: string): Promise<number> {
    ensureReady();
    if (isMongoConnected()) {
      const res = await NotificationModel.updateMany(
        { recipientId, isRead: false },
        { $set: { isRead: true } }
      ).exec();
      return res.modifiedCount || 0;
    }
    const notifications = readJsonFile<NotificationRecord[]>(NOTIFICATIONS_FILE, []);
    let count = 0;
    notifications.forEach(n => {
      if (n.recipientId === recipientId && !n.isRead) {
        n.isRead = true;
        count++;
      }
    });
    if (count > 0) {
      writeJsonFile(NOTIFICATIONS_FILE, notifications);
    }
    return count;
  },

  async getCounts(): Promise<{ usersCount: number; connectionsCount: number; messagesCount: number }> {
    if (!isDatabaseReady()) {
      return { usersCount: 0, connectionsCount: 0, messagesCount: 0 };
    }
    if (isMongoConnected()) {
      const [usersCount, connectionsCount, messagesCount] = await Promise.all([
        UserModel.countDocuments({ isActive: { $ne: false } }).exec(),
        ConnectionModel.countDocuments().exec(),
        MessageModel.countDocuments().exec()
      ]);
      return { usersCount, connectionsCount, messagesCount };
    }
    return {
      usersCount: readJsonFile<UserRecord[]>(USERS_FILE, []).filter(u => u.isActive !== false).length,
      connectionsCount: readJsonFile<ConnectionRecord[]>(CONNECTIONS_FILE, []).length,
      messagesCount: readJsonFile<MessageRecord[]>(MESSAGES_FILE, []).length
    };
  }
};
