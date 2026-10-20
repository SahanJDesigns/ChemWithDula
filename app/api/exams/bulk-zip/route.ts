import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-server';

const ANSWER_MAP: Record<string, 'a' | 'b' | 'c' | 'd' | 'e'> = {
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
  '5': 'e',
  'a': 'a',
  'b': 'b',
  'c': 'c',
  'd': 'd',
  'e': 'e',
};

// Regex to match question filename:
// Matches e.g. "1-3.png", "10-2.jpg", "Q14_5.png", "question_5 - 4.webp"
const QUESTION_FILE_REGEX = /^(?:q(?:uestion)?[_.\s-]*)?(\d+)[_.\s-]+([1-5a-eA-E])\.(png|jpe?g|webp|gif)$/i;

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'You must be signed in to perform this action.' }, { status: 401 });
    }
    if (authUser.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can create or manage exams.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'create'; // 'create' | 'append'
    const targetExamId = formData.get('exam_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No ZIP file uploaded.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Collect all image entries
    interface ZipQuestionItem {
      zipPath: string;
      filename: string;
      qNum: number;
      detectedAnswer: 'a' | 'b' | 'c' | 'd' | 'e';
      rawAnswer: string;
      extension: string;
      entry: JSZip.JSZipObject;
    }

    const matchedItems: ZipQuestionItem[] = [];
    const unmatchedFiles: string[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) return;

      const baseName = relativePath.split('/').pop() || relativePath;
      const match = baseName.match(QUESTION_FILE_REGEX);
      if (match) {
        const qNum = parseInt(match[1], 10);
        const rawAns = match[2].toLowerCase();
        const mappedAns = ANSWER_MAP[rawAns];
        const ext = match[3].toLowerCase();

        if (mappedAns) {
          matchedItems.push({
            zipPath: relativePath,
            filename: baseName,
            qNum,
            detectedAnswer: mappedAns,
            rawAnswer: match[2],
            extension: ext,
            entry: zipEntry,
          });
          return;
        }
      }

      unmatchedFiles.push(relativePath);
    });

    if (matchedItems.length === 0) {
      return NextResponse.json(
        {
          error:
            'No matching question images found in the ZIP archive. Images should be named like "1-3.png" (Question 1, Answer 3).',
          unmatchedFiles: unmatchedFiles.slice(0, 10),
        },
        { status: 400 }
      );
    }

    // Sort by question number numerically
    matchedItems.sort((a, b) => a.qNum - b.qNum);

    // Optional custom answers override map from request (JSON string: { [qNum]: 'a' | 'b' | ... })
    let customAnswers: Record<string, string> = {};
    const customAnswersRaw = formData.get('custom_answers') as string | null;
    if (customAnswersRaw) {
      try {
        customAnswers = JSON.parse(customAnswersRaw);
      } catch {
        // ignore parse error
      }
    }

    let examId: string | null = targetExamId;
    let initialOrderIndex = 0;

    if (mode === 'append') {
      if (!examId) {
        return NextResponse.json({ error: 'exam_id is required for append mode.' }, { status: 400 });
      }

      // Verify exam belongs to teacher
      const [existingExam] = await sql`SELECT id, teacher_id FROM exams WHERE id = ${examId} LIMIT 1;`;
      if (!existingExam) {
        return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
      }
      if (existingExam.teacher_id !== authUser.id) {
        return NextResponse.json({ error: 'Unauthorized to modify this exam.' }, { status: 403 });
      }

      // Count existing questions for ordering
      const [qCount] = await sql`SELECT COUNT(*)::int as cnt FROM questions WHERE exam_id = ${examId};`;
      initialOrderIndex = qCount?.cnt || 0;
    } else {
      // Create new exam
      const rawTitle = formData.get('title') as string | null;
      const defaultTitle = file.name.replace(/\.zip$/i, '').trim();
      const title = (rawTitle?.trim()) || defaultTitle || 'New Exam';
      const description = (formData.get('description') as string | null)?.trim() || '';
      const durationMinutes = parseInt(formData.get('duration_minutes') as string, 10) || 60;
      const startTime = (formData.get('start_time') as string | null)?.trim() || null;
      const endTime = (formData.get('end_time') as string | null)?.trim() || null;
      const isPublished = formData.get('is_published') === 'true';

      const [newExam] = await sql`
        INSERT INTO exams (title, description, teacher_id, duration_minutes, start_time, end_time, is_published)
        VALUES (${title}, ${description}, ${authUser.id}, ${durationMinutes}, ${startTime}, ${endTime}, ${isPublished})
        RETURNING id, title;
      `;

      if (!newExam?.id) {
        return NextResponse.json({ error: 'Failed to create exam record.' }, { status: 500 });
      }

      examId = newExam.id;
    }

    if (!examId) {
      return NextResponse.json({ error: 'Failed to obtain exam ID.' }, { status: 500 });
    }

    // Prepare upload directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'exams', examId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Extract each image and write to disk
    const questionsToInsert: Array<{
      exam_id: string;
      question_text: string;
      image_url: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      option_e: string;
      correct_option: string;
      order_index: number;
      points: number;
    }> = [];

    const pointsPerQuestion = parseInt(formData.get('points_per_question') as string, 10) || 1;

    for (let i = 0; i < matchedItems.length; i++) {
      const item = matchedItems[i];
      const imageBuffer = await item.entry.async('nodebuffer');

      // Unique file name to prevent collision
      const safeFilename = `q${item.qNum}_${Date.now()}_${i}.${item.extension}`;
      const destPath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(destPath, imageBuffer);

      const publicUrl = `/uploads/exams/${examId}/${safeFilename}`;
      const finalAnswer = customAnswers[item.qNum] || item.detectedAnswer;

      questionsToInsert.push({
        exam_id: examId,
        question_text: `Question ${item.qNum}`,
        image_url: publicUrl,
        option_a: '(1)',
        option_b: '(2)',
        option_c: '(3)',
        option_d: '(4)',
        option_e: '(5)',
        correct_option: finalAnswer,
        order_index: initialOrderIndex + i,
        points: pointsPerQuestion,
      });
    }

    // Batch insert into Neon Postgres
    const cols = [
      'exam_id',
      'question_text',
      'image_url',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'option_e',
      'correct_option',
      'order_index',
      'points',
    ];

    const params: any[] = [];
    const rowsClauses: string[] = [];
    let pIdx = 1;

    for (const q of questionsToInsert) {
      const rowPlaceholders: string[] = [];
      const rowValues = [
        q.exam_id,
        q.question_text,
        q.image_url,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.option_e,
        q.correct_option,
        q.order_index,
        q.points,
      ];
      for (const val of rowValues) {
        rowPlaceholders.push(`$${pIdx++}`);
        params.push(val);
      }
      rowsClauses.push(`(${rowPlaceholders.join(', ')})`);
    }

    const batchQuery = `
      INSERT INTO questions (${cols.join(', ')})
      VALUES ${rowsClauses.join(', ')}
      RETURNING id;
    `;

    const insertedQuestions = await (sql as any)(batchQuery, params);

    return NextResponse.json({
      success: true,
      examId,
      questionsCount: insertedQuestions.length,
      unmatchedCount: unmatchedFiles.length,
      unmatchedFiles: unmatchedFiles.slice(0, 10),
    });
  } catch (err: unknown) {
    console.error('Bulk ZIP upload error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to process ZIP file';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
