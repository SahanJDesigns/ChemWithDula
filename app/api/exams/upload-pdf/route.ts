import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-server';
import { McqOptionLetter } from '@/lib/mcq-options';

const VALID_LETTERS: McqOptionLetter[] = ['a', 'b', 'c', 'd', 'e'];

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
    const pdfFile = formData.get('pdf') as File | null;
    const existingExamId = formData.get('exam_id') as string | null;

    const rawTitle = formData.get('title') as string | null;
    const title = rawTitle?.trim() || (pdfFile ? pdfFile.name.replace(/\.pdf$/i, '').trim() : 'New PDF Exam');
    const description = (formData.get('description') as string | null)?.trim() || '';
    const durationMinutes = parseInt(formData.get('duration_minutes') as string, 10) || 60;
    const startTime = (formData.get('start_time') as string | null)?.trim() || null;
    const endTime = (formData.get('end_time') as string | null)?.trim() || null;
    const isPublished = formData.get('is_published') === 'true';
    const questionCount = Math.max(1, Math.min(200, parseInt(formData.get('question_count') as string, 10) || 50));
    const optionCount = Math.max(2, Math.min(5, parseInt(formData.get('option_count') as string, 10) || 5));

    let answerKey: Record<number, McqOptionLetter> = {};
    const rawAnswerKey = formData.get('answer_key') as string | null;
    if (rawAnswerKey) {
      try {
        answerKey = JSON.parse(rawAnswerKey);
      } catch {
        answerKey = {};
      }
    }

    let examId = existingExamId;

    if (existingExamId) {
      // Check ownership
      const [existing] = await sql`SELECT id, teacher_id FROM exams WHERE id = ${existingExamId} LIMIT 1;`;
      if (!existing) {
        return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
      }
      if (existing.teacher_id !== authUser.id) {
        return NextResponse.json({ error: 'Unauthorized to modify this exam.' }, { status: 403 });
      }

      await sql`
        UPDATE exams
        SET title = ${title},
            description = ${description},
            duration_minutes = ${durationMinutes},
            start_time = ${startTime},
            end_time = ${endTime},
            is_published = ${isPublished},
            option_count = ${optionCount}
        WHERE id = ${existingExamId};
      `;
    } else {
      // Create new exam
      const [newExam] = await sql`
        INSERT INTO exams (title, description, teacher_id, duration_minutes, start_time, end_time, is_published, option_count)
        VALUES (${title}, ${description}, ${authUser.id}, ${durationMinutes}, ${startTime}, ${endTime}, ${isPublished}, ${optionCount})
        RETURNING id;
      `;

      if (!newExam?.id) {
        return NextResponse.json({ error: 'Failed to create exam record.' }, { status: 500 });
      }
      examId = newExam.id;
    }

    if (!examId) {
      return NextResponse.json({ error: 'Missing exam ID.' }, { status: 500 });
    }

    // If PDF file was provided, save to public/uploads/exams/<examId>/paper.pdf
    let pdfUrl: string | null = null;
    if (pdfFile && pdfFile.size > 0) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'exams', examId);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      const pdfFilePath = path.join(uploadsDir, 'paper.pdf');
      fs.writeFileSync(pdfFilePath, buffer);

      pdfUrl = `/uploads/exams/${examId}/paper.pdf?v=${Date.now()}`;
      await sql`UPDATE exams SET pdf_url = ${pdfUrl} WHERE id = ${examId};`;
    }

    // Populate or update questions
    // If creating or updating questions:
    if (!existingExamId || formData.get('regenerate_questions') === 'true') {
      // Delete existing questions if regenerating
      if (existingExamId) {
        await sql`DELETE FROM questions WHERE exam_id = ${examId};`;
      }

      // Generate question_count questions
      for (let q = 1; q <= questionCount; q++) {
        const correctLetter = (answerKey[q] && VALID_LETTERS.includes(answerKey[q])) ? answerKey[q] : 'a';
        await sql`
          INSERT INTO questions (
            exam_id,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            option_e,
            correct_option,
            order_index,
            points
          ) VALUES (
            ${examId},
            ${'Question ' + q},
            ${'(1)'},
            ${'(2)'},
            ${'(3)'},
            ${'(4)'},
            ${optionCount >= 5 ? '(5)' : ''},
            ${correctLetter},
            ${q - 1},
            1
          );
        `;
      }
    }

    return NextResponse.json({
      success: true,
      exam_id: examId,
      pdf_url: pdfUrl,
      question_count: questionCount,
    });
  } catch (err: unknown) {
    console.error('Error in upload-pdf route:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error while saving PDF exam.' },
      { status: 500 }
    );
  }
}

