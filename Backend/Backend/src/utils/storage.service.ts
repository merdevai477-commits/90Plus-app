import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import streamifier from 'streamifier';
import { logger } from './logger';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class StorageService {
    /**
     * Upload file to Cloudinary
     */
    private static uploadToCloudinary(
        fileBuffer: Buffer,
        folder: string,
        resourceType: 'image' | 'video' = 'image'
    ): Promise<{ url: string; publicId: string }> {
        return new Promise((resolve, reject) => {
            let uploadStream: any = null;
            let readStream: any = null;

            try {
                uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: `football-app/${folder}`,
                        resource_type: resourceType,
                    },
                    (error, result) => {
                        // Clean up streams
                        if (readStream && !readStream.destroyed) {
                            readStream.destroy();
                        }
                        if (uploadStream && !uploadStream.destroyed) {
                            uploadStream.destroy();
                        }

                        if (error) {
                            logger.error('Cloudinary upload error:', error);
                            return reject(error);
                        }
                        if (!result) {
                            return reject(new Error('Upload failed - no result'));
                        }
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                        });
                    }
                );

                // Create read stream from buffer
                readStream = streamifier.createReadStream(fileBuffer);

                // Handle stream errors
                readStream.on('error', (error: Error) => {
                    logger.error('Read stream error:', error);
                    // Clean up streams
                    if (uploadStream && !uploadStream.destroyed) {
                        uploadStream.destroy();
                    }
                    reject(error);
                });

                uploadStream.on('error', (error: Error) => {
                    logger.error('Upload stream error:', error);
                    // Clean up streams
                    if (readStream && !readStream.destroyed) {
                        readStream.destroy();
                    }
                    reject(error);
                });

                // Check if upload stream is writable before piping
                if (uploadStream && uploadStream.writable) {
                    readStream.pipe(uploadStream);
                } else {
                    throw new Error('Upload stream is not writable');
                }

            } catch (error) {
                logger.error('Stream setup error:', error);
                // Clean up any created streams
                if (readStream && !readStream.destroyed) {
                    readStream.destroy();
                }
                if (uploadStream && !uploadStream.destroyed) {
                    uploadStream.destroy();
                }
                reject(error);
            }
        });
    }

    /**
     * Upload User Avatar
     */
    static async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ url: string; path: string }> {
        const result = await this.uploadToCloudinary(file.buffer, 'avatars', 'image');
        return { url: result.url, path: result.publicId };
    }

    /**
     * Upload Reel Video
     */
    static async uploadReel(userId: string, file: Express.Multer.File): Promise<{ url: string; path: string }> {
        const result = await this.uploadToCloudinary(file.buffer, 'reels', 'video');
        return { url: result.url, path: result.publicId };
    }

    /**
     * Upload Reel Thumbnail
     */
    static async uploadThumbnail(userId: string, file: Express.Multer.File): Promise<{ url: string; path: string }> {
        const result = await this.uploadToCloudinary(file.buffer, 'thumbnails', 'image');
        return { url: result.url, path: result.publicId };
    }

    /**
     * Delete file from Cloudinary
     */
    static async deleteFile(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
        if (!publicId) return;

        try {
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        } catch (error) {
            logger.error(`Failed to delete file ${publicId}:`, error);
        }
    }
}
