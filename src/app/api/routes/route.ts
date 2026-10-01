import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { getAllRoutes, getRouteById, dispatchRouteTransaction } from '../../../lib/db.ts';
import type { DispatchRouteInput, ItemToDeduct } from '../../../lib/db.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const routes = getAllRoutes();
    return NextResponse.json(routes);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener las rutas de despacho' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vehicleType, driverName, stops, dispatchedItems, totalDistanceKm, routeCode } = body;

    if (!vehicleType || !driverName || !stops || !dispatchedItems) {
      return NextResponse.json(
        { error: 'Campos requeridos faltantes: vehicleType, driverName, stops, dispatchedItems' },
        { status: 400 }
      );
    }

    if (!Array.isArray(dispatchedItems) || dispatchedItems.length === 0) {
      return NextResponse.json(
        { error: 'La ruta debe contener al menos un producto a despachar en dispatchedItems' },
        { status: 400 }
      );
    }

    const generatedCode =
      routeCode || `RUT-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const itemsToDeduct: ItemToDeduct[] = dispatchedItems.map((item: any) => {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Cantidad inválida para el lote ${item.batchId}: ${item.quantity}`);
      }
      return {
        batchId: item.batchId,
        quantity: qty,
      };
    });

    const routeData: DispatchRouteInput = {
      id: crypto.randomUUID(),
      routeCode: generatedCode,
      createdAt: new Date().toISOString(),
      vehicleType: String(vehicleType),
      driverName: String(driverName),
      status: 'En_Transito',
      totalDistanceKm: Number(totalDistanceKm || 0),
      stops: typeof stops === 'string' ? stops : JSON.stringify(stops),
      dispatchedItems: typeof dispatchedItems === 'string' ? dispatchedItems : JSON.stringify(dispatchedItems),
    };

    const { routeId } = dispatchRouteTransaction(routeData, itemsToDeduct);
    const createdRoute = getRouteById(routeId);

    return NextResponse.json(createdRoute, { status: 201 });
  } catch (error: any) {
    // Insufficient inventory or validation errors
    return NextResponse.json(
      { error: error.message || 'Error al crear la ruta de despacho' },
      { status: 400 }
    );
  }
}
