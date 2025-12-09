import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import streamifier from 'streamifier';

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
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `football-app/${folder}`,
                    resource_type: resourceType,
                },
                (error, result) => {
                    if (error) return reject(error);
                    if (!result) return reject(new Error('Upload failed'));
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                    });
                }
            );

            streamifier.createReadStream(fileBuffer).pipe(uploadStream);
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
            console.error(`Failed to delete file ${publicId}:`, error);
        }
    }
}
