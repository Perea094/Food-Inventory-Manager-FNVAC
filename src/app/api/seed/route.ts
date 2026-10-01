import { NextResponse } from 'next/server.js';
import { seedDatabase } from '../../../lib/seed.ts';
import { getDb } from '../../../lib/db.ts';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = seedDatabase(getDb());
    return NextResponse.json({
      success: true,
      message: 'Datos semilla cargados exitosamente',
      details: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al ejecutar carga de datos semilla' },
      { status: 500 }
    );
  }
}
