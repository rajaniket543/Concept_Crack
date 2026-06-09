import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

type RedisReply = string | number | null | RedisReply[];

interface RedisCommandOptions {
  nx?: boolean;
  px?: number;
}

interface LeaseRecord {
  token: string;
  expiresAt: number;
}

interface CacheBackend {
  set(key: string, value: string, options?: RedisCommandOptions): Promise<RedisReply>;
  get(key: string): Promise<RedisReply>;
  del(key: string): Promise<RedisReply>;
  eval(script: string, keys: string[], args: string[]): Promise<RedisReply>;
}

function encodeCommand(parts: string[]) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

function parseReply(buffer: Buffer, offset = 0): [RedisReply, number] | null {
  if (offset >= buffer.length) return null;

  const type = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) return null;

  const readLine = () => buffer.toString('utf8', offset + 1, lineEnd);
  const nextOffset = lineEnd + 2;

  if (type === '+') {
    return [readLine(), nextOffset];
  }
  if (type === '-') {
    throw new Error(readLine());
  }
  if (type === ':') {
    return [Number(readLine()), nextOffset];
  }
  if (type === '$') {
    const size = Number(readLine());
    if (size === -1) return [null, nextOffset];
    if (buffer.length < nextOffset + size + 2) return null;
    const value = buffer.toString('utf8', nextOffset, nextOffset + size);
    return [value, nextOffset + size + 2];
  }
  if (type === '*') {
    const count = Number(readLine());
    if (count === -1) return [null, nextOffset];
    let cursor = nextOffset;
    const out: RedisReply[] = [];
    for (let i = 0; i < count; i += 1) {
      const parsed = parseReply(buffer, cursor);
      if (!parsed) return null;
      out.push(parsed[0]);
      cursor = parsed[1];
    }
    return [out, cursor];
  }
  throw new Error(`Unsupported RESP type: ${type}`);
}

class RedisConnection implements CacheBackend {
  private socket: net.Socket | tls.TLSSocket | null = null;

  private pendingResolve: ((value: RedisReply) => void) | null = null;

  private pendingReject: ((reason?: unknown) => void) | null = null;

  private buffered = Buffer.alloc(0);

  private connecting: Promise<void> | null = null;

  private readonly url: URL;

  constructor(url: string) {
    this.url = new URL(url);
  }

  private async connect() {
    if (this.socket) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      const port = Number(this.url.port || (this.url.protocol === 'rediss:' ? 6380 : 6379));
      const host = this.url.hostname;
      const socket =
        this.url.protocol === 'rediss:'
          ? tls.connect({
              host,
              port,
              servername: host,
            })
          : net.createConnection({ host, port });

      socket.setNoDelay(true);

      const onError = (error: Error) => {
        socket.removeListener('connect', onConnect);
        reject(error);
      };

      const onConnect = async () => {
        socket.removeListener('error', onError);
        this.socket = socket;
        this.attachListeners(socket);

        try {
          if (this.url.password) {
            await this.sendCommand(['AUTH', decodeURIComponent(this.url.password)]);
          }
          const db = this.url.pathname?.replace(/^\//, '');
          if (db) {
            await this.sendCommand(['SELECT', db]);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      socket.once('error', onError);
      socket.once('connect', onConnect);
    }).finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  private attachListeners(socket: net.Socket | tls.TLSSocket) {
    socket.on('data', (chunk: Buffer) => {
      this.buffered = Buffer.concat([this.buffered, chunk]);
      this.consumeBuffer();
    });
    socket.on('error', (error) => {
      this.pendingReject?.(error);
      this.pendingResolve = null;
      this.pendingReject = null;
      this.socket = null;
      this.buffered = Buffer.alloc(0);
    });
    socket.on('close', () => {
      this.socket = null;
      this.buffered = Buffer.alloc(0);
    });
  }

  private consumeBuffer() {
    while (this.pendingResolve) {
      const parsed = parseReply(this.buffered);
      if (!parsed) return;
      const [reply, offset] = parsed;
      this.buffered = this.buffered.slice(offset);
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      this.pendingReject = null;
      resolve(reply);
    }
  }

  private async sendCommand(parts: string[]): Promise<RedisReply> {
    await this.connect();
    if (!this.socket) throw new Error('Redis connection unavailable.');
    if (this.pendingResolve) {
      throw new Error('Redis command already in flight.');
    }

    const payload = encodeCommand(parts);
    return new Promise<RedisReply>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.socket?.write(payload, (error) => {
        if (error) {
          this.pendingResolve = null;
          this.pendingReject = null;
          reject(error);
        }
      });
    });
  }

  async set(key: string, value: string, options: RedisCommandOptions = {}) {
    const parts = ['SET', key, value];
    if (options.nx) parts.push('NX');
    if (typeof options.px === 'number') parts.push('PX', String(options.px));
    return this.sendCommand(parts);
  }

  async get(key: string) {
    return this.sendCommand(['GET', key]);
  }

  async del(key: string) {
    return this.sendCommand(['DEL', key]);
  }

  async eval(script: string, keys: string[], args: string[]) {
    return this.sendCommand(['EVAL', script, String(keys.length), ...keys, ...args]);
  }
}

class MemoryCache implements CacheBackend {
  private store = new Map<string, LeaseRecord>();

