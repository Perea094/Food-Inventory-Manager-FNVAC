import { NextResponse } from 'next/server.js';
import { getBatchById, updateBatch, deleteBatch } from '../../../../lib/db.ts';
import { calculateDaysRemaining, getFEFOStatus } from '../../../../lib/fefo.ts';
import { getSessionFromRequest } from '../../../../lib/auth.ts';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const existing = getBatchById(id);

    if (!existing) {
      return NextResponse.json(
        { error: `No se encontró el lote con ID "${id}"` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updates: {
      currentQuantity?: number;
      lotCode?: string;
      expirationDate?: string;
      productId?: string;
    } = {};

    if (body.currentQuantity !== undefined) {
      const qty = Number(body.currentQuantity);
      if (isNaN(qty) || qty < 0) {
        return NextResponse.json(
          { error: 'La cantidad actual debe ser un número mayor o igual a 0' },
          { status: 400 }
        );
      }
      updates.currentQuantity = qty;
    }

    if (body.lotCode !== undefined) {
      updates.lotCode = String(body.lotCode).trim();
    }

    if (body.expirationDate !== undefined) {
      const d = new Date(body.expirationDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: 'Formato de fecha de caducidad inválido' },
          { status: 400 }
        );
      }
      updates.expirationDate = String(body.expirationDate).trim();
    }

    if (body.productId !== undefined) {
      updates.productId = String(body.productId).trim();
    }

    updateBatch(id, updates);

    const updated = getBatchById(id)!;
    const daysRemaining = calculateDaysRemaining(updated.expirationDate);
    const status = getFEFOStatus(daysRemaining, updated.currentQuantity);

    return NextResponse.json({
      ...updated,
      daysRemaining,
      status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el lote' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const existing = getBatchById(id);

    if (!existing) {
      return NextResponse.json(
        { error: `No se encontró el lote con ID "${id}"` },
        { status: 404 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role === 'operator' && existing.createdBy !== session.userId) {
      return NextResponse.json(
        { error: 'No tienes permiso para deshacer registros creados por otro operador o administrador.' },
        { status: 403 }
      );
    }

    const deleted = deleteBatch(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'No se pudo eliminar el lote' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lote eliminado exitosamente',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el lote' },
      { status: 500 }
    );
  }
}
