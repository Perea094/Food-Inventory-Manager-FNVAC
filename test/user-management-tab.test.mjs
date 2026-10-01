import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('User Management Tab & Excel Integration', () => {
  test('UserManagementTab.tsx debe existir y contener lógica de listado y creación', () => {
    const componentPath = path.join(rootDir, 'src', 'components', 'UserManagementTab.tsx');
    assert.ok(fs.existsSync(componentPath), 'UserManagementTab.tsx must exist');
    const content = fs.readFileSync(componentPath, 'utf8');

    assert.ok(content.includes('/api/users'), 'Debe consumir el endpoint /api/users');
    assert.ok(content.includes('Registrar Nuevo Operador') || content.includes('Nuevo Operador'), 'Debe incluir botón de registro');
    assert.ok(content.includes("role === 'admin'") || content.includes('role === \'admin\''), 'Debe proteger la cuenta de admin contra eliminación accidental');
  });

  test('src/app/excel/page.tsx debe integrar la pestaña de Gestión de Personal / Operadores', () => {
    const pagePath = path.join(rootDir, 'src', 'app', 'excel', 'page.tsx');
    assert.ok(fs.existsSync(pagePath), 'excel/page.tsx must exist');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('UserManagementTab'), 'Debe importar o renderizar UserManagementTab');
    assert.ok(content.includes('/api/auth/me'), 'Debe verificar la sesión de usuario');
  });
});
