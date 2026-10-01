import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, findUserByUsername, createUser, listUsers, getUserById, deleteUser } from '../src/lib/db.ts';

describe('Database Schema: Users & Batches createdBy', () => {
  test('debe inicializar la tabla users y permitir crear/consultar usuarios', () => {
    const db = createDatabase(':memory:');
    const newUser = {
      id: 'usr_test_1',
      username: 'operador_celaya',
      passwordHash: 'hash_secret',
      salt: 'salt_123',
      name: 'Juan Operador',
      role: 'operator'
    };

    createUser(db, newUser);
    const user = findUserByUsername(db, 'operador_celaya');
    assert.ok(user);
    assert.equal(user.name, 'Juan Operador');
    assert.equal(user.role, 'operator');

    const users = listUsers(db);
    assert.equal(users.length, 1);
    assert.equal(users[0].username, 'operador_celaya');
  });

  test('la tabla inventory_batches debe contener la columna createdBy con valor default', () => {
    const db = createDatabase(':memory:');
    const cols = db.prepare('PRAGMA table_info(inventory_batches);').all();
    const hasCreatedBy = cols.some((c) => c.name === 'createdBy');
    assert.ok(hasCreatedBy, 'inventory_batches debe incluir createdBy');
  });

  test('getUserById y deleteUser funcionan correctamente', () => {
    const db = createDatabase(':memory:');
    const newUser = {
      id: 'usr_test_2',
      username: 'admin_test',
      passwordHash: 'hash_secret',
      salt: 'salt_123',
      name: 'Admin Test',
      role: 'admin'
    };
    createUser(db, newUser);
    const user = getUserById(db, 'usr_test_2');
    assert.ok(user);
    assert.equal(user.username, 'admin_test');

    const deleted = deleteUser(db, 'usr_test_2');
    assert.equal(deleted, true);
    assert.equal(getUserById(db, 'usr_test_2'), undefined);
  });
});
