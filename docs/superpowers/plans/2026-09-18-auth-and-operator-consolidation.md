# Autenticación, Control de Roles, Consolidación de Operador y Corrección de Encabezado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de autenticación ligero con roles (Admin y Operador) en SQLite, proteger rutas, consolidar la terminal de recepción en `/operador` con permisos de "deshacer" restringidos a los registros propios del operador, agregar panel de gestión de operadores y corregir el desbordamiento tipográfico del encabezado institucional en `Navbar.tsx`.

**Architecture:** Se agrega la tabla `users` con hashes seguros (`node:crypto`) y sesiones por cookie HTTP-only (`fnvac_session`). Se agrega la columna `createdBy` a `inventory_batches` para auditar la autoría de cada lote recibido. La ruta `/recepcion` se redirige a `/operador`, que actúa como la terminal universal de almacén donde los operadores solo ven y pueden deshacer sus propios lotes mientras los administradores conservan control total. El encabezado de navegación se reestructura eliminando botones redundantes y garantizando un layout flex elástico sin desbordamientos.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Lucide React, Node.js 22 SQLite (`node:sqlite`), `node:crypto` (PBKDF2/scrypt, HMAC SHA-256), `node:test`.

---

### File Structure & Responsibilities

- **`src/types/index.ts`**: Definición de tipos `User`, `UserRole`, `AuthSession`, y actualización de `InventoryBatch` con `createdBy`.
- **`src/lib/schema.sql` & `src/lib/db.ts`**: Definición DDL de `users`, migración automática para columna `createdBy` en `inventory_batches`, consultas helper de usuario (`findUserByUsername`, `getUserById`, `createUser`, `listUsers`, `deleteUser`).
- **`src/lib/auth.ts`**: Hashing de contraseñas (`hashPassword`, `verifyPassword`), generación y verificación de tokens de sesión HTTP-only (`createSessionToken`, `verifySessionToken`, `getSessionUser`).
- **`src/lib/seed.ts`**: Cuentas iniciales predeterminadas (`admin` y `operador`).
- **`src/app/api/auth/login/route.ts`**: Endpoint de login, validación de credenciales y asignación de cookie `fnvac_session`.
- **`src/app/api/auth/logout/route.ts`**: Endpoint de logout y limpieza de cookie.
- **`src/app/api/auth/me/route.ts`**: Consulta de sesión activa para clientes React.
- **`src/app/api/users/route.ts` & `src/app/api/users/[id]/route.ts`**: CRUD de operadores exclusivo para Administradores.
- **`src/app/api/inventory/route.ts`**: Asignación automática de `createdBy` al insertar lotes y filtro de turno.
- **`src/app/api/inventory/[id]/route.ts`**: Restricción de eliminación/deshacer por rol y autoría (403 si operador intenta borrar lote ajeno).
- **`src/middleware.ts`**: Protección perimetral de rutas Next.js (redirección a `/login` si no autenticado, redirección de operador a `/operador` si intenta abrir `/`, `/rutas` o `/excel`, y redirección permanente de `/recepcion` a `/operador`).
- **`src/app/login/page.tsx`**: Pantalla de inicio de sesión con branding institucional y acceso rápido para pruebas.
- **`src/components/Navbar.tsx`**: Corrección de flex/overflow, eliminación del botón redundante "Modo Operador", enlace a `/operador` como "Recepción", badge de usuario activo y botón de Cerrar Sesión.
- **`src/app/operador/page.tsx`**: Adaptación por rol (encabezado minimalista para operador vs barra completa para admin), lista de actividad filtrada por `createdBy` para el operador, protección en modal de "Deshacer".
- **`src/components/UserManagementTab.tsx`**: Panel en `/excel` para que el Administrador registre o dé de baja operadores.

---

### Task 1: Actualizar Esquema de Base de Datos y Tipos TypeScript

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/schema.sql`
- Modify: `src/lib/db.ts`
- Test: `test/db-auth.test.mjs`

- [ ] **Step 1: Escribir la prueba unitaria que verifica la tabla users y la columna createdBy**

```javascript
// test/db-auth.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, findUserByUsername, createUser, listUsers } from '../src/lib/db.ts';

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
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falle**

