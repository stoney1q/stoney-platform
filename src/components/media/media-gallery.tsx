'use client';

import { useState } from 'react';
import { deleteMedia } from '@/lib/media/actions';
import { Button } from '@/components/ui/button';
import { Trash2, FileIcon, Eye, Loader2 } from 'lucide-react';
import { MediaAsset } from '@/generated/prisma/client';

interface MediaGalleryProps {
  media: MediaAsset[];
  onDeleteSuccess?: () => void;
}

export function MediaGallery({ media, onDeleteSuccess }: MediaGalleryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    
    setDeletingId(id);
    try {
      await deleteMedia(id);
      alert('Media asset has been removed.');
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'An unexpected error occurred.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!media || media.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No media attached.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      {media.map((asset) => {
        const isImage = asset.mimeType.startsWith('image/');
        const url = asset.isPublic && asset.url ? asset.url : `/api/media/${asset.id}`;

        return (
          <div key={asset.id} className="relative group border rounded-md overflow-hidden bg-muted/10">
            {isImage ? (
              <div className="aspect-square bg-muted/20 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  alt={asset.fileName} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="aspect-square flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
                <FileIcon className="w-12 h-12 mb-2" />
                <span className="text-xs max-w-[80%] truncate">{asset.fileName}</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button size="icon" variant="secondary" onClick={() => window.open(url, '_blank')}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="destructive" 
                onClick={() => handleDelete(asset.id)}
                disabled={deletingId === asset.id}
              >
                {deletingId === asset.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
            <div className="p-2 border-t text-xs truncate" title={asset.fileName}>
              {asset.fileName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
