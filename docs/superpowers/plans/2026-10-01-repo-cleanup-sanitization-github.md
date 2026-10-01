# Plan de Implementación: Sanitización de Datos, Limpieza y Preparación para GitHub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar del repositorio todo dato personal, información clasificada/institucional y archivos obsoletos, asegurando que la base de datos y cachés no se rastreen en Git, y dejar el proyecto 100% probado, documentado y listo para ser publicado en un repositorio público de GitHub bajo la rama `main`.

**Architecture:** Se realiza una auditoría y saneamiento por capas: (1) eliminación y gitignore de artefactos de compilación (`tsconfig.tsbuildinfo`) y archivos de base de datos SQLite persistente (`data/*.db*`); (2) anonimización de nombres reales, teléfonos, credenciales y referencias privadas en código fuente (`seed.ts`, `seed.mjs`, `page.tsx`, `UserManagementTab.tsx`), pruebas y documentación (`README.md`, `CONTEXTO_PROYECTO.md`, `specs`); (3) configuración de `.env.example`, actualización de `.gitignore` y adición de licencia MIT; (4) consolidación de pruebas y rutas API pendientes con verificación de 173 pruebas y compilación Next.js; y (5) purga del historial de Git para remover permanentemente los archivos PDF confidenciales (`Documentos_info/`) antes del primer push a GitHub.

**Tech Stack:** Next.js 14+ (App Router), TypeScript 5.6, Tailwind CSS, SQLite (`node:sqlite`), Node.js Test Runner (`node:test`), Git.

---

### Task 1: Limpieza de artefactos de compilación, archivos temporales y desvinculación de SQLite

**Files:**
- Delete: `tsconfig.tsbuildinfo`
- Delete: `docs/handoff.md`
- Delete: `docs/superpowers/plans/2026-09-17-task-7-barcode-scanner.md`
- Git Remove: `data/nutricion_vida.db`
- Git Remove: `Documentos_info/`
- Git Remove: `FUNDACION_NUTRICION_Y_VIDA.md`

- [ ] **Step 1: Eliminar artefactos de compilación y notas temporales del disco**

Ejecutar en PowerShell:
```powershell
Remove-Item -Force -ErrorAction SilentlyContinue "tsconfig.tsbuildinfo"
Remove-Item -Force -ErrorAction SilentlyContinue "docs/handoff.md"
Remove-Item -Force -ErrorAction SilentlyContinue "docs/superpowers/plans/2026-09-17-task-7-barcode-scanner.md"
Remove-Item -Force -ErrorAction SilentlyContinue "data/nutricion_vida.db-shm"
Remove-Item -Force -ErrorAction SilentlyContinue "data/nutricion_vida.db-wal"
```

- [ ] **Step 2: Remover archivos de base de datos SQLite y PDFs del índice de Git sin borrar la base de datos de desarrollo**

Ejecutar:
```powershell
git rm --cached -f "data/nutricion_vida.db"
git rm -r --cached -f "Documentos_info"
git rm -f "FUNDACION_NUTRICION_Y_VIDA.md"
```

- [ ] **Step 3: Verificar que los archivos obsoletos ya no estén rastreados**

Ejecutar:
```powershell
git status --porcelain
```
Expected: `data/nutricion_vida.db` y `Documentos_info` aparecen marcados con `D ` en el índice de Git (staged deletions), y no aparecen en `git ls-files data/`.

---

### Task 2: Configuración de `.gitignore`, `.env.example` y variables de sesión

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `src/lib/session.ts:5-15`
- Create: `LICENSE`

- [ ] **Step 1: Actualizar `.gitignore` con exclusiones estrictas de bases de datos, cachés y secretos**