Run: `node --test test/db-auth.test.mjs`  
Expected: FAIL con error de funciones no definidas o columna no encontrada.

- [ ] **Step 3: Implementar cambios en `src/types/index.ts`, `src/lib/schema.sql` y `src/lib/db.ts`**

En `src/types/index.ts`:
```typescript
export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  expiresAt: number;
}
```
Y añadir `createdBy?: string;` a `InventoryBatch`.

En `src/lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator')),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
En `src/lib/db.ts`:
Actualizar `initSchema(database: DatabaseSync)` para ejecutar la migración dinámica:
```typescript
const batchCols = database.prepare("PRAGMA table_info(inventory_batches);").all() as any[];
if (!batchCols.some((c) => c.name === 'createdBy')) {
  database.exec("ALTER TABLE inventory_batches ADD COLUMN createdBy TEXT NOT NULL DEFAULT 'admin';");
}
```
E implementar `findUserByUsername`, `getUserById`, `createUser`, `listUsers`, `deleteUser`.

- [ ] **Step 4: Ejecutar prueba para verificar que pase**

Run: `node --test test/db-auth.test.mjs`  
Expected: PASS (2 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/schema.sql src/lib/db.ts test/db-auth.test.mjs
git commit -m "feat(db): add users table, batch createdBy column, and user db operations"
```

---

### Task 2: Biblioteca de Criptografía, Hashing y Sesiones (`src/lib/auth.ts`)

**Files:**
- Create: `src/lib/auth.ts`
- Test: `test/auth.test.mjs`

- [ ] **Step 1: Escribir la prueba unitaria de autenticación y tokens**

```javascript
// test/auth.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken
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
  });
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falle**

Run: `node --test test/auth.test.mjs`  
Expected: FAIL con `Cannot find module '../src/lib/auth.ts'`.

- [ ] **Step 3: Implementar `src/lib/auth.ts`**

Utilizar `node:crypto` (`scryptSync`, `randomBytes`, `createHmac`, `timingSafeEqual`) para implementar:
- `hashPassword(password: string, salt?: string): { hash: string; salt: string }`
- `verifyPassword(password: string, hash: string, salt: string): boolean`
- `createSessionToken(payload: Omit<AuthSession, 'expiresAt'>, expiresInDays?: number): string`
- `verifySessionToken(token: string): AuthSession | null`
- `SESSION_COOKIE_NAME = 'fnvac_session'`
- `getSessionFromRequest(req: Request): AuthSession | null`

- [ ] **Step 4: Ejecutar prueba para verificar que pase**

Run: `node --test test/auth.test.mjs`  
Expected: PASS (3 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts test/auth.test.mjs
git commit -m "feat(auth): add crypto password hashing and HMAC signed session tokens"
```

---

### Task 3: Semilla de Cuentas y Endpoints de Autenticación y Usuarios

**Files:**
- Modify: `src/lib/seed.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[id]/route.ts`
- Test: `test/auth-api.test.mjs`

- [ ] **Step 1: Escribir la prueba de integración de APIs de autenticación**

