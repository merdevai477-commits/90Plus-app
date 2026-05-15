/**
 * XP Server-Sent Events (SSE) Service
 *
 * Manages open SSE connections per user and pushes real-time XP updates.
 * Uses an in-memory Map — suitable for a single Railway instance.
 */

import { Response } from 'express';
import { logger } from '../utils/logger';

interface SseConnection {
  res: Response;
  userId: string;
  connectedAt: number;
}

const connections = new Map<string, SseConnection[]>();

/**
 * Register an SSE connection for a user.
 * A user can have multiple connections (multiple tabs/devices).
 */
export function addSseConnection(userId: string, res: Response): void {
  const conn: SseConnection = { res, userId, connectedAt: Date.now() };
  const existing = connections.get(userId) || [];
  existing.push(conn);
  connections.set(userId, existing);
  logger.debug('SSE connection added', { userId, totalForUser: existing.length });
}

/**
 * Remove an SSE connection when the client disconnects.
 */
export function removeSseConnection(userId: string, res: Response): void {
  const existing = connections.get(userId);
  if (!existing) return;
  const filtered = existing.filter((c) => c.res !== res);
  if (filtered.length === 0) {
    connections.delete(userId);
  } else {
    connections.set(userId, filtered);
  }
  logger.debug('SSE connection removed', { userId, remaining: filtered.length });
}

/**
 * Push an XP update event to all open connections for a user.
 */
export function pushXpUpdate(userId: string, payload: {
  xp: number;
  level: number;
  xpGained: number;
  action: string;
  leveledUp: boolean;
  newTitle?: string;
}): void {
  const conns = connections.get(userId);
  if (!conns || conns.length === 0) return;

  const data = JSON.stringify({ type: 'xp_update', ...payload });
  const message = `data: ${data}\n\n`;

  for (const conn of conns) {
    try {
      conn.res.write(message);
    } catch {
      // Connection broken — will be cleaned up on 'close' event
    }
  }
}

/**
 * Get the count of active SSE connections (for monitoring).
 */
export function getSseConnectionCount(): number {
  let count = 0;
  for (const conns of connections.values()) {
    count += conns.length;
  }
  return count;
}
