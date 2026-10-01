import { NextResponse } from 'next/server.js';
import { getAllProducts, getAllBatches, getAllRoutes } from '../../../../lib/db.ts';
import { generateInventoryWorkbook } from '../../../../lib/excel.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = getAllProducts();
    const batches = getAllBatches();
    const routes = getAllRoutes();

    const buffer = generateInventoryWorkbook(products, batches, routes);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="inventario_fnvac_celaya.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al exportar inventario a Excel' },
      { status: 500 }
    );
  }
}