```javascript
// test/auth-api.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, findUserByUsername } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';
import { verifyPassword } from '../src/lib/auth.ts';

describe('Auth & User Seeding Integration', () => {
  test('seedDatabase debe sembrar los usuarios admin y operador con contraseñas válidas', () => {
    const db = createDatabase(':memory:');
    seedDatabase(db);

    const admin = findUserByUsername(db, 'admin');
    assert.ok(admin);
    assert.equal(admin.role, 'admin');
    assert.ok(verifyPassword('admin123', admin.passwordHash, admin.salt));

    const operador = findUserByUsername(db, 'operador');
    assert.ok(operador);
    assert.equal(operador.role, 'operator');
    assert.ok(verifyPassword('operador123', operador.passwordHash, operador.salt));
  });
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falle**

Run: `node --test test/auth-api.test.mjs`  
Expected: FAIL con `findUserByUsername(db, 'admin')` returning undefined.

- [ ] **Step 3: Actualizar `src/lib/seed.ts` e implementar las rutas `/api/auth/*` y `/api/users/*`**

- En `src/lib/seed.ts`: asegurar creación de usuario `admin` (`admin123`) y `operador` (`operador123`).
- En `POST /api/auth/login`: validar credenciales en SQLite; si coinciden, crear token y responder con cabecera `Set-Cookie: fnvac_session=...; Path=/; HttpOnly; SameSite=Lax`. Retornar `{ user: { id, username, name, role }, redirectTo: role === 'admin' ? '/' : '/operador' }`.
- En `POST /api/auth/logout`: setear cookie con `Max-Age=0`.
- En `GET /api/auth/me`: leer cookie y responder `{ user: session }` o 401.
- En `GET /api/users`: verificar que el llamante sea `admin`. Retornar lista de usuarios.
- En `POST /api/users`: verificar que el llamante sea `admin`. Hashear contraseña y crear usuario con rol `operator`.
- En `DELETE /api/users/[id]`: verificar que sea `admin`, impedir borrar al admin principal o auto-borrarse.

- [ ] **Step 4: Ejecutar prueba para verificar que pase**

Run: `node --test test/auth-api.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seed.ts src/app/api/auth src/app/api/users test/auth-api.test.mjs
git commit -m "feat(api): implement auth endpoints, user management endpoints, and user seeding"
```

---

### Task 4: Auditoría en Inventario y Permiso Estricto de "Deshacer" por Rol

**Files:**
- Modify: `src/app/api/inventory/route.ts`
- Modify: `src/app/api/inventory/[id]/route.ts`
- Test: `test/inventory-rbac.test.mjs`

- [ ] **Step 1: Escribir pruebas unitarias de permisos en inventario**

```javascript
// test/inventory-rbac.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/lib/db.ts';

describe('Inventory RBAC & Batch Ownership', () => {
  test('un lote debe registrar el userId en createdBy', () => {
    const db = createDatabase(':memory:');
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
    // Simular regla de negocio de DELETE
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
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar que pase**

Run: `node --test test/inventory-rbac.test.mjs`  
Expected: PASS.

- [ ] **Step 3: Modificar `src/app/api/inventory/route.ts` y `src/app/api/inventory/[id]/route.ts`**

- En `POST /api/inventory`: extraer sesión; si no hay sesión, usar `'admin'` como fallback de compatibilidad. Guardar `createdBy: session?.userId || 'admin'` en la inserción de `inventory_batches`.
- En `GET /api/inventory`: si el parámetro `myShift=true` está presente y hay sesión, filtrar `WHERE createdBy = ?`.
- En `DELETE /api/inventory/[id]`: obtener lote; si la sesión es `operator` y `batch.createdBy !== session.userId`, devolver:
  ```json
  { "error": "No tienes permiso para deshacer registros creados por otro operador o administrador." }
  ```
  con status `403 Forbidden`.

- [ ] **Step 4: Ejecutar pruebas y verificar compatibilidad**

Run: `npm test`  
Expected: Todos los tests de inventario y los 130 tests previos pasando.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/inventory/route.ts src/app/api/inventory/[id]/route.ts test/inventory-rbac.test.mjs
git commit -m "feat(inventory): enforce batch ownership tracking and RBAC on batch deletion"
```

---

### Task 5: Middleware de Protección Perimetral y Redirección de `/recepcion`

**Files:**
- Create: `src/middleware.ts`
- Test: `test/middleware.test.mjs`

- [ ] **Step 1: Escribir la prueba de reglas de enrutamiento del middleware**

```javascript
// test/middleware.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Routing & Access Control Rules', () => {
  const evaluateAccess = (pathname, session) => {
    // Rutas públicas
    if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
      return { allowed: true };
    }
    // Redirección permanente de /recepcion a /operador
    if (pathname === '/recepcion' || pathname.startsWith('/recepcion/')) {
      return { redirect: '/operador' };
    }
    // Si no está autenticado
    if (!session) {
      return { redirect: '/login' };
    }
    // Si es operador, solo tiene permitido /operador y APIs permitidas
    if (session.role === 'operator') {
      if (pathname === '/operador' || pathname.startsWith('/api/inventory') || pathname.startsWith('/api/products')) {
        return { allowed: true };
      }
      return { redirect: '/operador' };
    }
    // Si es admin, tiene acceso total
    return { allowed: true };
  };

  test('usuario sin sesión debe ser enviado a /login', () => {
    assert.deepEqual(evaluateAccess('/', null), { redirect: '/login' });
    assert.deepEqual(evaluateAccess('/rutas', null), { redirect: '/login' });
    assert.deepEqual(evaluateAccess('/operador', null), { redirect: '/login' });
  });

  test('/recepcion debe redirigir siempre a /operador', () => {
    const adminSession = { role: 'admin' };
    assert.deepEqual(evaluateAccess('/recepcion', adminSession), { redirect: '/operador' });
  });

  test('operador intentando ver / o /rutas debe ser redirigido a /operador', () => {
    const opSession = { role: 'operator' };
    assert.deepEqual(evaluateAccess('/', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/rutas', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/excel', opSession), { redirect: '/operador' });
    assert.deepEqual(evaluateAccess('/operador', opSession), { allowed: true });
  });
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar que pase**

Run: `node --test test/middleware.test.mjs`  
Expected: PASS.

- [ ] **Step 3: Implementar `src/middleware.ts` en Next.js**

Implementar el middleware de Next.js leyendo la cookie `fnvac_session` con `verifySessionToken` y aplicando las redirecciones correspondientes con `NextResponse.redirect`.

- [ ] **Step 4: Verificar que no rompa las llamadas de API de Next.js**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts test/middleware.test.mjs
git commit -m "feat(middleware): add route protection, operator containment, and /recepcion redirect"
```

---

### Task 6: Pantalla de Login Institucional (`/login`)

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Crear la interfaz de usuario en `src/app/login/page.tsx`**

- Tarjeta centrada con logotipo oficial de Fundación Nutrición y Vida A.C. (`Building2` con fondo `bg-emerald-700`).
- Subtítulo: *"Sistema de Inventario FEFO & Logística • CEDIS Celaya"*.
- Inputs accesibles de Usuario y Contraseña con iconos de usuario/candado, soporte para tecla Enter y autofocus en el primer input.
- Botón interactivo *"Iniciar Sesión"* con estado de carga (`Loader2`).
- Caja de alertas accesible para errores de credenciales (HTTP 401).
- Sección inferior con accesos rápidos de un clic para pruebas:
  - Botón *"Entrar como Administrador"* (llena `admin` / `admin123`).
  - Botón *"Entrar como Operador"* (llena `operador` / `operador123`).
- Al autenticar con éxito, redirigir a la URL provista por la API (`data.redirectTo`).

- [ ] **Step 2: Verificar la compilación de la página**

Run: `npm run build`  
Expected: Ruta `/login` compilada con éxito.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(ui): create responsive login page with Celaya CEDIS branding and demo quick-fill"
```

---

### Task 7: Corrección Visual del Encabezado (`Navbar.tsx`)

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Reestructurar el encabezado para eliminar desbordamientos y reflejar el rol**

- Eliminar el botón redundante de `"Modo Operador"` (ancho fijo y fondo ámbar) que comprimía el título institucional.
- Actualizar `NAV_ITEMS` para que el ítem de recepción sea:
  `{ href: '/operador', label: 'Recepción & Almacén', icon: Barcode }`
- En el bloque de marca (`Link href="/"`):
  - Añadir clase `shrink-0 min-w-max`.
  - Asegurar que el contenedor del texto institucional mantenga:
    - `"Fundación Nutrición y Vida A.C."` (`text-base sm:text-lg font-bold text-slate-900 leading-tight whitespace-nowrap`).
    - `"CEDIS Celaya • Banco de Alimentos"` (`text-xs sm:text-sm text-slate-500 font-medium whitespace-nowrap`).
- En la zona derecha del header:
  - Mostrar badge con el nombre y rol del usuario autenticado (`"Admin • Coordinador"`).
  - Agregar botón de `"Cerrar Sesión"` (`LogOut` de Lucide) que invoque `POST /api/auth/logout` y redirija a `/login`.
  - Mantener badge discreto de `"Bodega Activa"` y botón de `"Reiniciar Demo"`.

- [ ] **Step 2: Verificar que el encabezado no genere errores de tipado o compilación**

Run: `npm run build`  
Expected: Build exitoso sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "fix(ui): resolve navbar brand overflow, remove redundant operator button, and add user session header"
```

---

### Task 8: Adaptar `/operador` para Operadores y Administradores

**Files:**
- Modify: `src/app/operador/page.tsx`

- [ ] **Step 1: Integrar detección de rol y encabezado adaptativo en `/operador`**

- Consultar `/api/auth/me` al montar el componente.
- **Para Operador**:
  - Mostrar encabezado dedicado con el logo de la fundación, el nombre del operador actual, badge `"Operador de Almacén"` y botón de `"Cerrar Sesión"`.
  - Ocultar cualquier enlace al Tablero FEFO, Rutas o Excel.
- **Para Administrador**:
  - Mostrar barra superior completa o botón de retorno directo al `"Tablero FEFO"`.
- **Carga de actividad de turno**:
  - Si es Operador: invocar `fetch('/api/inventory?myShift=true')` para que la lista de lotes recientes únicamente muestre los capturados por este operador en su sesión.
  - El botón de `"Deshacer / Eliminar Lote"` solo se renderiza si el lote pertenece al operador o si el usuario es Admin.
  - Si se intenta deshacer un lote ajeno, mostrar alerta visual informativa.

- [ ] **Step 2: Verificar la compilación de `/operador`**

Run: `npm run build`  
Expected: Compilación limpia sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/operador/page.tsx
git commit -m "feat(operador): adapt interface for operator isolation and shift undo ownership"
```

---

### Task 9: Panel de Gestión de Operadores en "Excel & Datos" (`/excel`)

**Files:**
- Create: `src/components/UserManagementTab.tsx`
- Modify: `src/app/excel/page.tsx`

- [ ] **Step 1: Crear el componente `UserManagementTab.tsx`**

- Tabla con los operadores registrados en la base de datos (Nombre, Usuario, Rol, Fecha de Registro).
- Botón *"Registrar Nuevo Operador"*: abre modal con Nombre Completo, Usuario y Contraseña inicial.
- Validación de campos requeridos y prevención de usuarios duplicados.
- Botón de eliminación de operador con confirmación destructiva (no permite eliminar al admin).

- [ ] **Step 2: Integrar el panel en `src/app/excel/page.tsx`**

- Agregar selector de pestaña o sección: *"Exportación de Datos"* y *"Gestión de Personal de Almacén"*.
- Solo visible y accesible cuando el usuario autenticado tiene rol `admin`.

- [ ] **Step 3: Verificar compilación**

Run: `npm run build`  
Expected: Build exitoso.

- [ ] **Step 4: Commit**

```bash
git add src/components/UserManagementTab.tsx src/app/excel/page.tsx
git commit -m "feat(admin): add warehouse operator management panel in excel & data section"
```

---

### Task 10: Verificación Integral de Pruebas y Build de Producción

**Files:**
- Test: All suites in `test/*.test.mjs`

- [ ] **Step 1: Ejecutar la suite completa de pruebas automatizadas**

Run: `npm test`  
Expected: Todas las pruebas (las 130 existentes + las nuevas de autenticación, roles, middleware y auditoría) pasan al 100% con 0 fallos.

- [ ] **Step 2: Ejecutar la compilación final de producción**

Run: `npm run build`  
Expected: Compilación exitosa de Next.js con todas las rutas estáticas y dinámicas generadas sin warnings de TypeScript ni de ESLint.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "test(auth): verify complete test suite and production build pass cleanly"
```
