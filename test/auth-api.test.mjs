import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, findUserByUsername, listUsers, createUser } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME } from '../src/lib/auth.ts';
import { POST as loginHandler } from '../src/app/api/auth/login/route.ts';
import { POST as logoutHandler } from '../src/app/api/auth/logout/route.ts';
import { GET as meHandler } from '../src/app/api/auth/me/route.ts';
import { GET as getUsersHandler, POST as createUserHandler } from '../src/app/api/users/route.ts';
import { DELETE as deleteUserHandler } from '../src/app/api/users/[id]/route.ts';

describe('Auth & User Seeding Integration', () => {
  test('seedDatabase debe sembrar los usuarios admin y operador con contraseñas válidas', () => {
    const db = createDatabase(':memory:');
    seedDatabase(db);

    const admin = findUserByUsername(db, 'admin');
    assert.ok(admin, 'admin user should exist');
    assert.equal(admin.role, 'admin');
    assert.ok(verifyPassword('admin123', admin.passwordHash, admin.salt));

    const operador = findUserByUsername(db, 'operador');
    assert.ok(operador, 'operador user should exist');
    assert.equal(operador.role, 'operator');
    assert.ok(verifyPassword('operador123', operador.passwordHash, operador.salt));
  });

  test('POST /api/auth/login valida credenciales y emite cookie', async () => {
    // Test login success & failure
    const badReq = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    const badRes = await loginHandler(badReq);
    assert.equal(badRes.status, 401);

    const goodReq = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const goodRes = await loginHandler(goodReq);
    assert.equal(goodRes.status, 200);
    const data = await goodRes.json();
    assert.equal(data.user.username, 'admin');
    assert.equal(data.redirectTo, '/');
    const setCookie = goodRes.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes(SESSION_COOKIE_NAME));
  });

  test('POST /api/auth/logout limpia la cookie', async () => {
    const res = await logoutHandler(new Request('http://localhost:3000/api/auth/logout', { method: 'POST' }));
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && (setCookie.includes('Max-Age=0') || setCookie.includes('expires=')));
  });

  test('GET /api/auth/me devuelve la sesión activa o 401', async () => {
    const anonReq = new Request('http://localhost:3000/api/auth/me');
    const anonRes = await meHandler(anonReq);
    assert.equal(anonRes.status, 401);

    const token = createSessionToken({
      userId: 'usr_test_1',
      username: 'operador',
      name: 'Operador Celaya',
      role: 'operator'
    });
    const authReq = new Request('http://localhost:3000/api/auth/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` }
    });
    const authRes = await meHandler(authReq);
    assert.equal(authRes.status, 200);
    const body = await authRes.json();
    assert.equal(body.user.username, 'operador');
    assert.equal(body.user.role, 'operator');
  });

  test('CRUD /api/users restringe a admin y gestiona operadores', async () => {
    const opToken = createSessionToken({ userId: 'op_1', username: 'op', name: 'Op', role: 'operator' });
    const adminToken = createSessionToken({ userId: 'admin_1', username: 'admin', name: 'Admin', role: 'admin' });

    // Operator cannot access GET /api/users
    const forbiddenRes = await getUsersHandler(new Request('http://localhost:3000/api/users', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${opToken}` }
    }));
    assert.equal(forbiddenRes.status, 403);

    // Admin can access GET /api/users
    const okRes = await getUsersHandler(new Request('http://localhost:3000/api/users', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` }
    }));
    assert.equal(okRes.status, 200);

    // Admin creates new operator
    const createReq = new Request('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`
      },
      body: JSON.stringify({
        name: 'Maria Almacen',
        username: 'maria_op',
        password: 'password123',
        role: 'operator'
      })
    });
    const createRes = await createUserHandler(createReq);
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.user.username, 'maria_op');

    // Admin deletes operator
    const delRes = await deleteUserHandler(
      new Request('http://localhost:3000/api/users/' + createData.user.id, {
        method: 'DELETE',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` }
      }),
      { params: { id: createData.user.id } }
    );
    assert.equal(delRes.status, 200);
  });
});
