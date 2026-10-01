# Especificación de Diseño: Rediseño Cromático Institucional FNVAC (Azul, Rojo y Blanco)

- **Fecha:** 2026-09-18
- **Organización:** Fundación Nutrición y Vida A.C. (FNVAC) - CEDIS Celaya
- **Estado:** Validado por el usuario
- **Alcance:** Modificación integral de tokens de diseño, estilos, componentes, vistas y activos visuales de la aplicación web.

---

## 1. Contexto y Objetivos

La aplicación web de control de inventario FEFO y logística de Fundación Nutrición y Vida A.C. venía utilizando una paleta genérica basada en tonos verdes (`emerald`). La fundación cuenta con una identidad visual consolidada compuesta por un logotipo con corazón tricolor y tipografía institucional en **Azul Institucional**, **Rojo Institucional** y **Blanco Puro**.

### Objetivos:
1. Reemplazar toda la identidad cromática de marca en la aplicación web por la paleta oficial de FNVAC:
   - **Azul Institucional:** `#136793`
   - **Rojo Institucional:** `#D21E27`
   - **Blanco:** `#FFFFFF`
2. Incorporar el activo oficial del logotipo institucional en la barra de navegación, la pantalla de inicio de sesión y los manifiestos de chofer.
3. Mantener la integridad de los semáforos regulatorios FEFO (`fefo.red`, `fefo.yellow`, `fefo.green`) para asegurar que los operadores de almacén no confundan la identidad institucional con los estados de inocuidad y caducidad de los alimentos perecederos.

---

## 2. Sistema de Tokens Cromáticos (Tailwind CSS)

En `tailwind.config.ts`, se incorporan los siguientes tokens semánticos bajo `theme.extend.colors`:

```typescript
colors: {
  fnvac: {
    blue: {
      50: '#f0f7fb',
      100: '#dbeefa',
      200: '#bce0f6',
      300: '#8ac9ee',
      400: '#52abe0',
      500: '#1d85be',
      600: '#136793', // Color Institucional Principal FNVAC
      700: '#0f5377', // Hover y variantes oscuras
      800: '#0c4360',
      900: '#082e44',
      950: '#051e2d',
    },
    red: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#e02830',
      600: '#d21e27', // Color Rojo Oficial FNVAC
      700: '#b3161e', // Hover botones críticos y alertas
      800: '#92151c',
      900: '#79161a',
      950: '#45070a',
    },
  },
  fefo: {
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    gray: '#6b7280',
  },
}
```

---

## 3. Integración de Activos de Marca

1. **Creación de `public/logo-fnvac.png`:**
   - Se procesará y optimizará la imagen proporcionada por el usuario con el logotipo de la Fundación Nutrición y Vida A.C. (corazón tricolor y tipografía azul).
   - Se integrará en:
     - `src/components/Navbar.tsx`: Sustituyendo el icono abstracto `Building2` por el logo oficial de FNVAC.
     - `src/app/login/page.tsx`: Destacando el logo en la cabecera de autenticación.
     - `src/components/DriverManifestModal.tsx`: Encabezado oficial para choferes en formato impreso y digital.

---

## 4. Distribución Cromática en Componentes y Vistas

### 4.1 Barra de Navegación (`Navbar.tsx`)
- Logo institucional con nombre oficial.
- Pestaña activa: Fondo `bg-fnvac-blue-50`, texto `text-fnvac-blue-800`, borde/icono `text-fnvac-blue-600`.
- Indicador de estado de bodega activa: Mantener pulsación verde para indicar base de datos conectada en tiempo real.
- Botón de Acceder / Login: `bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white`.

### 4.2 Pantalla de Inicio de Sesión (`app/login/page.tsx`)
- Contenedor con logo institucional.
- Botón "Iniciar Sesión": `bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white shadow-fnvac-blue-600/25`.
- Foco de inputs: `focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500`.
- Botón demo Coordinador: `border-fnvac-blue-200 bg-fnvac-blue-50/60 text-fnvac-blue-950`.

### 4.3 Tablero FEFO (`app/page.tsx` & componentes asociados)
- **Banner Superior:** Gradiente institucional `from-fnvac-blue-900 via-fnvac-blue-800 to-slate-900`.
- **Botón "Escanear Recepción":** `bg-fnvac-blue-600 hover:bg-fnvac-blue-700`.
- **Botón "Planificar Ruta Crítica":** `bg-fnvac-red-600 hover:bg-fnvac-red-700` (resaltando criticidad).
- **Tarjetas KPI (`KPICard.tsx`):**
  - "Total Stock" y "Cámaras Frías": Variantes neutral y azul institucional.
  - "Lotes Críticos": Rojo normativo (`#ef4444`).
  - "Lotes en Atención": Ámbar normativo (`#eab308`).
- **Filtros (`InventoryFilters.tsx`):** Anillos de foco y selección en `fnvac-blue`.

### 4.4 Modo Operador (`app/operador/page.tsx`, `BarcodeScanner.tsx`, `QuickProductModal.tsx`)
- Elementos activos de escaneo y cámara en `fnvac-blue`.
- Banner de éxito de escaneo/guardado en `bg-fnvac-blue-50 border-fnvac-blue-500 text-fnvac-blue-950`.
- Botón "Registrar Entrada a Bodega": `bg-fnvac-blue-600 hover:bg-fnvac-blue-700`.

### 4.5 Planificador de Rutas (`app/rutas/page.tsx`, `MapRouteView.tsx`, `DriverManifestModal.tsx`)
- Pestañas, selectores y asignación vehicular en `fnvac-blue`.
- Alertas de capacidad máxima y límites de carga en `fnvac-red`.
- Manifiesto impreso con logo institucional FNVAC.

### 4.6 Excel y Datos (`app/excel/page.tsx`, `ExcelDropzone.tsx`)
- Zona de arrastre activa en `border-fnvac-blue-500 bg-fnvac-blue-50/70`.
- Botones de descarga de plantilla FNVAC y exportación en `fnvac-blue-600`.

---

## 5. Plan de Verificación

1. **Compilación y Linters:**
   - Ejecutar `npx tsc --noEmit` o build de Next.js para verificar que no existen errores de sintaxis ni de tipos.
2. **Pruebas Automatizadas:**
   - Ejecutar la suite de tests (`npm test` o `npm run test:run`) para asegurar que los selectores y la lógica de negocio se mantienen intactos.
3. **Verificación Visual:**
   - Comprobar que el logo oficial se despliega correctamente sin roturas.
   - Comprobar contraste de texto (WCAG AA) sobre azul y rojo con blanco.
   - Comprobar que los semáforos FEFO conservan su código de color normativo.
