import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword, signToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, full_name, role, phone = '' } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = role === 'teacher' ? 'teacher' : 'student';

    // Check if user exists
    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail} LIMIT 1;`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    // Insert user into Neon Postgres
    const [newUser] = await sql`
      INSERT INTO users (email, password_hash, full_name, role, phone)
      VALUES (${cleanEmail}, ${passwordHash}, ${full_name.trim()}, ${cleanRole}, ${phone.trim()})
      RETURNING id, email, full_name, role, created_at;
    `;

    // Insert profile
    const [newProfile] = await sql`
      INSERT INTO profiles (id, full_name, role, phone)
      VALUES (${newUser.id}, ${full_name.trim()}, ${cleanRole}, ${phone.trim()})
      RETURNING id, full_name, role, phone, created_at;
    `;

    // Sign session token
    const token = await signToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      full_name: newUser.full_name,
    });

    const response = NextResponse.json({
      user: { id: newUser.id, email: newUser.email },
      profile: newProfile,
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
    const msg = error instanceof Error ? error.message : 'Sign up failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
