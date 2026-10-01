import { NextResponse } from 'next/server.js';
import { getAllVehicles } from '../../../lib/db.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const vehicles = getAllVehicles();
    return NextResponse.json(vehicles);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener vehículos' },
      { status: 500 }
    );
  }
}
