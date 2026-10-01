import { NextResponse } from 'next/server.js';
import { getDb, findUserByUsername } from '../../../../lib/db.ts';
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME } from '../../../../lib/auth.ts';
import { seedDatabase } from '../../../../lib/seed.ts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const { username, password } = body || {};
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const cleanUsername = username.trim();
    const db = getDb();
    let user = findUserByUsername(db, cleanUsername);

    // If default users are not yet seeded or have system placeholders, seed them
    if (!user || user.passwordHash === 'system_hash') {
      seedDatabase(db);
      user = findUserByUsername(db, cleanUsername);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const sessionPayload = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };

    const token = createSessionToken(sessionPayload);
    const redirectTo = user.role === 'admin' ? '/' : '/operador';

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
        redirectTo,
      },
      { status: 200 }
    );

    response.headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
