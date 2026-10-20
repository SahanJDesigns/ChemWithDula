import { sql } from '@/lib/db';

export interface StoredFileRecord {
  id: string;
  file_name: string;
  mime_type: string;
  file_data: Buffer;
  file_size: number;
  created_at: string;
}

export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Save an uploaded file or buffer directly into Neon PostgreSQL
 */
export async function saveFileToNeon({
  fileName,
  mimeType,
  buffer,
}: {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<{ id: string; url: string; fileName: string; mimeType: string }> {
  const resolvedMime = mimeType || getMimeTypeFromFilename(fileName);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  const rows = await sql`
    INSERT INTO stored_files (file_name, mime_type, file_data, file_size)
    VALUES (${safeName}, ${resolvedMime}, ${buffer}, ${buffer.length})
    RETURNING id, file_name, mime_type;
  `;

  if (!rows || rows.length === 0) {
    throw new Error('Failed to insert file into Neon database.');
  }

  const fileId = rows[0].id;
  const url = `/api/files/${fileId}/${safeName}`;

  return {
    id: fileId,
    url,
    fileName: safeName,
    mimeType: resolvedMime,
  };
}

/**
 * Retrieve a file from Neon PostgreSQL by its ID
 */
export async function getFileFromNeon(
  id: string
): Promise<{ fileName: string; mimeType: string; buffer: Buffer; size: number } | null> {
  const rows = await sql`
    SELECT id, file_name, mime_type, file_data, file_size
    FROM stored_files
    WHERE id = ${id}
    LIMIT 1;
  `;

  if (!rows || rows.length === 0) return null;

  const file = rows[0];
  const buffer = Buffer.isBuffer(file.file_data)
    ? file.file_data
    : Buffer.from(file.file_data);

  return {
    fileName: file.file_name,
    mimeType: file.mime_type || 'application/octet-stream',
    buffer,
    size: buffer.length,
  };
}

