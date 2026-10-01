import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { getDb, listUsers, findUserByUsername, createUser } from '../../../lib/db.ts';
import { getSessionFromRequest, hashPassword } from '../../../lib/auth.ts';
import type { User, UserRole } from '../../../types/index';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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

    const users = listUsers(getDb());
    return NextResponse.json({ users }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const { name, username, password, role } = body || {};

    if (!name || !username || !password || !role) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios: name, username, password, role' },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'operator') {
      return NextResponse.json(
        { error: 'Rol inválido. Los roles válidos son "admin" y "operator"' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    const db = getDb();
    const existing = findUserByUsername(db, cleanUsername);
    if (existing) {
      return NextResponse.json(
        { error: `El nombre de usuario "${cleanUsername}" ya existe` },
        { status: 409 }
      );
    }

    const { hash, salt } = hashPassword(password);
    const newUser: User = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      passwordHash: hash,
      salt,
      name: String(name).trim(),
      role: role as UserRole,
      createdAt: new Date().toISOString(),
    };

    createUser(db, newUser);

    return NextResponse.json(
      {
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al crear usuario' },
      { status: 500 }
    );
  }
}
