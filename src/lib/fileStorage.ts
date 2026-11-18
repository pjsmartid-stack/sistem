import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, cleanFirestoreData, handleFirestoreError, OperationType } from './firebase';
import { StoredFileType } from '../types';

// 300 KB per chunk (divisible by 3 for clean Base64 encoding -> ~400 KB per Firestore doc, well under 1 MB limit)
const RAW_CHUNK_SIZE = 300 * 1024;
export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StoredFileMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileSizeLabel: string;
  totalChunks: number;
  scope: 'course_material' | 'assignment_attachment' | 'assignment_submission' | 'class_file';
  scopeId: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileSizeLabel: string;
  fileType: StoredFileType;
  fileUrl: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function inferStoredFileType(fileName: string, mimeType?: string): StoredFileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf';
  if (lower.endsWith('.ppt')) return 'ppt';
  if (lower.endsWith('.pptx')) return 'pptx';
  if (lower.endsWith('.doc')) return 'doc';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.zip') || lower.endsWith('.rar')) return 'zip';
  if (
    mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/.test(lower)
  ) {
    return 'image';
  }
  return 'other';
}

export function inferMimeTypeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const sliceSize = 0x8000; // 32 KB per String.fromCharCode call to prevent call stack overflow
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += sliceSize) {
    const chunk = bytes.subarray(i, i + sliceSize);
    parts.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Uploads a real File to Firebase Firestore using chunked documents so files up to 10 MB
 * persist reliably across browsers, sessions, and devices without hitting the 1 MB doc limit.
 */
export async function uploadFileToFirestore(
  file: File,
  options: {
    scope: StoredFileMetadata['scope'];
    scopeId: string;
    uploadedBy: string;
  },
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  if (!file) {
    throw new Error('Tidak ada file yang dipilih untuk diunggah.');
  }

  if (file.size === 0) {
    throw new Error('File kosong (0 byte) tidak dapat diunggah.');
  }

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error(
      `Ukuran file (${formatFileSize(file.size)}) melebihi batas maksimum 10 MB. Silakan perkecil ukuran file atau gunakan tautan URL eksternal.`
    );
  }

  onProgress?.(5);

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const totalChunks = Math.max(1, Math.ceil(bytes.length / RAW_CHUNK_SIZE));
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const mimeType = file.type || inferMimeTypeFromName(file.name);
  const fileSizeLabel = formatFileSize(file.size);
  const fileType = inferStoredFileType(file.name, mimeType);

  const metadata: StoredFileMetadata = {
    id: fileId,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
    fileSizeLabel,
    totalChunks,
    scope: options.scope,
    scopeId: options.scopeId,
    uploadedBy: options.uploadedBy,
    uploadedAt: new Date().toISOString(),
  };

  try {
    // Upload chunks in small parallel batches of 3 to stay fast and resilient
    const batchSize = 3;
    let uploadedChunks = 0;

    for (let i = 0; i < totalChunks; i += batchSize) {
      const batchPromises: Promise<void>[] = [];
      for (let j = i; j < Math.min(i + batchSize, totalChunks); j++) {
        const start = j * RAW_CHUNK_SIZE;
        const end = Math.min(start + RAW_CHUNK_SIZE, bytes.length);
        const slice = bytes.subarray(start, end);
        const base64Data = uint8ArrayToBase64(slice);

        const chunkDocRef = doc(db, 'stored_files', fileId, 'chunks', `chunk_${String(j).padStart(4, '0')}`);
        batchPromises.push(
          setDoc(chunkDocRef, {
            chunkIndex: j,
            data: base64Data,
          }).then(() => {
            uploadedChunks += 1;
            const pct = Math.min(92, 10 + Math.round((uploadedChunks / totalChunks) * 82));
            onProgress?.(pct);
          })
        );
      }
      await Promise.all(batchPromises);
    }

    // Write master metadata doc after all chunks succeed
    await setDoc(doc(db, 'stored_files', fileId), cleanFirestoreData(metadata));

    // Verify metadata exists on Firestore
    const verifySnap = await getDoc(doc(db, 'stored_files', fileId));
    if (!verifySnap.exists()) {
      throw new Error('Verifikasi penyimpanan berkas di Firebase Firestore gagal.');
    }

    onProgress?.(100);

    return {
      fileId,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      fileSizeLabel,
      fileType,
      fileUrl: `firestore://${fileId}`,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `stored_files/${fileId}`);
    throw new Error(
      err instanceof Error
        ? `Gagal mengunggah file ke Firebase: ${err.message}`
        : 'Gagal mengunggah file ke Firebase Firestore.'
    );
  }
}

