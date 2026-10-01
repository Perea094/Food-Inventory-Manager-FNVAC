import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, createUser, getDb } from '../src/lib/db.ts';
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/lib/auth.ts';
import { GET as getInventory, POST as postInventory } from '../src/app/api/inventory/route.ts';
import { DELETE as deleteBatchHandler } from '../src/app/api/inventory/[id]/route.ts';

describe('Inventory RBAC & Batch Ownership', () => {
  before(() => {
    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO products (id, barcode, name, donorType, category, unit, storageArea, minStock)
      VALUES ('prod_1', '750100019999', 'Arroz RBAC', 'Supermercado', 'SECO_ABARROTE', 'kg', 'Nave_Secos', 10);
    `).run();
    db.prepare("DELETE FROM inventory_batches WHERE productId = 'prod_1'").run();
  });

  test('un lote debe registrar el userId en createdBy', () => {
    const db = createDatabase(':memory:');
    createUser(db, {
      id: 'usr_op_1',
      username: 'op1',
      passwordHash: 'hash',
      salt: 'salt',
      name: 'Operador 1',
      role: 'operator'
    });

    db.prepare(`
      INSERT INTO products (id, barcode, name, donorType, category, unit, storageArea, minStock)
      VALUES ('p1', '75010001', 'Arroz', 'Supermercado', 'Granos', 'kg', 'Bodega_Seca', 10);
    `).run();

    db.prepare(`
      INSERT INTO inventory_batches (id, productId, lotCode, expirationDate, currentQuantity, createdBy)
      VALUES ('b1', 'p1', 'LOT-01', '2026-10-10', 50, 'usr_op_1');
    `).run();

    const batch = db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get('b1');
    assert.equal(batch.createdBy, 'usr_op_1');
  });

  test('validación de permisos: operador solo puede borrar sus propios lotes', () => {
    const canDeleteBatch = (user, batch) => {
      if (user.role === 'admin') return true;
      if (user.role === 'operator' && batch.createdBy === user.id) return true;
      return false;
    };

    const admin = { id: 'admin_1', role: 'admin' };
    const op1 = { id: 'op_1', role: 'operator' };
    const op2 = { id: 'op_2', role: 'operator' };

    const batchOp1 = { id: 'b1', createdBy: 'op_1' };

    assert.equal(canDeleteBatch(admin, batchOp1), true);
    assert.equal(canDeleteBatch(op1, batchOp1), true);
    assert.equal(canDeleteBatch(op2, batchOp1), false);
  });

  test('POST /api/inventory debe guardar el createdBy proveniente de la sesión de autenticación', async () => {
    const sessionUser = {
      userId: 'op_turno_1',
      username: 'operador_turno',
      name: 'Operador Turno',
      role: 'operator',
    };
    const token = createSessionToken(sessionUser);

    const req = new Request('http://localhost:3000/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        productId: 'prod_1',
        lotCode: 'LOT-SHIFT-101',
        expirationDate: '2026-12-31',
        currentQuantity: 25,
      }),
    });

    const res = await postInventory(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.createdBy, 'op_turno_1');
  });

  test('GET /api/inventory?myShift=true debe filtrar solo los lotes del operador logueado', async () => {
    const sessionUser = {
      userId: 'op_turno_1',
      username: 'operador_turno',
      name: 'Operador Turno',
      role: 'operator',
    };
    const token = createSessionToken(sessionUser);

    const req = new Request('http://localhost:3000/api/inventory?myShift=true', {
      headers: {
        'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await getInventory(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.batches));
    assert.ok(data.batches.length > 0);
    for (const b of data.batches) {
      assert.equal(b.createdBy, 'op_turno_1');
    }
  });

  test('DELETE /api/inventory/[id] debe responder 403 Forbidden si un operador intenta borrar el lote de otro', async () => {
    // Creamos lote con admin
    const adminSession = {
      userId: 'admin_master',
      username: 'admin',
      name: 'Admin',
      role: 'admin',
    };
    const adminToken = createSessionToken(adminSession);
    const postReq = new Request('http://localhost:3000/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        productId: 'prod_1',
        lotCode: 'LOT-ADMIN-ONLY',
        expirationDate: '2026-12-31',
        currentQuantity: 10,
      }),
    });
    const postRes = await postInventory(postReq);
    const batch = await postRes.json();

    // Intentar borrarlo con operador
    const opSession = {
      userId: 'op_turno_2',
      username: 'operador2',
      name: 'Operador 2',
      role: 'operator',
    };
    const opToken = createSessionToken(opSession);
    const deleteReq = new Request(`http://localhost:3000/api/inventory/${batch.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': `${SESSION_COOKIE_NAME}=${opToken}`,
      },
    });

    const deleteRes = await deleteBatchHandler(deleteReq, { params: { id: batch.id } });
    assert.equal(deleteRes.status, 403);
    const errData = await deleteRes.json();
    assert.match(errData.error, /No tienes permiso/);

    // Administrador sí debe poder borrarlo
    const adminDeleteReq = new Request(`http://localhost:3000/api/inventory/${batch.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
    });
    const adminDeleteRes = await deleteBatchHandler(adminDeleteReq, { params: { id: batch.id } });
    assert.equal(adminDeleteRes.status, 200);
  });
});
