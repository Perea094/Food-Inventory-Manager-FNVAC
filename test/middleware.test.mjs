import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAccess } from '../src/middleware.ts';

describe('Routing & Access Control Rules', () => {
  test('usuario sin sesión debe ser enviado a /login para rutas protegidas', () => {
    assert.deepEqual(evaluateAccess('/', null), { redirect: '/login' });
    assert.deepEqual(evaluateAccess('/rutas', null), { redirect: '/login' });
    assert.deepEqual(evaluateAccess('/excel', null), { redirect: '/login' });
    assert.deepEqual(evaluateAccess('/operador', null), { redirect: '/login' });
  });

  test('rutas públicas permitidas sin sesión', () => {
    assert.deepEqual(evaluateAccess('/login', null), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/auth/login', null), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/auth/logout', null), { allowed: true });
    assert.deepEqual(evaluateAccess('/favicon.ico', null), { allowed: true });
    assert.deepEqual(evaluateAccess('/logo.png', null), { allowed: true });
    assert.deepEqual(evaluateAccess('/_next/static/test.js', null), { allowed: true });
  });

  test('rutas de API protegidas sin sesión devuelven status 401', () => {
    assert.deepEqual(evaluateAccess('/api/inventory', null), { status: 401 });
    assert.deepEqual(evaluateAccess('/api/routes', null), { status: 401 });
    assert.deepEqual(evaluateAccess('/api/users', null), { status: 401 });
  });

  test('/recepcion debe redirigir siempre a /operador independientemente del rol o sesión', () => {
    assert.deepEqual(evaluateAccess('/recepcion', null), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/recepcion', { role: 'admin' }), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/recepcion', { role: 'operator' }), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/recepcion/nueva', null), { redirect: '/operador' });
  });

  test('operador intentando ver / o /rutas o /excel debe ser redirigido a /operador', () => {
    const opSession = { userId: 'op1', role: 'operator' };
    assert.deepEqual(evaluateAccess('/', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/rutas', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/excel', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/operador', opSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/operador/historial', opSession), { allowed: true });
  });

  test('operador tiene acceso a endpoints de inventario y productos pero no a otras rutas de administración', () => {
    const opSession = { userId: 'op1', role: 'operator' };
    assert.deepEqual(evaluateAccess('/api/inventory', opSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/inventory/batch-1', opSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/products', opSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/users', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/api/routes', opSession), { redirect: '/operador' });
  });

  test('admin tiene acceso permitido a todas las rutas', () => {
    const adminSession = { userId: 'admin1', role: 'admin' };
    assert.deepEqual(evaluateAccess('/', adminSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/rutas', adminSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/excel', adminSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/operador', adminSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/inventory', adminSession), { allowed: true });
    assert.deepEqual(evaluateAccess('/api/users', adminSession), { allowed: true });
  });

  test('usuario autenticado en /login redirige según su rol', () => {
    assert.deepEqual(evaluateAccess('/login', { role: 'admin' }), { redirect: '/' });
    assert.deepEqual(evaluateAccess('/login', { role: 'operator' }), { redirect: '/operador' });
  });

  test('middleware no debe importar módulos nativos incompatibles con Edge Runtime', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const middlewareContent = fs.readFileSync(path.resolve('src/middleware.ts'), 'utf8');
    assert.ok(!middlewareContent.includes("from 'node:crypto'"), 'No debe importar node:crypto');
    assert.ok(!middlewareContent.includes("from 'crypto'"), 'No debe importar crypto');
    assert.ok(middlewareContent.includes("from './lib/session.ts'"), 'Debe importar desde lib/session.ts');
  });

  test('Navbar.tsx debe ocultarse en la página de /login', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const navbarContent = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf8');
    assert.ok(navbarContent.includes("pathname === '/login'"), 'Navbar debe verificar pathname === /login');
    assert.ok(navbarContent.includes("return null;"), 'Navbar debe retornar null en /login');
  });
});
