# Especificación de Diseño: Autenticación, Control de Roles, Consolidación de Operador y Corrección de Encabezado

**Fecha:** 2026-09-18  
**Proyecto:** Food-Inventory-Manager-FNVAC — Sistema FEFO y Logística (CEDIS Celaya)  
**Estado:** Validado con el usuario  

---

## 1. Contexto y Objetivos

Durante la operación continua del sistema de inventario y logística en el CEDIS Celaya de Fundación Nutrición y Vida A.C., se identificaron tres áreas críticas de mejora:

1. **Desbordamiento Visual en Encabezado (`Navbar.tsx`)**: La acumulación de enlaces y un botón prominente de "Modo Operador" en la barra de navegación comprimían el espacio asignado a la marca institucional, provocando que el texto `"Fundación Nutrición y Vida A.C. CEDIS Celaya • Banco de Alimentos"` se dividiera en 4 líneas y truncara `"Alimentos"` contra el límite inferior del encabezado de altura fija.
2. **Duplicidad Funcional entre `/recepcion` y `/operador`**: Ambas interfaces ofrecían prácticamente el mismo flujo operativo (búsqueda de producto por código de barras, cámara web, atajos de perecederos, creación rápida de productos y resolución de colisiones por lote duplicado), fragmentando el código y la experiencia de usuario.
3. **Ausencia de Control de Acceso y Auditoría**: Cualquier usuario en la red local podía acceder a todas las secciones (FEFO, Rutas, Excel) y alterar o eliminar lotes sin distinción de responsabilidades entre coordinadores y personal de almacén/voluntarios.

**Metas del cambio**:
- Resolver el desbordamiento tipográfico en el encabezado de navegación.
- Consolidar `/recepcion` en `/operador` como la única terminal táctil de entrada a almacén.
- Implementar un sistema de autenticación ligero y seguro en SQLite con roles `admin` y `operator`.
- Proteger rutas para que el Operador solo acceda a su terminal y únicamente pueda deshacer/eliminar los lotes capturados por él mismo durante su turno.
- Proporcionar al Administrador un panel sencillo para gestionar operadores.

---

## 2. Arquitectura y Modelo de Datos (SQLite)

### 2.1 Nueva Tabla: `users`
Se integrará en `src/lib/schema.sql` y `src/lib/db.ts`:

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

### 2.2 Actualización de Tabla: `inventory_batches`
Se añade la columna `createdBy` con referencia al usuario que registró el lote:

```sql
ALTER TABLE inventory_batches ADD COLUMN createdBy TEXT NOT NULL DEFAULT 'admin' REFERENCES users(id);
```
*(Para bases de datos nuevas, se incluye directamente en la definición del schema. Para bases de datos existentes, la función de inicialización `initSchema` verificará y aplicará la migración sin pérdida de datos).*

### 2.3 Semilla de Cuentas Predeterminadas
Al inicializar la base de datos o ejecutar el reinicio de demo (`/api/seed`), se asegurará la existencia de:
- **Admin**:
  - `username`: `admin`
  - `name`: `Coordinador CEDIS Celaya`
  - `password`: `admin123`
  - `role`: `admin`
- **Operador**:
  - `username`: `operador`
  - `name`: `Operador de Almacén`
  - `password`: `operador123`
  - `role`: `operator`

---

## 3. Autenticación y Sesiones

### 3.1 Cifrado Criptográfico Nativo
Se utilizará el módulo nativo `node:crypto` de Node.js (`crypto.scryptSync` o `crypto.pbkdf2Sync`) con sales aleatorias criptográficamente seguras (`crypto.randomBytes(16)`) para almacenar hashes robustos sin dependencias externas innecesarias.

### 3.2 Manejo de Sesiones
- **Mecanismo**: Cookie HTTP-only llamada `fnvac_session`.
- **Contenido**: Token firmado criptográficamente (HMAC-SHA256) con expiración de 7 días, conteniendo:
  - `userId`: Identificador del usuario.
  - `username`: Nombre de usuario.
  - `name`: Nombre para mostrar.
  - `role`: `'admin' | 'operator'`.
- **Seguridad**: Atributos `HttpOnly`, `SameSite=Lax`, `Path=/`, y `Secure` si se ejecuta en HTTPS.

### 3.3 Endpoints de Autenticación (`/api/auth/*`)
- `POST /api/auth/login`:
  - Recibe `{ username, password }`.
  - Valida credenciales contra la tabla `users`.
  - Configura la cookie `fnvac_session`.
  - Devuelve datos del usuario y ruta de redirección (`/` para admin, `/operador` para operator).
- `POST /api/auth/logout`:
  - Limpia la cookie `fnvac_session`.
  - Devuelve confirmación para redirigir a `/login`.
- `GET /api/auth/me`:
  - Lee la cookie de sesión y devuelve el usuario autenticado actual o 401 si no hay sesión válida.

### 3.4 Gestión de Operadores para el Administrador (`/api/users/*`)
- `GET /api/users`: Lista de usuarios (excluyendo hashes/sales). Solo accesible para `admin`.
- `POST /api/users`: Crea un nuevo operador (`name`, `username`, `password`, `role: 'operator'`). Solo accesible para `admin`.
- `DELETE /api/users/[id]`: Elimina un operador (no permite auto-eliminarse ni eliminar al admin principal). Solo accesible para `admin`.

