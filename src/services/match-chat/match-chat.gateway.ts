import type { Namespace, Server, Socket } from 'socket.io';
import { MATCH_CHAT_CONFIG, matchChatRoom, matchChatUserRoom } from '../../config/match-chat.config';
import { logger } from '../../utils/logger';
import { loadMatchChatUser, verifyClerkSocketToken } from './match-chat.auth';
import { consumeIpConnectLimit } from './match-chat.rate-limit';
import {
  dropPresence,
  loadJoinHistory,
  processMatchChatSend,
  roomName,
  touchPresence,
} from './match-chat.service';
import { MATCH_CHAT_EVENTS, type MatchChatSocketUser } from './match-chat.types';
import { matchChatJoinSchema, matchChatLeaveSchema } from './match-chat.validation';
import { matchChatIncr } from './match-chat.metrics';
import { startMatchChatPersistWorker } from './match-chat.persist.queue';
import { attachRedisAdapter } from './match-chat.adapter';
import { getFrozenUntil } from './match-chat.policy';

type AuthedSocket = Socket & { data: { user?: MatchChatSocketUser; matchId?: number } };

function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (socket.handshake.address || '0.0.0.0').slice(0, 64);
}

function handshakeToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token;
  }
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

async function authMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const ip = clientIp(socket);
    const ipLimit = await consumeIpConnectLimit(ip);
    if (!ipLimit.allowed) {
      matchChatIncr('rateLimited');
      next(new Error('RATE_LIMITED'));
      return;
    }

    const token = handshakeToken(socket);
    if (!token) {
      matchChatIncr('unauthorized');
      next(new Error('UNAUTHORIZED'));
      return;
    }

    const clerkUserId = await verifyClerkSocketToken(token);
    if (!clerkUserId) {
      matchChatIncr('unauthorized');
      next(new Error('UNAUTHORIZED'));
      return;
    }

    const user = await loadMatchChatUser(clerkUserId);
    if (!user) {
      matchChatIncr('unauthorized');
      next(new Error('UNAUTHORIZED'));
      return;
    }

    (socket as AuthedSocket).data.user = user;
    next();
  } catch (err) {
    logger.warn('[match-chat] auth middleware error', {
      message: err instanceof Error ? err.message : String(err),
    });
    next(new Error('UNAUTHORIZED'));
  }
}

export class MatchChatGateway {
  private static nsp: Namespace | null = null;

  static attach(io: Server): Namespace {
    if (this.nsp) return this.nsp;

    startMatchChatPersistWorker();
    void attachRedisAdapter(io);

    this.nsp = io.of(MATCH_CHAT_CONFIG.namespace);
    this.nsp.use((socket, next) => {
      void authMiddleware(socket, next);
    });

    this.nsp.on('connection', (socket) => {
      this.onConnection(socket as AuthedSocket);
    });

    logger.info('[match-chat] namespace attached', { namespace: MATCH_CHAT_CONFIG.namespace });
    return this.nsp;
  }

  private static onConnection(socket: AuthedSocket): void {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(matchChatUserRoom(user.userId));

    socket.on(MATCH_CHAT_EVENTS.join, (payload: unknown) => {
      void this.handleJoin(socket, payload);
    });
    socket.on(MATCH_CHAT_EVENTS.leave, (payload: unknown) => {
      void this.handleLeave(socket, payload);
    });
    socket.on(MATCH_CHAT_EVENTS.send, (payload: unknown) => {
      void this.handleSend(socket, payload);
    });
    socket.on('disconnect', () => {
      const matchId = socket.data.matchId;
      if (matchId && user) {
        void dropPresence(matchId, user.userId);
      }
    });
  }

  private static async handleJoin(socket: AuthedSocket, payload: unknown): Promise<void> {
    const user = socket.data.user;
    if (!user) return;
    const parsed = matchChatJoinSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit(MATCH_CHAT_EVENTS.error, { code: 'INVALID_MESSAGE' });
      return;
    }

    const prev = socket.data.matchId;
    if (prev && prev !== parsed.data.matchId) {
      socket.leave(roomName(prev));
      await dropPresence(prev, user.userId);
    }

    socket.data.matchId = parsed.data.matchId;
    socket.join(roomName(parsed.data.matchId));
    await touchPresence(parsed.data.matchId, user.userId);

    const frozenUntil = await getFrozenUntil(user.userId);
    if (frozenUntil) {
      socket.emit(MATCH_CHAT_EVENTS.frozen, {
        frozenUntil: new Date(frozenUntil).toISOString(),
        remainingMs: Math.max(0, frozenUntil - Date.now()),
      });
    }

    const history = await loadJoinHistory(parsed.data.matchId, user.userId, parsed.data.lastMessageId);
    socket.emit(MATCH_CHAT_EVENTS.history, {
      matchId: parsed.data.matchId,
      messages: history.messages,
      missed: history.missed,
      hasMore: history.hasMore,
    });
  }

  private static async handleLeave(socket: AuthedSocket, payload: unknown): Promise<void> {
    const user = socket.data.user;
    if (!user) return;
    const parsed = matchChatLeaveSchema.safeParse(payload);
    if (!parsed.success) return;
    socket.leave(roomName(parsed.data.matchId));
    await dropPresence(parsed.data.matchId, user.userId);
    if (socket.data.matchId === parsed.data.matchId) {
      socket.data.matchId = undefined;
    }
  }

  private static async handleSend(socket: AuthedSocket, payload: unknown): Promise<void> {
    const user = socket.data.user;
    if (!user) {
      socket.emit(MATCH_CHAT_EVENTS.rejected, { code: 'UNAUTHORIZED' });
      return;
    }

    const result = await processMatchChatSend({
      user,
      ip: clientIp(socket),
      payload,
    });

    if (!result.ok) {
      socket.emit(MATCH_CHAT_EVENTS.rejected, {
        clientMessageId:
          payload && typeof payload === 'object' && 'clientMessageId' in payload
            ? (payload as { clientMessageId?: string }).clientMessageId
            : undefined,
        code: result.code,
        retryAfterMs: result.retryAfterMs,
        reason: result.reason,
      });
      if (result.warned) {
        socket.emit(MATCH_CHAT_EVENTS.warned, result.warned);
      }
      if (result.frozen) {
        socket.emit(MATCH_CHAT_EVENTS.frozen, result.frozen);
      }
      return;
    }

    socket.emit(MATCH_CHAT_EVENTS.accepted, result.message);
    socket.to(matchChatRoom(result.message.matchId)).emit(MATCH_CHAT_EVENTS.accepted, result.message);
  }

  static emitDeleted(matchId: number, messageId: string): void {
    this.nsp?.to(matchChatRoom(matchId)).emit(MATCH_CHAT_EVENTS.deleted, { id: messageId, matchId });
  }

  static emitFrozen(userId: string, frozenUntil: string, remainingMs: number): void {
    this.nsp?.to(matchChatUserRoom(userId)).emit(MATCH_CHAT_EVENTS.frozen, { frozenUntil, remainingMs });
  }

  static emitWarned(userId: string, payload: { remainingStrikesUntilFreeze: number; category: string }): void {
    this.nsp?.to(matchChatUserRoom(userId)).emit(MATCH_CHAT_EVENTS.warned, payload);
  }

  static emitUnfrozen(userId: string): void {
    this.nsp?.to(matchChatUserRoom(userId)).emit(MATCH_CHAT_EVENTS.unfrozen, {});
  }

  static getNamespace(): Namespace | null {
    return this.nsp;
  }
}