/**
 * Fetches a stored file from Firebase Firestore and reconstructs it as a real Blob.
 */
export async function fetchStoredFileBlob(
  fileId: string,
  fallbackFileName?: string,
  fallbackMimeType?: string
): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  try {
    const metaRef = doc(db, 'stored_files', fileId);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      throw new Error('Berkas tidak ditemukan di server Firebase (mungkin telah dihapus).');
    }

    const meta = metaSnap.data() as StoredFileMetadata;
    const chunksCol = collection(db, 'stored_files', fileId, 'chunks');
    const chunksQuery = query(chunksCol, orderBy('chunkIndex', 'asc'));
    const chunksSnap = await getDocs(chunksQuery);

    if (chunksSnap.empty) {
      throw new Error('Potongan data berkas tidak ditemukan di Firebase Firestore.');
    }

    const decodedArrays: Uint8Array[] = [];
    let totalLength = 0;

    chunksSnap.docs.forEach((docSnap) => {
      const chunkData = docSnap.data() as { chunkIndex: number; data: string };
      const bytes = base64ToUint8Array(chunkData.data);
      decodedArrays.push(bytes);
      totalLength += bytes.length;
    });

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of decodedArrays) {
      combined.set(arr, offset);
      offset += arr.length;
    }

    const finalMime = meta.mimeType || fallbackMimeType || inferMimeTypeFromName(meta.fileName || fallbackFileName || 'file');
    const finalName = meta.fileName || fallbackFileName || 'dokumen';
    const blob = new Blob([combined], { type: finalMime });

    return { blob, fileName: finalName, mimeType: finalMime };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `stored_files/${fileId}`);
    throw err;
  }
}

/**
 * Triggers a genuine browser download for either a Firestore-stored file or a valid external/data URL.
 */
export async function downloadFileResource(options: {
  fileId?: string;
  fileUrl?: string;
  fileName: string;
  mimeType?: string;
}): Promise<void> {
  const { fileId, fileUrl, fileName, mimeType } = options;

  // 1. Check if stored in Firestore via fileId or firestore:// URL
  const resolvedFileId =
    fileId || (fileUrl && fileUrl.startsWith('firestore://') ? fileUrl.replace('firestore://', '') : undefined);

  if (resolvedFileId) {
    const { blob, fileName: storedName } = await fetchStoredFileBlob(
      resolvedFileId,
      fileName,
      mimeType
    );
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = storedName || fileName || 'dokumen';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
    }
    return;
  }

  // 2. Check if data URL or http(s) URL
  if (fileUrl && fileUrl !== '#' && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('data:'))) {
    const a = document.createElement('a');
    a.href = fileUrl;
    if (fileUrl.startsWith('data:')) {
      a.download = fileName || 'dokumen';
    } else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = fileName || 'dokumen';
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  throw new Error(
    'Berkas ini belum memiliki file terunggah yang valid di server. Silakan hubungi dosen untuk mengunggah ulang file materi.'
  );
}

/**
 * Deletes a stored file and all its chunks from Firestore.
 */
export async function deleteStoredFile(fileId?: string): Promise<void> {
  if (!fileId) return;
  try {
    const chunksSnap = await getDocs(collection(db, 'stored_files', fileId, 'chunks'));
    await Promise.all(chunksSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'stored_files', fileId));
  } catch (err) {
    console.warn('Warning cleaning up stored file:', fileId, err);
  }
}
