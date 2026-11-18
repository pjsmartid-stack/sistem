import React, { useEffect, useState } from 'react';
import { fetchStoredFileBlob } from '../../lib/fileStorage';
import { ImageIcon } from 'lucide-react';

interface FirestoreImageProps {
  fileId?: string;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
  alt: string;
  className?: string;
}

export const FirestoreImage: React.FC<FirestoreImageProps> = ({
  fileId,
  imageUrl,
  fileName,
  mimeType,
  alt,
  className = 'w-full max-h-[420px] object-contain rounded-xl bg-slate-50 border border-slate-200',
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(fileId));
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!fileId) {
      if (imageUrl && !imageUrl.startsWith('firestore://')) {
        setSrc(imageUrl);
        setLoading(false);
        setFailed(false);
      } else {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setFailed(false);

    fetchStoredFileBlob(fileId, fileName, mimeType)
      .then(({ blob }) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setSrc(createdUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileId, imageUrl, fileName, mimeType]);

  if (loading) {
    return (
      <div className="w-full h-48 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500 font-medium">
        Memuat gambar materi...
      </div>
    );
  }

  if (failed || !src) {
    return (
      <div className="w-full py-8 px-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
        <ImageIcon className="w-7 h-7" />
        <span>{alt || fileName || 'Gambar tidak tersedia'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
