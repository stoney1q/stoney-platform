'use client';

import { useState } from 'react';
import { generateUploadUrl, registerMedia } from '@/lib/media/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UploadCloud } from 'lucide-react';

interface MediaUploaderProps {
  entityType: 'product' | 'repair';
  entityId: string;
  onUploadSuccess?: () => void;
}

export function MediaUploader({ entityType, entityId, onUploadSuccess }: MediaUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Get presigned URL and asset ID
      const { uploadUrl, assetId } = await generateUploadUrl({
        entityType,
        entityId,
        mimeType: file.type,
        sizeBytes: file.size,
        fileName: file.name,
      });

      // 2. Upload file to GCS
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // 3. Register media as READY
      await registerMedia(assetId);

      alert('Upload successful! The media file has been attached.');

      setFile(null);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'An unexpected error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-md bg-muted/20">
      <h3 className="text-sm font-medium">Upload Media</h3>
      <div className="flex items-center gap-2">
        <Input 
          type="file" 
          accept="image/jpeg, image/png, image/webp, application/pdf" 
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
          Upload
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Supported formats: JPEG, PNG, WEBP, PDF (Max 5MB)
      </p>
    </div>
  );
}
