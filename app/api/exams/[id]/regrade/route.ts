import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-server';
import { recalculateExamAttempts } from '@/lib/exam-grading';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }
    if (authUser.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can recalculate exam marks.' }, { status: 403 });
    }

    const examId = params.id;
    if (!examId) {
      return NextResponse.json({ error: 'Missing exam ID.' }, { status: 400 });
    }

    // Verify teacher owns the exam
    const [existing] = await (sql as any)`
      SELECT id, teacher_id, title FROM exams WHERE id = ${examId} LIMIT 1;
    `;
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
    }
    if (existing.teacher_id !== authUser.id) {
      return NextResponse.json({ error: 'Unauthorized to modify this exam.' }, { status: 403 });
    }

    const result = await recalculateExamAttempts(examId);

    return NextResponse.json({
      success: true,
      message: `Marks successfully recalculated for ${result.affectedAttempts} student attempt(s).`,
      result,
    });
  } catch (err: unknown) {
    console.error('Error in regrade route:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to recalculate exam marks.' },
      { status: 500 }
    );
  }
}

