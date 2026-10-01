import { NextResponse } from 'next/server.js';
import { getAllCommunities } from '../../../lib/db.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const communities = getAllCommunities();
    return NextResponse.json(communities);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener comunidades' },
      { status: 500 }
    );
  }
}
