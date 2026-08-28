'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MediaUploader } from '@/components/media/media-uploader';
import { MediaGallery } from '@/components/media/media-gallery';
import { MediaAsset } from '@/generated/prisma/client';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { getProductMedia } from '@/lib/media/actions';

export function ProductMediaDialog({ productId, productName }: { productId: string, productName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const data = await getProductMedia(productId);
      setMedia(data);
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchMedia();
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleOpen}>
        <ImageIcon className="w-4 h-4 mr-2" />
        Media
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg shadow-lg flex flex-col">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-card z-10">
              <h3 className="text-lg font-bold">Media for {productName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              <MediaUploader 
                entityType="product" 
                entityId={productId} 
                onUploadSuccess={fetchMedia} 
              />
              
              <div>
                <h4 className="font-medium mb-2">Attached Media</h4>
                {isLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <MediaGallery media={media} onDeleteSuccess={fetchMedia} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
