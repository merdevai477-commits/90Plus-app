import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';

export const optimizeUploadedImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      next();
      return;
    }

    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!imageTypes.includes(req.file.mimetype)) {
      next();
      return;
    }

    // Skip if already small (< 100KB)
    if (req.file.size < 100 * 1024) {
      next();
      return;
    }

    const originalSize = req.file.size;

    const optimized = await sharp(req.file.buffer)
      .resize(1080, 1080, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 75,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();

    // Only use optimized if it's actually smaller
    if (optimized.length < originalSize) {
      req.file.buffer = optimized;
      req.file.size = optimized.length;
      req.file.mimetype = 'image/jpeg';

      const savedPercent = ((1 - optimized.length / originalSize) * 100).toFixed(0);
      console.log(
        `[Sharp] Optimized: ${(originalSize / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB (${savedPercent}% saved)`
      );
    } else {
      console.log(`[Sharp] Original is already optimal (${(originalSize / 1024).toFixed(0)}KB)`);
    }

    next();
  } catch (error) {
    console.error('[Sharp] Optimization failed, using original:', error);
    next(); // Never fail the request
  }
};

export const generateServerThumbnail = async (
  buffer: Buffer,
  size: number = 200
): Promise<Buffer> => {
  return sharp(buffer)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 60 })
    .toBuffer();
};