  private now() {
    return Date.now();
  }

  private prune(key: string) {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry ?? null;
  }

  async set(key: string, value: string, options: RedisCommandOptions = {}) {
    const existing = this.prune(key);
    if (options.nx && existing) return null;
    const ttl = typeof options.px === 'number' ? Math.max(1, options.px) : 60_000;
    this.store.set(key, { token: value, expiresAt: this.now() + ttl });
    return 'OK';
  }

  async get(key: string) {
    return this.prune(key)?.token ?? null;
  }

  async del(key: string) {
    const existed = this.prune(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async eval(script: string, keys: string[], args: string[]) {
    const key = keys[0];
    if (!key) return 0;
    const current = this.prune(key);
    if (!current) return 0;
    const token = args[0];
    if (current.token !== token) return 0;
    if (script.includes('PEXPIRE')) {
      const ttl = Number(args[1] ?? '0');
      current.expiresAt = this.now() + Math.max(1, ttl);
      this.store.set(key, current);
      return 1;
    }
    this.store.delete(key);
    return 1;
  }
}

const backend: CacheBackend = process.env.REDIS_URL ? new RedisConnection(process.env.REDIS_URL) : new MemoryCache();

const LEASE_PREFIX = 'prepmind:exam:lease:';
const SNAPSHOT_PREFIX = 'prepmind:exam:snapshot:';
const TIMER_GRACE_MS = 2 * 60 * 1000;

function leaseKey(sessionId: string) {
  return `${LEASE_PREFIX}${sessionId}`;
}

function snapshotKey(sessionId: string) {
  return `${SNAPSHOT_PREFIX}${sessionId}`;
}

function ttlForAttempt(startedAtMs: number, durationSeconds: number) {
  const expiresAt = startedAtMs + durationSeconds * 1000 + TIMER_GRACE_MS;
  return Math.max(5_000, expiresAt - Date.now());
}

export async function rememberExamSession(snapshot: {
  sessionId: string;
  startedAt: number;
  durationSeconds: number;
  status: string;
  currentIndex: number;
}) {
  const ttl = ttlForAttempt(snapshot.startedAt, snapshot.durationSeconds);
  await backend.set(snapshotKey(snapshot.sessionId), JSON.stringify(snapshot), { px: ttl });
}

export async function touchExamSession(snapshot: {
  sessionId: string;
  startedAt: number;
  durationSeconds: number;
  status: string;
  currentIndex: number;
}) {
  await rememberExamSession(snapshot);
}

export async function forgetExamSession(sessionId: string) {
  await Promise.all([backend.del(snapshotKey(sessionId)), backend.del(leaseKey(sessionId))]);
}

export async function acquireExamLease(sessionId: string, ttlMs = 12_000) {
  const token = `lease_${crypto.randomUUID().replace(/-/g, '')}`;
  const response = await backend.set(leaseKey(sessionId), token, { nx: true, px: ttlMs });
  return response === 'OK' ? token : null;
}

export async function refreshExamLease(sessionId: string, token: string, ttlMs = 12_000) {
  const response = await backend.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) else return 0 end`,
    [leaseKey(sessionId)],
    [token, String(ttlMs)],
  );
  return Number(response ?? 0) > 0;
}

export async function releaseExamLease(sessionId: string, token: string) {
  const response = await backend.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`,
    [leaseKey(sessionId)],
    [token],
  );
  return Number(response ?? 0) > 0;
}

export async function withExamLease<T>(sessionId: string, task: () => Promise<T>) {
  const token = await acquireExamLease(sessionId);
  if (!token) return null;
  try {
    return await task();
  } finally {
    await releaseExamLease(sessionId, token);
  }
}
