"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2MediaStorage = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const logger_1 = require("../utils/logger");
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || '90plus-storage';
const BASE_URL = (process.env.CDN_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    logger_1.logger.warn('⚠️ R2 storage not fully configured. Check R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
}
else {
    logger_1.logger.info('✅ R2 Media Storage initialized');
}
const r2Client = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
});
const CACHE_HEADERS = {
    avatars: 'public, max-age=31536000, immutable',
    covers: 'public, max-age=31536000, immutable',
    thumbnails: 'public, max-age=31536000, immutable',
    reels: 'public, max-age=86400',
    videos: 'public, max-age=86400',
};
class R2MediaStorageService {
    isConfigured() {
        return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
    }
    async uploadFile(folder, fileBuffer, fileName, contentType) {
        if (!this.isConfigured()) {
            return { success: false, error: 'R2 storage not configured' };
        }
        try {
            const key = `${folder}/${fileName}`;
            const cacheControl = CACHE_HEADERS[folder] || 'public, max-age=3600';
            await r2Client.send(new client_s3_1.PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
                CacheControl: cacheControl,
                Metadata: {
                    'uploaded-at': new Date().toISOString(),
                    'content-size': fileBuffer.length.toString(),
                },
            }));
            const url = `${BASE_URL}/${key}`;
            const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
            logger_1.logger.info(`[R2] ✅ Uploaded ${folder}/${fileName} (${sizeMB}MB) → ${url}`);
            return { success: true, url, path: key };
        }
        catch (error) {
            logger_1.logger.error(`[R2] ❌ Upload failed for ${folder}/${fileName}:`, error.message);
            return { success: false, error: error.message };
        }
    }
    async deleteFile(key) {
        if (!this.isConfigured() || !key)
            return false;
        try {
            await r2Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            }));
            logger_1.logger.info(`[R2] 🗑️ Deleted: ${key}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`[R2] ❌ Delete failed for ${key}:`, error.message);
            return false;
        }
    }
    getUrl(key) {
        return `${BASE_URL}/${key}`;
    }
}
exports.r2MediaStorage = new R2MediaStorageService();
//# sourceMappingURL=r2-media-storage.service.js.map