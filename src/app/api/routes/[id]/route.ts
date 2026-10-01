import { NextResponse } from 'next/server.js';
import { getRouteById, undoRouteDispatchTransaction } from '../../../../lib/db.ts';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const route = getRouteById(id);

    if (!route) {
      return NextResponse.json(
        { error: `Ruta de despacho con ID "${id}" no encontrada.` },
        { status: 404 }
      );
    }

    return NextResponse.json(route);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener la ruta de despacho' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const existing = getRouteById(id);

    if (!existing) {
      return NextResponse.json(
        { error: `Ruta de despacho con ID "${id}" no encontrada.` },
        { status: 404 }
      );
    }

    const result = undoRouteDispatchTransaction(id);
    return NextResponse.json({
      success: true,
      message: `Ruta ${result.routeCode} deshecha con éxito. Se reincorporaron ${result.restoredUnits} unidades al inventario.`,
      routeCode: result.routeCode,
      restoredUnits: result.restoredUnits,
      restoredItemsCount: result.restoredItemsCount,
    });
  } catch (error: any) {
    const status = error.message?.includes('no encontrada') ? 404 : 400;
    return NextResponse.json(
      { error: error.message || 'Error al deshacer la ruta de despacho' },
      { status }
    );
  }
}
