import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-server';

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ user: null, profile: null });
    }

    const [profile] = await sql`
      SELECT id, full_name, role, phone, created_at
      FROM profiles
      WHERE id = ${authUser.id}
      LIMIT 1;
    `;

    return NextResponse.json({
      user: { id: authUser.id, email: authUser.email },
      profile: profile || null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Session error';
    return NextResponse.json({ error: msg, user: null, profile: null }, { status: 500 });
  }
}
