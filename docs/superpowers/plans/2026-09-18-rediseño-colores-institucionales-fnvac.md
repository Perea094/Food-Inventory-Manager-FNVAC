# Plan de Implementación: Rediseño Cromático Institucional FNVAC (Azul, Rojo y Blanco)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar toda la interfaz visual de la aplicación web a la identidad cromática oficial de Fundación Nutrición y Vida A.C. (Azul `#136793`, Rojo `#D21E27` y Blanco `#FFFFFF`) e integrar su logotipo oficial, preservando la semántica del semáforo FEFO normativo de seguridad alimentaria.

**Architecture:** Centralización de la paleta en tokens de Tailwind CSS (`fnvac.blue` y `fnvac.red`), generación y optimización del logotipo en `public/logo-fnvac.png`, y actualización modular de componentes de navegación, autenticación, control de inventario, modo operador y logística de rutas.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React, TypeScript, PIL (optimización de imagen).

---

### Task 1: Activos Institucionales y Tokens de Color en Tailwind

**Files:**
- Create: `public/logo-fnvac.png`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Generar y optimizar el logotipo institucional en `public/`**
  Procesar `media_1789770220436.png` para recortar los bordes en blanco y guardarlo en `public/logo-fnvac.png`.

- [ ] **Step 2: Configurar la escala cromática institucional en `tailwind.config.ts`**
  Agregar `fnvac.blue` (`50` a `950`, con `600: '#136793'`) y `fnvac.red` (`50` a `950`, con `600: '#D21E27'`).

- [ ] **Step 3: Ajustar estilos globales y selección en `globals.css` y `layout.tsx`**
  Cambiar `selection:bg-emerald-100` por `selection:bg-fnvac-blue-100 selection:text-fnvac-blue-900`.

- [ ] **Step 4: Verificar compilación**
  Ejecutar `npx tsc --noEmit`.

---

### Task 2: Componentes de Marca, Navegación y Acceso

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/DriverManifestModal.tsx`

- [ ] **Step 1: Actualizar `Navbar.tsx`**
  Reemplazar icono genérico con el logotipo `logo-fnvac.png`, pestañas activas en `bg-fnvac-blue-50 text-fnvac-blue-800` y botón de acceso en azul institucional.

- [ ] **Step 2: Actualizar `app/login/page.tsx`**
  Header con logo oficial, botón de inicio en `bg-fnvac-blue-600 hover:bg-fnvac-blue-700`, foco en `focus:ring-fnvac-blue-500`, tarjeta de coordinador en azul institucional.

- [ ] **Step 3: Actualizar `DriverManifestModal.tsx`**
  Membrete oficial del CEDIS Celaya con logo FNVAC, sellos y botones de impresión y confirmación en azul institucional.

---

### Task 3: Tablero Principal FEFO y Componentes de Inventario

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/KPICard.tsx`
- Modify: `src/components/InventoryFilters.tsx`
- Modify: `src/components/InventoryTable.tsx`
- Modify: `src/components/Modal.tsx`

- [ ] **Step 1: Actualizar banner y botones en `app/page.tsx`**
  Banner en gradiente institucional `from-fnvac-blue-900 via-fnvac-blue-800 to-slate-900`, botón "Escanear Recepción" en `bg-fnvac-blue-600`, botón "Planificar Ruta Crítica" en `bg-fnvac-red-600`.

- [ ] **Step 2: Actualizar `KPICard.tsx` y `InventoryFilters.tsx`**
  KPICards para stock total y cámaras con acentos azul institucional, anillos de foco en `focus:ring-fnvac-blue-500`, chips de filtro activo y badges limpios.

- [ ] **Step 3: Actualizar `InventoryTable.tsx` y `Modal.tsx`**
  Hover de filas en `hover:bg-fnvac-blue-50/40`, acentos y modales en azul institucional.

---

### Task 4: Modo Operador, Escáner de Código de Barras y Recepción

**Files:**
- Modify: `src/app/operador/page.tsx`
- Modify: `src/app/recepcion/page.tsx`
- Modify: `src/components/BarcodeScanner.tsx`
- Modify: `src/components/QuickProductModal.tsx`
- Modify: `src/components/CatalogSearchModal.tsx`

- [ ] **Step 1: Actualizar `BarcodeScanner.tsx`**
  Visor de cámara y recuadro de apuntado con halo `ring-fnvac-blue-500/30`, botones de captura en `bg-fnvac-blue-600 hover:bg-fnvac-blue-700`.

- [ ] **Step 2: Actualizar modales de captura (`QuickProductModal.tsx` y `CatalogSearchModal.tsx`)**
  Botones de selección, chips de categoría y acciones en azul institucional.

- [ ] **Step 3: Actualizar vistas de operador (`operador/page.tsx` y `recepcion/page.tsx`)**
  Banners de confirmación de lote en `bg-fnvac-blue-50 border-fnvac-blue-500 text-fnvac-blue-950`, botón gigante de confirmar en `bg-fnvac-blue-600 hover:bg-fnvac-blue-700`.

---

### Task 5: Planificador de Rutas, Mapa y Módulo de Excel

**Files:**
- Modify: `src/app/rutas/page.tsx`
- Modify: `src/components/MapRouteView.tsx`
- Modify: `src/app/excel/page.tsx`
- Modify: `src/components/ExcelDropzone.tsx`
- Modify: `src/components/UserManagementTab.tsx`

- [ ] **Step 1: Actualizar `rutas/page.tsx` y `MapRouteView.tsx`**
  Controles de optimización, asignación de tortons/camionetas y selector en azul institucional, badge de sobrepeso en `bg-fnvac-red-600`.

- [ ] **Step 2: Actualizar `excel/page.tsx` y `ExcelDropzone.tsx`**
  Zona dropzone activa en `border-fnvac-blue-500 bg-fnvac-blue-50/70`, botones de descarga de plantilla FNVAC en `bg-fnvac-blue-600`.

- [ ] **Step 3: Actualizar `UserManagementTab.tsx`**
  Botón de nuevo usuario y badges de rol en azul institucional.

---

### Task 6: Verificación Integral y Pruebas

- [ ] **Step 1: Verificación de TypeScript**
  `npx tsc --noEmit`
- [ ] **Step 2: Verificación de Tests Automatizados**
  `npm test`
- [ ] **Step 3: Auditoría de accesibilidad y FEFO**
  Verificar que los estados FEFO en `StatusBadge.tsx` y los indicadores de caducidad permanezcan en rojo/amarillo/verde normativo.
