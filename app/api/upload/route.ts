import { NextResponse } from 'next/server';
import { saveFileToNeon } from '@/lib/file-storage';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store file directly in Neon PostgreSQL
    const saved = await saveFileToNeon({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    const publicUrl = saved.url;
    return NextResponse.json({
      publicUrl,
      data: { publicUrl },
      id: saved.id,
      error: null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
