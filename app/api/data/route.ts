import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-server';

const ALLOWED_TABLES = new Set([
  'exams',
  'questions',
  'exam_attempts',
  'student_answers',
  'profiles',
  'users',
]);

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser();
    const body = await req.json();
    const { action, table, select, filters = [], order, limit, data, conflict } = body;

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: SELECT
    // ─────────────────────────────────────────────────────────────
    if (action === 'select') {
      let query = '';
      const params: any[] = [];
      let pIdx = 1;

      // Special join handlers for application ergonomics
      if (table === 'exams' && typeof select === 'string' && select.includes('questions(count)')) {
        query = `
          SELECT e.*, COALESCE(q.cnt, 0) as question_count
          FROM exams e
          LEFT JOIN (
            SELECT exam_id, COUNT(*)::int as cnt
            FROM questions
            GROUP BY exam_id
          ) q ON q.exam_id = e.id
        `;
      } else if (table === 'exam_attempts' && typeof select === 'string' && (select.includes('profiles') || select.includes('exams'))) {
        query = `
          SELECT 
            ea.*,
            json_build_object('full_name', p.full_name) as profiles,
            json_build_object('id', ex.id, 'title', ex.title, 'teacher_id', ex.teacher_id, 'end_time', ex.end_time) as exams
          FROM exam_attempts ea
          LEFT JOIN profiles p ON p.id = ea.student_id
          LEFT JOIN exams ex ON ex.id = ea.exam_id
        `;
      } else {
        query = `SELECT * FROM ${table}`;
      }

      const whereClauses: string[] = [];

      for (const f of filters) {
        const { column, operator, value } = f;
        if (!/^[a-zA-Z0-9_]+$/.test(column)) continue;

        // Prefix column with alias if joined query
        const colPrefix = (query.includes('FROM exams e') && column !== 'question_count') 
          ? `e.${column}` 
          : (query.includes('FROM exam_attempts ea') && ['id', 'exam_id', 'student_id', 'created_at', 'is_graded', 'score'].includes(column))
          ? `ea.${column}`
          : column;

        if (operator === 'eq') {
          whereClauses.push(`${colPrefix} = $${pIdx++}`);
          params.push(value);
        } else if (operator === 'in' && Array.isArray(value)) {
          if (value.length === 0) {
            whereClauses.push('1 = 0');
          } else {
            const placeholders = value.map(() => `$${pIdx++}`).join(', ');
            whereClauses.push(`${colPrefix} IN (${placeholders})`);
            params.push(...value);
          }
        }
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      if (order?.column && /^[a-zA-Z0-9_]+$/.test(order.column)) {
        const orderPrefix = query.includes('FROM exams e') ? `e.${order.column}` : query.includes('FROM exam_attempts ea') ? `ea.${order.column}` : order.column;
        query += ` ORDER BY ${orderPrefix} ${order.ascending === false ? 'DESC' : 'ASC'}`;
      }

      if (typeof limit === 'number' && limit > 0) {
        query += ` LIMIT $${pIdx++}`;
        params.push(limit);
      }

      let rows: any[] = [];
      if (params.length === 0) {
        rows = await (sql as any)(query);
      } else {
        rows = await (sql as any)(query, params);
      }

      // Format exams with questions(count) compatibility
      if (table === 'exams' && typeof select === 'string' && select.includes('questions(count)')) {
        rows = rows.map((r: any) => ({
          ...r,
          questions: [{ count: r.question_count ?? 0 }],
        }));
      }

      return NextResponse.json({ data: rows, error: null });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: INSERT
    // ─────────────────────────────────────────────────────────────
    if (action === 'insert') {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) {
        return NextResponse.json({ data: [], error: null });
      }

      const columns = Object.keys(records[0]).filter((k) => /^[a-zA-Z0-9_]+$/.test(k));
      if (columns.length === 0) {
        return NextResponse.json({ error: 'No valid columns to insert' }, { status: 400 });
      }

      const params: any[] = [];
      let pIdx = 1;
      const valuesRows: string[] = [];

      for (const rec of records) {
        const rowPlaceholders: string[] = [];
        for (const col of columns) {
          rowPlaceholders.push(`$${pIdx++}`);
          params.push(rec[col] !== undefined ? rec[col] : null);
        }
        valuesRows.push(`(${rowPlaceholders.join(', ')})`);
      }

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${valuesRows.join(', ')}
        RETURNING *;
      `;

      const rows = await (sql as any)(query, params);
      return NextResponse.json({
        data: Array.isArray(data) ? rows : (rows[0] || null),
        error: null,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: UPDATE
    // ─────────────────────────────────────────────────────────────
    if (action === 'update') {
      const updateCols = Object.keys(data || {}).filter((k) => /^[a-zA-Z0-9_]+$/.test(k));
      if (updateCols.length === 0) {
        return NextResponse.json({ error: 'No data to update' }, { status: 400 });
      }

      const params: any[] = [];
      let pIdx = 1;
      const setClauses: string[] = [];

      for (const col of updateCols) {
        setClauses.push(`${col} = $${pIdx++}`);
        params.push(data[col] !== undefined ? data[col] : null);
      }

      const whereClauses: string[] = [];
      for (const f of filters) {
        const { column, operator, value } = f;
        if (!/^[a-zA-Z0-9_]+$/.test(column)) continue;
        if (operator === 'eq') {
          whereClauses.push(`${column} = $${pIdx++}`);
          params.push(value);
        }
      }

      if (whereClauses.length === 0) {
        return NextResponse.json({ error: 'Update requires at least one eq filter' }, { status: 400 });
      }

      const query = `
        UPDATE ${table}
        SET ${setClauses.join(', ')}
        WHERE ${whereClauses.join(' AND ')}
        RETURNING *;
      `;

      const rows = await (sql as any)(query, params);
      return NextResponse.json({ data: rows, error: null });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: DELETE
    // ─────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const params: any[] = [];
      let pIdx = 1;
      const whereClauses: string[] = [];

      for (const f of filters) {
        const { column, operator, value } = f;
        if (!/^[a-zA-Z0-9_]+$/.test(column)) continue;
        if (operator === 'eq') {
          whereClauses.push(`${column} = $${pIdx++}`);
          params.push(value);
        }
      }

      if (whereClauses.length === 0) {
        return NextResponse.json({ error: 'Delete requires at least one eq filter' }, { status: 400 });
      }

      const query = `DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')} RETURNING *;`;
      const rows = await (sql as any)(query, params);
      return NextResponse.json({ data: rows, error: null });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: UPSERT
    // ─────────────────────────────────────────────────────────────
    if (action === 'upsert') {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) {
        return NextResponse.json({ data: [], error: null });
      }

      const columns = Object.keys(records[0]).filter((k) => /^[a-zA-Z0-9_]+$/.test(k));
      const conflictCols = (conflict || 'id').split(',').map((c: string) => c.trim()).filter((c: string) => /^[a-zA-Z0-9_]+$/.test(c));

      const updateCols = columns.filter((col) => !conflictCols.includes(col));
      const updateClause = updateCols.length > 0
        ? `DO UPDATE SET ${updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`
        : 'DO NOTHING';

      const params: any[] = [];
      let pIdx = 1;
      const valuesRows: string[] = [];

      for (const rec of records) {
        const rowPlaceholders: string[] = [];
        for (const col of columns) {
          rowPlaceholders.push(`$${pIdx++}`);
          params.push(rec[col] !== undefined ? rec[col] : null);
        }
        valuesRows.push(`(${rowPlaceholders.join(', ')})`);
      }

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${valuesRows.join(', ')}
        ON CONFLICT (${conflictCols.join(', ')})
        ${updateClause}
        RETURNING *;
      `;

      const rows = await (sql as any)(query, params);
      return NextResponse.json({
        data: Array.isArray(data) ? rows : (rows[0] || null),
        error: null,
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ data: null, error: { message: msg } }, { status: 500 });
  }
}
