import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Extracts the owner ID from a file path.
 * File paths are expected to be in the format: {userId}/{filename} or {userId}/subfolder/{filename}
 * 
 * @param filePath - The file path to extract owner from
 * @returns The owner ID or null if extraction fails
 */
export function extractOwnerFromPath(filePath: string): string | null {
    if (!filePath || typeof filePath !== 'string') {
        return null;
    }

    // Trim leading/trailing slashes and whitespace
    const cleanPath = filePath.trim().replace(/^\/+|\/+$/g, '');
    
    if (cleanPath.length === 0) {
        return null;
    }

    // Split by '/' and get the first segment (owner ID)
    const segments = cleanPath.split('/');
    const ownerId = segments[0];

    // Validate that owner ID is not empty
    if (!ownerId || ownerId.length === 0) {
        return null;
    }

    return ownerId;
}

/**
 * Verifies that the requesting user owns the file they are trying to access/delete.
 * 
 * @param requestingUserId - The ID of the user making the request
 * @param filePath - The path of the file being accessed
 * @returns true if the user owns the file, false otherwise
 */
export function verifyOwnership(requestingUserId: string, filePath: string): boolean {
    if (!requestingUserId || typeof requestingUserId !== 'string') {
        return false;
    }

    const fileOwnerId = extractOwnerFromPath(filePath);
    
    if (!fileOwnerId) {
        return false;
    }

    return requestingUserId === fileOwnerId;
}

/**
 * Middleware to verify file ownership before allowing file operations.
 * Returns 403 Forbidden if the requesting user does not own the file.
 * 
 * Expects:
 * - req.auth.userId to be set by authentication middleware
 * - req.params.path to contain the file path
 */
export const verifyFileOwnership = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get the requesting user's ID from auth middleware
        const requestingUserId = req.auth?.userId || (req as any).user?.id;

        if (!requestingUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - User not authenticated',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        // Get the file path from request params
        const filePath = req.params.path;

        if (!filePath) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Bad Request - File path not provided',
                code: 'VALIDATION_ERROR',
            });
            return;
        }

        // Extract owner ID from file path
        const fileOwnerId = extractOwnerFromPath(filePath);

        if (!fileOwnerId) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Bad Request - Invalid file path format',
                code: 'VALIDATION_ERROR',
            });
            return;
        }

        // Verify ownership
        if (!verifyOwnership(requestingUserId, filePath)) {
            // Log the unauthorized attempt
            logger.warn(
                `Unauthorized file deletion attempt: User ${requestingUserId} tried to delete file owned by ${fileOwnerId}. Path: ${filePath}`
            );

            res.status(403).json({
                status: 'ERROR',
                message: 'Forbidden - You do not have permission to delete this file',
                code: 'FORBIDDEN',
            });
            return;
        }

        // User owns the file, proceed to next middleware/controller
        next();
    } catch (error: any) {
        logger.warn('Ownership verification error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Internal server error during ownership verification',
            code: 'INTERNAL_ERROR',
        });
    }
};
