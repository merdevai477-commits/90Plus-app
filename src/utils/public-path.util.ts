import fs from 'fs';
import path from 'path';

/**
 * Resolve the public assets directory for both dev (src/) and prod (dist/) layouts.
 * Prefer dist/public when present (post-build copy), otherwise repo public/.
 */
export function resolvePublicDir(callerDirname: string): string {
  const candidates = [
    path.join(callerDirname, '..', 'public'), // dist/src → dist/public
    path.join(callerDirname, '..', '..', 'public'), // dist/src/routes → dist/public
    path.join(process.cwd(), 'dist', 'public'),
    path.join(process.cwd(), 'public'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function resolvePublicFile(callerDirname: string, filename: string): string {
  return path.join(resolvePublicDir(callerDirname), filename);
}