Reemplazar el contenido de `.gitignore` con:
```gitignore
# dependencies
/node_modules
/.pnp
.pnp.js

# testing & coverage
/coverage

# next.js build outputs
/.next/
/out/
/build

# typescript build cache
*.tsbuildinfo
next-env.d.ts

# local databases (SQLite runtime data)
/data/*.db
/data/*.db-shm
/data/*.db-wal
/data/*.sqlite
/data/*.sqlite-shm
/data/*.sqlite-wal

# environment and secrets
.env
.env*.local
.env.development
.env.production
.env.test

# debug and logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# os & ide files
.DS_Store
Thumbs.db
.vscode/
.idea/
*.pem

# vercel
.vercel
```

- [ ] **Step 2: Crear `.env.example` para documentar la configuración requerida**

Crear el archivo `.env.example` con el siguiente contenido:
```bash
# =============================================================================
# Food-Inventory-Manager-FNVAC - Variables de Entorno
# =============================================================================

# Clave secreta para firma criptográfica HMAC de sesiones de autenticación
# Generar una clave segura aleatoria en producción (ej. `openssl rand -hex 32`)
AUTH_SECRET=fnvac-secret-key-cedis-celaya-2026-dev-only

# Puerto del servidor web (por defecto: 3000)
PORT=3000

# Host de enlace (opcional, ej. 0.0.0.0 o localhost)
HOSTNAME=0.0.0.0
```

- [ ] **Step 3: Fortalecer `src/lib/session.ts` para respetar `AUTH_SECRET` con advertencia en producción**

Modificar las líneas 5 a 12 de `src/lib/session.ts` para que use:
```typescript
export const SESSION_COOKIE_NAME = 'fnvac_session';

const DEV_AUTH_SECRET_FALLBACK = 'fnvac-dev-secret-key-change-in-production-2026';

export function getAuthSecret(): string {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[ADVERTENCIA DE SEGURIDAD] AUTH_SECRET no está configurado en las variables de entorno. Utilizando clave por defecto no apta para producción.'
    );
  }
  return DEV_AUTH_SECRET_FALLBACK;
}
```

- [ ] **Step 4: Crear archivo de licencia abierta `LICENSE` (Licencia MIT)**

