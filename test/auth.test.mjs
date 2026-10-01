import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  getSessionFromRequest,
  SESSION_COOKIE_NAME
} from '../src/lib/auth.ts';

describe('Auth Utilities: Hashing & Session Tokens', () => {
  test('debe hashear y verificar contraseñas correctamente', () => {
    const password = 'miContraseñaSegura123';
    const { hash, salt } = hashPassword(password);
    assert.ok(hash);
    assert.ok(salt);
    assert.ok(verifyPassword(password, hash, salt));
    assert.ok(!verifyPassword('contraseñaErronea', hash, salt));
  });

  test('debe crear y verificar tokens de sesión firmados', () => {
    const userPayload = {
      userId: 'usr_1',
      username: 'admin',
      name: 'Administrador CEDIS',
      role: 'admin'
    };

    const token = createSessionToken(userPayload);
    assert.ok(token);

    const decoded = verifySessionToken(token);
    assert.ok(decoded);
    assert.equal(decoded.userId, 'usr_1');
    assert.equal(decoded.role, 'admin');

    // Validación de getSessionFromRequest
    const reqWithCookie = new Request('http://localhost:3000/api/protected', {
      headers: { cookie: `test=123; ${SESSION_COOKIE_NAME}=${token}; other=abc` }
    });
    const sessionFromReq = getSessionFromRequest(reqWithCookie);
    assert.ok(sessionFromReq);
    assert.equal(sessionFromReq.userId, 'usr_1');

    const reqWithoutCookie = new Request('http://localhost:3000/api/protected');
    assert.equal(getSessionFromRequest(reqWithoutCookie), null);
  });

  test('debe rechazar tokens manipulados o expirados', () => {
    const userPayload = {
      userId: 'usr_1',
      username: 'admin',
      name: 'Administrador',
      role: 'admin'
    };
    const token = createSessionToken(userPayload);
    const tampered = token.slice(0, -5) + 'abcde';
    assert.equal(verifySessionToken(tampered), null);

    const expiredToken = createSessionToken(userPayload, -1);
    assert.equal(verifySessionToken(expiredToken), null);

    assert.equal(verifySessionToken(''), null);
    assert.equal(verifySessionToken('invalid.token.format'), null);
    assert.equal(verifySessionToken('invalidsignature'), null);
  });
});
