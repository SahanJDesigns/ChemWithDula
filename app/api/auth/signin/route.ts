import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { comparePassword, signToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query user
    const [user] = await sql`
      SELECT id, email, password_hash, full_name, role, phone, created_at
      FROM users
      WHERE email = ${cleanEmail}
      LIMIT 1;
    `;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Query profile
    let [profile] = await sql`
      SELECT id, full_name, role, phone, created_at
      FROM profiles
      WHERE id = ${user.id}
      LIMIT 1;
    `;

    if (!profile) {
      // Auto-heal profile if missing
      [profile] = await sql`
        INSERT INTO profiles (id, full_name, role, phone)
        VALUES (${user.id}, ${user.full_name}, ${user.role}, ${user.phone || ''})
        RETURNING id, full_name, role, phone, created_at;
      `;
    }

    // Sign session token
    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
      profile,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Sign in failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