Crear `LICENSE` en la raíz del proyecto:
```text
MIT License

Copyright (c) 2026 Fundación Nutrición y Vida A.C. & Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Verificar que `.env.example` y `LICENSE` existen y que `.gitignore` excluye `.tsbuildinfo` y `.db`**

Ejecutar:
```powershell
git status --porcelain
```
Expected: `LICENSE` y `.env.example` aparecen como archivos untracked (`??`), `.gitignore` modificado (`M`), y ningún `.tsbuildinfo` ni `.db-shm` aparece.

---

### Task 3: Sanitización de datos personales y credenciales en código fuente y datos semilla

**Files:**
- Modify: `src/lib/seed.ts:253-335`
- Modify: `src/lib/seed.mjs:253-335`
- Modify: `src/app/rutas/page.tsx:30-40`
- Modify: `src/components/UserManagementTab.tsx:400-405`
- Modify: `test/e2e-workflow.test.mjs:125-136`

- [ ] **Step 1: Anonimizar nombres de representantes y estandarizar teléfonos de prueba en `src/lib/seed.ts`**

En `src/lib/seed.ts`, actualizar el arreglo `SEED_COMMUNITIES`:
```typescript
export const SEED_COMMUNITIES: Community[] = [
  {
    id: 'comm-001',
    name: 'San Juan de la Vega',
    municipality: 'Celaya',
    latitude: 20.6278,
    longitude: -100.7634,
    representativeName: 'Representante Comunitario San Juan',
    phone: '461-000-0101',
    beneficiariesCount: 420,
  },
  {
    id: 'comm-002',
    name: 'Rincón de Tamayo',
    municipality: 'Celaya',
    latitude: 20.4283,
    longitude: -100.7512,
    representativeName: 'Representante Comunitario Tamayo',
    phone: '461-000-0102',
    beneficiariesCount: 380,
  },
  {
    id: 'comm-003',
    name: 'San Miguel Octopan',
    municipality: 'Celaya',
    latitude: 20.5897,
    longitude: -100.7381,
    representativeName: 'Representante Comunitario Octopan',
    phone: '461-000-0103',
    beneficiariesCount: 510,
  },
  {
    id: 'comm-004',
    name: 'Juan Martín',
    municipality: 'Celaya',
    latitude: 20.4731,
    longitude: -100.825,
    representativeName: 'Representante Comunitario Juan Martín',
    phone: '461-000-0104',
    beneficiariesCount: 290,
  },
  {
    id: 'comm-005',
    name: 'Comonfort Centro',
    municipality: 'Comonfort',
    latitude: 20.7225,
    longitude: -100.76,
    representativeName: 'Representante Comunitario Comonfort',
    phone: '412-000-0105',
    beneficiariesCount: 620,
  },
  {
    id: 'comm-006',
    name: 'Apaseo el Grande Centro',
    municipality: 'Apaseo el Grande',
    latitude: 20.5447,
    longitude: -100.6861,
    representativeName: 'Representante Comunitario Apaseo',
    phone: '413-000-0106',
    beneficiariesCount: 470,
  },
  {
    id: 'comm-007',
    name: 'Cortazar Centro',
    municipality: 'Cortazar',
    latitude: 20.4819,
    longitude: -100.9633,
    representativeName: 'Representante Comunitario Cortazar',
    phone: '411-000-0107',
    beneficiariesCount: 530,
  },
  {
    id: 'comm-008',
    name: 'Villagrán Centro',
    municipality: 'Villagrán',
    latitude: 20.5147,
    longitude: -100.9989,
    representativeName: 'Representante Comunitario Villagrán',
    phone: '411-000-0108',
    beneficiariesCount: 360,
  },
];
```

- [ ] **Step 2: Replicar los cambios sanitizados en `src/lib/seed.mjs`**

Actualizar `SEED_COMMUNITIES` en `src/lib/seed.mjs` con los mismos datos genéricos y teléfonos estructurados (`461-000-0101` a `411-000-0108`).

- [ ] **Step 3: Sanitizar nombre de chofer por defecto en `src/app/rutas/page.tsx`**

En `src/app/rutas/page.tsx`, sustituir:
```typescript
const [driverName, setDriverName] = useState('Jesús Morales Estrada');
```
por:
```typescript
const [driverName, setDriverName] = useState('Operador de Transporte #1');
```

- [ ] **Step 4: Sanitizar placeholder con nombre de persona en `src/components/UserManagementTab.tsx`**

En `src/components/UserManagementTab.tsx` línea 402, sustituir:
```typescript
placeholder="Ej. Pedro González Morales"
```
por:
```typescript
placeholder="Ej. Operador Turno Matutino"
```

- [ ] **Step 5: Sanitizar datos del despacho en `test/e2e-workflow.test.mjs`**

En `test/e2e-workflow.test.mjs` líneas 125 a 136, sustituir:
```javascript
        vehicleType: 'Torton_ThermoKing',
        driverName: 'Operador Don Pedro González',
        stops: [
          {
            communityId: 'comm-1',
            communityName: 'San Juan de la Vega',
            municipality: 'Celaya',
            latitude: 20.6278,
            longitude: -100.7634,
            representativeName: 'Sra. María Elena Vázquez',
            phone: '461-123-4567',
          },
        ],
```
por:
```javascript
        vehicleType: 'Torton_ThermoKing',
        driverName: 'Operador de Transporte #1',
        stops: [
          {
            communityId: 'comm-1',
            communityName: 'San Juan de la Vega',
            municipality: 'Celaya',
            latitude: 20.6278,
            longitude: -100.7634,
            representativeName: 'Representante Comunitario San Juan',
            phone: '461-000-0101',
          },
        ],
