import { NextResponse } from 'next/server';
import { getFileFromNeon } from '@/lib/file-storage';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: { slug: string[] } }
) {
  try {
    const slug = params.slug;
    if (!slug || slug.length === 0) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileId = slug[0];

    // 1. First, attempt to retrieve directly from Neon PostgreSQL
    const neonFile = await getFileFromNeon(fileId);
    if (neonFile) {
      return new NextResponse(neonFile.buffer, {
        status: 200,
        headers: {
          'Content-Type': neonFile.mimeType,
          'Content-Length': neonFile.size.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': neonFile.mimeType === 'application/pdf' ? 'inline' : 'inline',
        },
      });
    }

    // 2. Fallback: check if file exists on disk under public/uploads
    const relativePath = slug.join('/');
    const diskPath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      const buffer = fs.readFileSync(diskPath);
      const ext = path.extname(diskPath).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.svg') mimeType = 'image/svg+xml';
      else if (ext === '.pdf') mimeType = 'application/pdf';

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return new NextResponse('File not found', { status: 404 });
  } catch (err: unknown) {
    console.error('Error serving file from Neon:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

