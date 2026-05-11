/**
 * Standardized API error codes.
 *
 * Frontend matches on these codes, NEVER on the message string. Changing the
 * message (for localization, clarity, etc.) must not break the frontend.
 *
 * Categories (kept in sync with .kiro/steering/Mr.dev.md):
 *   E001 — Validation       (400)
 *   E002 — Authentication   (401)
 *   E003 — Authorization    (403)
 *   E004 — Not Found        (404)
 *   E005 — Conflict         (409)
 *   E006 — Rate Limit       (429)
 *   E007 — File Upload      (400)
 *   E008 — External Service (502)
 *   E009 — Database         (500)
 *   E010 — Internal         (500)
 */

import type { Response, Request } from 'express';

export const ErrorCode = {
    VALIDATION: 'E001',
    AUTHENTICATION: 'E002',
    AUTHORIZATION: 'E003',
    NOT_FOUND: 'E004',
    CONFLICT: 'E005',
    RATE_LIMIT: 'E006',
    FILE_UPLOAD: 'E007',
    EXTERNAL_SERVICE: 'E008',
    DATABASE: 'E009',
    INTERNAL: 'E010',
} as const;

export type ErrorCodeValue = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Default HTTP status for each error code. Callers can override when a more
 * specific status fits (e.g. 400 vs 422 for validation).
 */
export const ErrorStatus: Record<ErrorCodeValue, number> = {
    [ErrorCode.VALIDATION]: 400,
    [ErrorCode.AUTHENTICATION]: 401,
    [ErrorCode.AUTHORIZATION]: 403,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.CONFLICT]: 409,
    [ErrorCode.RATE_LIMIT]: 429,
    [ErrorCode.FILE_UPLOAD]: 400,
    [ErrorCode.EXTERNAL_SERVICE]: 502,
    [ErrorCode.DATABASE]: 500,
    [ErrorCode.INTERNAL]: 500,
};

/**
 * Response body shape for all error responses. The frontend relies on
 * `error` (the code) and `message` (human-readable). `details` is optional
 * structured context (e.g. which field failed validation).
 */
export interface ApiErrorBody {
    error: ErrorCodeValue;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    path: string;
}

/**
 * Emit a standardized error response.
 */
export function sendError(
    req: Request,
    res: Response,
    code: ErrorCodeValue,
    message: string,
    details?: Record<string, unknown>,
    statusOverride?: number,
): void {
    const body: ApiErrorBody = {
        error: code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: req.path,
    };
    res.status(statusOverride ?? ErrorStatus[code]).json(body);
}
