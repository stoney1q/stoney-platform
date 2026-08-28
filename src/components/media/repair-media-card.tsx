'use client';

import { useEffect, useState } from 'react';
import { MediaUploader } from '@/components/media/media-uploader';
import { MediaGallery } from '@/components/media/media-gallery';
import { MediaAsset } from '@/generated/prisma/client';
import { Loader2 } from 'lucide-react';
import { getRepairMedia } from '@/lib/media/actions';

export function RepairMediaCard({ repairId, isFinalized }: { repairId: string, isFinalized: boolean }) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const data = await getRepairMedia(repairId);
      setMedia(data);
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairId]);

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="mb-4 text-lg font-semibold">Repair Media</h3>
      
      {!isFinalized && (
        <div className="mb-6">
          <MediaUploader 
            entityType="repair" 
            entityId={repairId} 
            onUploadSuccess={fetchMedia} 
          />
        </div>
      )}
      
      <div>
        <h4 className="font-medium mb-2 text-sm text-muted-foreground">Attached Files</h4>
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MediaGallery media={media} onDeleteSuccess={fetchMedia} />
        )}
      </div>
    </div>
  );
}