---

## 4. Flujo de Navegación y Protección de Rutas

### 4.1 Pantalla de Login (`/login`)
- Diseño limpio, profesional y accesible, adaptado a la identidad visual de Fundación Nutrición y Vida A.C. (verde esmeralda y tonos ámbar).
- Formulario directo con usuario y contraseña, soporte para Enter, mensajes de error claros y botón de acceso rápido con credenciales de prueba para evaluación en CEDIS.

### 4.2 Control de Rutas y Redirecciones
- **No autenticado**: Cualquier intento de visitar rutas protegidas (`/`, `/operador`, `/rutas`, `/excel`) redirige a `/login`.
- **Operador autenticado**:
  - Al iniciar sesión entra a `/operador`.
  - Si intenta acceder a `/`, `/rutas` o `/excel`, es redirigido automáticamente a `/operador`.
  - No ve el menú superior con pestañas administrativas; en su lugar, `/operador` muestra un encabezado minimalista con su nombre, badge `"Operador de Almacén"` y botón `"Cerrar Sesión"`.
- **Administrador autenticado**:
  - Al iniciar sesión entra a `/` (Tablero FEFO).
  - Tiene acceso a todas las rutas y a la barra de navegación completa.
  - Desde el menú administrativo, el enlace de recepción apunta a `/operador`.
  - En `/operador`, el Administrador cuenta con un botón para regresar al Tablero FEFO y acceso al control total de edición y eliminación.
- **Ruta `/recepcion`**: Redirige permanentemente a `/operador` mediante Next.js redirect.

---

## 5. Auditoría de Inventario y Permisos de "Deshacer"

### 5.1 Registro de Lotes (`POST /api/inventory`)
- La API extrae la identidad del usuario desde la sesión `fnvac_session`.
- El lote insertado en `inventory_batches` guarda `createdBy: session.userId`.

### 5.2 Consulta de Turno en `/operador` (`GET /api/inventory?myShift=true` o por sesión)
- Cuando un **Operador** carga su terminal, la lista de "Registros de Este Turno" solo muestra los lotes donde `createdBy === session.userId`.
- Cuando un **Administrador** ingresa a `/operador`, puede alternar entre ver "Mis Registros" o "Todos los Registros del CEDIS".

### 5.3 Eliminación y "Deshacer" (`DELETE /api/inventory/[id]`)
- **Regla de autorización**:
  - Si `session.role === 'admin'`: Se permite eliminar o deshacer el lote (previa validación de si está asignado a rutas activas).
  - Si `session.role === 'operator'`: Se valida estrictamente que `batch.createdBy === session.userId`. Si el lote pertenece a otro usuario o administrador, la API responde `403 Forbidden` con el mensaje: `"No tienes permiso para deshacer registros creados por otro usuario."`

---

## 6. Corrección del Encabezado (`Navbar.tsx`)

### 6.1 Correcciones de Maquetación
- Remover el botón redundante y ancho de "Modo Operador" que sobrecargaba la barra superior.
- Reemplazar el enlace `/recepcion` por `"Recepción"` apuntando a `/operador`.
- Asignar `shrink-0` y ancho mínimo al bloque de marca institucional.
- Mantener `"Fundación Nutrición y Vida A.C."` y `"CEDIS Celaya • Banco de Alimentos"` en sus proporciones exactas con interlineado controlado (`leading-tight`), impidiendo que el texto se rompa en más de 2 líneas y evitando que el contenedor corte `"Alimentos"`.
- Incluir en el extremo derecho el perfil del usuario actual (`"Admin - Coordinador"`) junto con el botón de `"Cerrar Sesión"`.

---

## 7. Panel de Gestión de Usuarios en "Excel & Datos" (`/excel`)

- Se agrega una pestaña/sección dedicada: **"Gestión de Personal y Operadores"**.
- Permite al Administrador:
  - Visualizar la tabla de operadores registrados con nombre, usuario y fecha de alta.
  - Registrar nuevos operadores con formulario emergente validado.
  - Restablecer contraseñas de operadores o desactivar cuentas.

---

## 8. Plan de Pruebas y Validación

1. **Pruebas Automatizadas (`node --test`)**:
   - `test/auth.test.mjs`: Creación de usuarios, hashing de contraseñas, login válido, login inválido, emisión y expiración de tokens de sesión.
   - `test/operator-permissions.test.mjs`: Restricción de permisos; verificar que un operador no pueda eliminar lotes de otros usuarios (HTTP 403) y que solo pueda deshacer los propios.
   - `test/routes-protection.test.mjs`: Verificar que rutas administrativas rechacen o redirijan solicitudes de operadores.
   - Ejecutar la suite completa (`npm test`) para garantizar que los 130 tests existentes sigan pasando al 100%.
2. **Verificación Visual y de Producción**:
   - Compilación exitosa con `npm run build`.
   - Inspección en navegador de la barra de navegación para confirmar que `"Fundación Nutrición y Vida A.C. CEDIS Celaya • Banco de Alimentos"` no se desborda ni se corta.
   - Verificación del flujo de login, redirecciones y cierre de sesión para ambos perfiles.