```

- [ ] **Step 6: Re-sembrar la base de datos local y verificar pruebas**

Ejecutar:
```powershell
npm run seed
npm test
```
Expected: `npm run seed` ejecuta exitosamente y `npm test` finaliza con 173 pruebas pasadas (0 fallos).

---

### Task 4: Sanitización de documentación (`README.md`, `CONTEXTO_PROYECTO.md` y especificaciones)

**Files:**
- Modify: `README.md`
- Modify: `CONTEXTO_PROYECTO.md`
- Modify: `docs/FUNDACION_NUTRICION_Y_VIDA.md` (o eliminar si se consolida)
- Modify: `docs/superpowers/specs/2026-09-17-sistema-inventario-rutas-design.md`

- [ ] **Step 1: Sanitizar `CONTEXTO_PROYECTO.md`**

En `CONTEXTO_PROYECTO.md`:
- Sustituir la sección de integrantes del equipo de estudiantes:
  `**Equipo:** Equipo Kiwi (Diego Perea León, Arely Ramos Tapia, Azul Airam López Tolentino, Enrique Alejandro Noguera Sandoval, Isauro Alejandro Garza Elizondo, Rafaela Patricia Cabrera Lovera, Sofía Lira Becerra)`
  por:
  `**Equipo:** Equipo de Desarrollo de Software • Banco de Alimentos`
- Anonimizar el RFC de la institución (`FNF0401285K0` -> `FNV010101AAA`).
- Sustituir menciones de domicilios privados específicos por la ubicación general institucional: `Celaya, Guanajuato, México`.

- [ ] **Step 2: Sanitizar `docs/superpowers/specs/2026-09-17-sistema-inventario-rutas-design.md`**

En `docs/superpowers/specs/2026-09-17-sistema-inventario-rutas-design.md`:
- Sustituir `**Equipo:** Equipo Kiwi (Diego Perea León et al. - Tecnológico de Monterrey)` por `**Equipo:** Equipo de Desarrollo de Software`.

- [ ] **Step 3: Sanitizar o remover `docs/FUNDACION_NUTRICION_Y_VIDA.md`**

Si se mantiene como documentación de referencia institucional en `docs/`:
- Anonimizar RFC (`FNF0401285K0` -> `FNV010101AAA`), domicilios exactos y nombres personales de liderazgo por referencias institucionales ("Consejo Directivo y Dirección General").
O bien, si no aporta valor adicional a `CONTEXTO_PROYECTO.md`, eliminarlo:
```powershell
Remove-Item -Force "docs/FUNDACION_NUTRICION_Y_VIDA.md"
```

- [ ] **Step 4: Actualizar `README.md` a estándar open-source profesional**

En `README.md`:
- Actualizar badges del encabezado:
  - Cambiar badge de licencia a MIT: `![Licencia](https://img.shields.io/badge/licencia-MIT-blue.svg)`
  - Actualizar badge de pruebas con la cantidad real de pruebas: `![Pruebas](https://img.shields.io/badge/Pruebas-173%2F173%20Pasadas-brightgreen.svg)`
- En sección 4 (Instalación), agregar el paso de copia de variables de entorno:
  ```bash
  cp .env.example .env
  ```
- Explicar las cuentas de demostración preconfiguradas para pruebas y evaluación (`admin` / `admin123`, `operador` / `operador123`).
- En el pie de página (líneas 194-197), reemplazar nombres de equipo escolar por:
  ```markdown
  ---

  **Proyecto:** Food-Inventory-Manager-FNVAC  
  **Organización Socio Formadora:** Fundación Nutrición y Vida, A.C. (FNVAC - CEDIS Celaya)  
  **Licencia:** MIT License
  ```

- [ ] **Step 5: Verificar que no queden nombres personales en todo el repositorio**

Ejecutar búsqueda exhaustiva:
```powershell
git grep -i -E "perea|arely|azul|noguera|garza|cabrera|lira|h[eé]ctor gonz[aá]lez"
```
Expected: Ninguna coincidencia en el código fuente, pruebas ni documentación.

---

### Task 5: Consolidación de archivos de prueba, endpoints y verificación de compilación

**Files:**
- Untracked Test Files (13 archivos en `test/`)
- Untracked Route Files (`src/app/api/routes/[id]/route.ts`, `src/lib/recent-products.ts`)

- [ ] **Step 1: Agregar todas las pruebas y componentes de producción al control de versiones**

Ejecutar:
```powershell
git add src/app/api/routes/[id]/route.ts
git add src/lib/recent-products.ts
git add test/*.test.mjs
```

- [ ] **Step 2: Ejecutar la suite completa de pruebas automatizadas (173 pruebas)**

Ejecutar:
```powershell
npm test
```
Expected:
```
ℹ tests 173
ℹ suites 7
ℹ pass 173
ℹ fail 0
```

- [ ] **Step 3: Ejecutar la compilación de producción para validar TypeScript y empaquetado**

Ejecutar:
```powershell
npm run build
```
Expected: Compilación exitosa (`✓ Compiled successfully`, `Generating static pages (9/9)`, 0 errores de ESLint o TypeScript).

---

### Task 6: Purga del historial Git (eliminación permanente de PDFs y creación de rama `main` limpia)

**Contexto crítico:** Los 4 archivos PDF en `Documentos_info/` y nombres personales fueron introducidos en el commit inicial `d0bd054`. Si solo se borran con `git rm`, quedan almacenados en los objetos de Git y cualquiera que clone el repositorio en GitHub los podrá descargar. Como el repositorio no ha sido subido a ningún remoto (`git remote -v` está vacío), se debe generar un historial limpio y profesional.

**Files:**
- Git Repository History & Branch `main`

- [ ] **Step 1: Crear una rama huérfana limpia `main` sin el historial con PDFs**

Ejecutar en PowerShell:
```powershell
# Crear una rama limpia desconectada del commit con PDFs pesados
git checkout --orphan main
```

- [ ] **Step 2: Asegurar que los archivos excluidos no estén en el stage**

Ejecutar:
```powershell
# Resetear stage para aplicar .gitignore de forma limpia
git reset
git clean -fd "data/nutricion_vida.db*"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "Documentos_info"
Remove-Item -Force -ErrorAction SilentlyContinue "tsconfig.tsbuildinfo"
```

- [ ] **Step 3: Agregar todos los archivos saneados a `main`**

Ejecutar:
```powershell
git add .
git status
```
Expected: Solo aparecen archivos de código fuente, pruebas, documentación saneada, configuración y logo. No aparece ningún archivo `.pdf`, ni `data/*.db*`, ni `tsconfig.tsbuildinfo`.

- [ ] **Step 4: Realizar el commit inicial limpio y profesional para GitHub**

Ejecutar:
```powershell
git commit -m "feat: initial release of FNVAC Warehouse FEFO & Logistic Routing Platform"
```

- [ ] **Step 5: Eliminar ramas locales anteriores que contenían los PDFs**

Ejecutar:
```powershell
git branch -D master
git branch -D feature/sistema-inventario-rutas
# Recolectar basura para purgar objetos desreferenciados de los PDFs
git gc --prune=now --aggressive
```

- [ ] **Step 6: Verificar integridad, tamaño del repositorio y pruebas en la rama `main`**

Ejecutar:
```powershell
git branch
git status
npm test
npm run build
```
Expected:
1. `git branch` muestra únicamente `* main`.
2. `git status` muestra `nothing to commit, working tree clean`.
3. `npm test` pasa 173 de 173 pruebas.
4. `npm run build` compila con éxito en 0 errores.
5. El directorio `.git` se reduce considerablemente al no almacenar los 10MB+ de PDFs.

---

### Task 7: Instrucciones finales para vinculación y subida a GitHub

**Files:**
- Git Remote Configuration

- [ ] **Step 1: Documentar el comando para que el usuario conecte su repositorio remoto en GitHub**

Para subir el repositorio limpio a GitHub:
```powershell
# 1. Crear un nuevo repositorio vacío en GitHub (ej. Food-Inventory-Manager-FNVAC)
# 2. Vincular el remoto origin:
git remote add origin https://github.com/<TU_USUARIO>/Food-Inventory-Manager-FNVAC.git

# 3. Subir la rama principal limpia:
git push -u origin main
```
