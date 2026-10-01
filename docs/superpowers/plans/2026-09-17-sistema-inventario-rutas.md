# Plan de Implementación: MVP de Inventario FEFO y Rutas Logísticas (FNVAC)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desarrollar e implementar la plataforma web completa para Fundación Nutrición y Vida A.C. (CEDIS Celaya) que reemplace el flujo de Excel por control de inventario con códigos de barras, semáforo FEFO estricto, ruteo asistido por proximidad y mapa interactivo, con interoperabilidad Excel bidireccional.

**Architecture:** Next.js 14+ con App Router, TypeScript y Tailwind CSS. Persistencia en SQLite local (`node:sqlite` nativo en Node 24 sin dependencias binarias externas) para operación rápida y resiliente en bodega. Leaflet + React-Leaflet con OpenStreetMap para geolocalización y trazado de rutas desde CEDIS Celaya. `html5-qrcode` para escaneo de cámara web/móvil más escucha nativa para lectores USB/Bluetooth. `xlsx` (SheetJS) para importación/exportación de libros de trabajo.

**Tech Stack:** Next.js 14+, React 18/19, TypeScript, Tailwind CSS, Lucide React, SQLite (`node:sqlite`), Leaflet, `html5-qrcode`, `xlsx`, Node Test Runner.

---

### Task 1: Configuración del Proyecto Base, Dependencias y Tipos Globales

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `src/types/index.ts`

- [x] **Step 1: Crear `package.json` con scripts y dependencias requeridas**
- [x] **Step 2: Configurar TypeScript, Tailwind CSS y Next.js**
- [x] **Step 3: Definir interfaces y tipos TypeScript en `src/types/index.ts`**
- [x] **Step 4: Ejecutar instalación de dependencias y verificar compilación base**
- [x] **Step 5: Commit de la estructura base**

---

### Task 2: Capa de Base de Datos SQLite, Migraciones y Seed Data

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/schema.sql`
- Create: `src/lib/seed.ts`
- Test: `test/db.test.mjs`

- [x] **Step 1: Crear `test/db.test.mjs` para validar inicialización y operaciones CRUD**
- [x] **Step 2: Crear `src/lib/schema.sql`**
- [x] **Step 3: Implementar `src/lib/db.ts` usando `node:sqlite`**
- [x] **Step 4: Implementar `src/lib/seed.ts` con datos representativos de Celaya y FNVAC**
- [x] **Step 5: Ejecutar test y script de seed**
- [x] **Step 6: Commit de base de datos y seed data**

---

### Task 3: Lógica de Dominio: Cálculo FEFO, Ruteo Haversine y Procesamiento Excel

**Files:**
- Create: `src/lib/fefo.ts`
- Create: `src/lib/routing.ts`
- Create: `src/lib/excel.ts`
- Test: `test/fefo.test.mjs`
- Test: `test/routing.test.mjs`
- Test: `test/excel.test.mjs`

- [x] **Step 1: Escribir pruebas unitarias en `test/fefo.test.mjs` y desarrollar `src/lib/fefo.ts`**
- [x] **Step 2: Escribir pruebas unitarias en `test/routing.test.mjs` y desarrollar `src/lib/routing.ts`**
- [x] **Step 3: Escribir pruebas unitarias en `test/excel.test.mjs` y desarrollar `src/lib/excel.ts`**
- [x] **Step 4: Ejecutar todas las pruebas unitarias y verificar éxito**
- [x] **Step 5: Commit de módulos de lógica de negocio**

---

### Task 4: Endpoints de API REST (Backend Interno)

**Files:**
- Create: `src/app/api/products/route.ts`
- Create: `src/app/api/inventory/route.ts`
- Create: `src/app/api/inventory/[id]/route.ts`
- Create: `src/app/api/routes/route.ts`
- Create: `src/app/api/communities/route.ts`
- Create: `src/app/api/excel/export/route.ts`
- Create: `src/app/api/excel/import/route.ts`
- Create: `src/app/api/excel/template/route.ts`
- Create: `src/app/api/seed/route.ts`
- Test: `test/api.test.mjs`

- [x] **Step 1: Implementar endpoints de Catálogo e Inventario**
- [x] **Step 2: Implementar endpoints de Comunidades y Ruteo**
- [x] **Step 3: Implementar endpoints de Excel y Seed**
- [x] **Step 4: Ejecutar pruebas de API**
- [x] **Step 5: Commit de capa de endpoints API**

---

### Task 5: Componentes de UI Compartidos y Layout Principal

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/components/Navbar.tsx`
- Create: `src/components/KPICard.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/Modal.tsx`

