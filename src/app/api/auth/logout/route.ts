import { NextResponse } from 'next/server.js';
import { SESSION_COOKIE_NAME } from '../../../../lib/auth.ts';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json(
    { success: true, message: 'Sesión finalizada exitosamente' },
    { status: 200 }
  );

  response.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );

  return response;
}
