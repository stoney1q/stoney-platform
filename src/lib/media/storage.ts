import { getFirebaseAdminStorage } from '@/lib/firebase/admin';

export interface PresignedUploadConfig {
  path: string;
  mimeType: string;
  sizeLimitBytes: number;
  expirationMs: number;
}

export interface MediaStorage {
  /**
   * Generates a presigned URL for uploading a file directly to storage.
   */
  generatePresignedUploadUrl(config: PresignedUploadConfig): Promise<string>;

  /**
   * Deletes an object from storage.
   */
  deleteObject(path: string): Promise<void>;

  /**
   * Gets a read stream for piping a private object.
   */
  getObjectStream(path: string): NodeJS.ReadableStream;

  /**
   * Gets the metadata of an object.
   */
  getObjectMetadata(path: string): Promise<{ size: number; contentType: string } | null>;
}

class GCSMediaStorage implements MediaStorage {
  async generatePresignedUploadUrl(config: PresignedUploadConfig): Promise<string> {
    const bucket = getFirebaseAdminStorage().bucket();
    const file = bucket.file(config.path);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + config.expirationMs,
      contentType: config.mimeType,
      extensionHeaders: {
        'x-goog-content-length-range': `0,${config.sizeLimitBytes}`,
      },
    });

    return url;
  }

  async deleteObject(path: string): Promise<void> {
    const bucket = getFirebaseAdminStorage().bucket();
    try {
      await bucket.file(path).delete();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 404) {
        // Ignore not found errors during deletion
        return;
      }
      throw error;
    }
  }

  getObjectStream(path: string): NodeJS.ReadableStream {
    const bucket = getFirebaseAdminStorage().bucket();
    return bucket.file(path).createReadStream();
  }

  async getObjectMetadata(path: string): Promise<{ size: number; contentType: string } | null> {
    const bucket = getFirebaseAdminStorage().bucket();
    try {
      const [metadata] = await bucket.file(path).getMetadata();
      return {
        size: Number(metadata.size),
        contentType: metadata.contentType || 'application/octet-stream',
      };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 404) {
        return null;
      }
      throw error;
    }
  }
}

export const storage: MediaStorage = new GCSMediaStorage();
