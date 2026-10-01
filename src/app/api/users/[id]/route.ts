import { NextResponse } from 'next/server.js';
import { getDb, getUserById, deleteUser } from '../../../../lib/db.ts';
import { getSessionFromRequest } from '../../../../lib/auth.ts';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado: se requieren permisos de administrador' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const id = params?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    const db = getDb();
    const targetUser = getUserById(db, id);
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (targetUser.username === 'admin' || targetUser.id === session.userId) {
      return NextResponse.json(
        { error: 'No se puede eliminar el usuario administrador principal ni su propia cuenta' },
        { status: 400 }
      );
    }

    const deleted = deleteUser(db, id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'No se pudo eliminar el usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Usuario eliminado exitosamente' },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
}
