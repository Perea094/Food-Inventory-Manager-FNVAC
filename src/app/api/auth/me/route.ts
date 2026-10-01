import { NextResponse } from 'next/server.js';
import { getSessionFromRequest } from '../../../../lib/auth.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { user: session },
    { status: 200 }
  );
}