- [x] **Step 1: Configurar estilos globales y fuentes en `src/app/globals.css`**
- [x] **Step 2: Diseñar `src/components/Navbar.tsx` y `src/app/layout.tsx`**
- [x] **Step 3: Desarrollar componentes reusables (`KPICard`, `StatusBadge`, `Modal`)**
- [x] **Step 4: Commit de componentes de interfaz y layout**

---

### Task 6: Tablero de Control de Inventario y Semáforo FEFO

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/InventoryTable.tsx`
- Create: `src/components/InventoryFilters.tsx`

- [x] **Step 1: Desarrollar tarjetas de KPI en el Dashboard**
- [x] **Step 2: Construir `InventoryTable.tsx`**
- [x] **Step 3: Desarrollar `InventoryFilters.tsx`**
- [x] **Step 4: Commit de tablero de inventario FEFO**

---

### Task 7: Módulo de Recepción y Escáner de Código de Barras

**Files:**
- Create: `src/app/recepcion/page.tsx`
- Create: `src/components/BarcodeScanner.tsx`
- Create: `src/components/QuickProductModal.tsx`

- [x] **Step 1: Desarrollar `BarcodeScanner.tsx` con soporte dual (lector físico continuo + cámara con html5-qrcode)**
- [x] **Step 2: Implementar formulario de recepción con atajos de fecha y advertencia de producto caducado**
- [x] **Step 3: Implementar `QuickProductModal.tsx`**
- [x] **Step 4: Commit del módulo de escaneo y recepción**

---

### Task 8: Planificador Inteligente de Rutas Logísticas y Mapa Interactivo

**Files:**
- Create: `src/app/rutas/page.tsx`
- Create: `src/components/MapRouteView.tsx`
- Create: `src/components/DriverManifestModal.tsx`

- [x] **Step 1: Desarrollar asistente de carga crítica FEFO con sugerencia de Torton Thermo King**
- [x] **Step 2: Integrar mapa interactivo Leaflet en `MapRouteView.tsx` con CEDIS Celaya y paradas numeradas**
- [x] **Step 3: Diseñar `DriverManifestModal.tsx` (Hoja de Ruta de Chofer)**
- [x] **Step 4: Conectar botón "Confirmar y Despachar" para descuento de stock en tiempo real**
- [x] **Step 5: Commit del planificador de rutas y mapa Leaflet**

---

### Task 9: Módulo de Interoperabilidad con Excel (Importación y Exportación)

**Files:**
- Create: `src/app/excel/page.tsx`
- Create: `src/components/ExcelDropzone.tsx`

- [x] **Step 1: Desarrollar vista de descarga de reportes Excel multi-hoja y plantilla oficial**
- [x] **Step 2: Desarrollar `ExcelDropzone.tsx` para importación masiva con previsualización**
- [x] **Step 3: Commit del módulo de importación y exportación Excel**

---

### Task 10: Pruebas E2E, Validación Integral y Toques Finales

**Files:**
- Create: `test/e2e-workflow.test.mjs`
- Modify: `src/app/page.tsx`
- Modify: `README.md`

- [ ] **Step 1: Ejecutar suite de pruebas automatizadas completa**
- [ ] **Step 2: Revisión visual, accesibilidad y toques finales**
- [ ] **Step 3: Commit final y reporte de entrega**
