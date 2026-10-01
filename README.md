# Food-Inventory-Manager-FNVAC
## Sistema de Gestión de Almacén, Control FEFO y Ruteo Logístico
### Centro de Distribución (CEDIS) Celaya, Guanajuato • Fundación Nutrición y Vida, A.C.

![Licencia](https://img.shields.io/badge/licencia-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57.svg)
![Leaflet](https://img.shields.io/badge/Mapas-Leaflet%20%2B%20OSM-green.svg)
![Pruebas](https://img.shields.io/badge/Pruebas-177%2F177%20Pasadas-brightgreen.svg)

---

## 1. Contexto Operativo y Justificación del Proyecto

### 1.1. Contexto Operativo Institucional
La **Fundación Nutrición y Vida, A.C. (FNVAC)** opera como uno de los bancos de alimentos más tecnificados e influyentes del Bajío mexicano, rescatando anualmente más de **6,100 toneladas de alimento** y distribuyendo más de **314,000 despensas** a familias en situación de vulnerabilidad en Guanajuato y Querétaro. Su modelo operativo cuenta con el respaldo de **Grupo Industrial Cuadritos Biotek** (proveedor continuo de lácteos y bebidas que exigen estricta cadena de frío), hortalizas frescas del campo del Bajío y una flota que incluye **3 camiones Torton refrigerados Thermo King**.

### 1.2. Justificación de Food-Inventory-Manager-FNVAC
Históricamente, la captura de recepciones, el monitoreo de existencias y la planeación de entregas se realizaban mediante **hojas de cálculo manuales de Excel**. Ante la escala masiva de la fundación, este flujo manual provocaba tres problemas operativos críticos:
1. **Riesgo de Merma por Caducidad:** La falta de visibilidad en tiempo real de lotes perecederos dificultaba la priorización de salida bajo la metodología estricta **FEFO** (*First Expired, First Out*).
2. **Vulnerabilidad de la Cadena de Frío:** La asignación manual de transporte no garantizaba que las cargas con lácteos y vegetales frescos fueran despachadas obligatoriamente en camiones Torton con caja refrigerada Thermo King a 4°C.
3. **Ineficiencia en Costos Logísticos:** Ruteos no asistidos por cálculo de proximidad geográfica encarecían el gasto de combustible financiado por cuotas de recuperación comunitarias.

**Food-Inventory-Manager-FNVAC** resuelve esta problemática reemplazando el flujo manual con una plataforma digital integral, reactiva y tolerante a fallos: escaneo dual por código de barras, semáforo visual FEFO en tiempo real, motor de ruteo asistido por proximidad Haversine, deducción atómica transaccional y compatibilidad bidireccional con hojas de cálculo Excel.

```
[ Donantes: Cuadritos / Campo / Retail ]
                │
                ▼ (Tractocamión / Tortons refrigerados)
   [ CEDIS Celaya: Escaneo y Recepción en Andén ]
                │
         ┌──────┴──────────────────────┐
         ▼                             ▼
[ Cámaras Frías: Lácteos ]    [ Nave de Secos: Granos y Abarrotes ]
         └──────┬──────────────────────┘
                ▼
   [ Tablero de Control FEFO: Semáforo Rojo / Amarillo / Verde ]
                │
                ▼
   [ Planificador Inteligente de Rutas por Proximidad Haversine ]
                │ (Recomendación obligatoria Torton Thermo King si hay frío)
                ▼
   [ Mapa Leaflet + Hoja de Ruta Imprimible para Chofer ]
                │ (Descuento atómico de existencias)
                ▼
[ Entrega a Comités Comunitarios: San Juan de la Vega, Tamayo, etc. ]
```

---

## 2. Características y Módulos Principales

### 2.1. Tablero de Control FEFO (*First Expired, First Out*)
* **KPIs en tiempo real:** Total de stock en bodega, conteo de lotes críticos (≤ 3 días), lotes en atención (4-7 días) y existencias en Cámaras Frías vs. Nave de Secos.
* **Ordenamiento estricto:** Los lotes con fecha de vencimiento más inminente se sitúan prioritariamente en la parte superior con distintivos visuales parpadeantes.
* **Filtros cruzados:** Búsqueda en vivo por nombre o código de barras, filtrado por donante (Cuadritos, Campo Bajío, etc.), categoría y área de almacén.
* **Acción directa:** Botón *"Despachar a Ruta"* que transfiere el lote al planificador logístico.

### 2.2. Recepción y Escáner Dual de Código de Barras
* **Captura con lector USB/Bluetooth:** Campo con enfoque automático continuo (*autofocus* permanente) que registra entradas al presionar Enter con confirmación acústica y visual.
* **Escaneo con cámara de celular/tablet:** Integración con `html5-qrcode` para bodegueros en patio.
* **Atajos para cosechas agrícolas:** Botones de un toque para registrar vegetales sin empaque (Brócoli, Zanahoria, Jitomate, Lechuga).
* **Modal de alta rápida (10 segundos):** Permite catalogar un producto nuevo al momento si su código no existe en base de datos.
* **Validación preventiva de caducidad:** Bloqueo y advertencia inmediata si se intenta ingresar un alimento ya expirado.

### 2.3. Planificador Inteligente de Rutas Logísticas
* **Asistente de carga crítica:** Selección automática de todos los lotes rojos y amarillos para despacho urgente.
* **Motor de recomendación vehicular:**
  * Si la carga incluye lácteos o perecederos frescos, el sistema **impone el uso del camión Torton con caja refrigerada Thermo King** y emite advertencia de temperatura a 4°C.
  * Si la carga es exclusivamente seca, recomienda **Camioneta de 3.5 Toneladas**.
  * Monitoreo de sobrecupo contra la capacidad máxima en kilogramos.
* **Proximidad geográfica Haversine:** Calcula las distancias desde el origen fijo **CEDIS Celaya (Lat: 20.5950, Lon: -100.8160)** hacia comunidades beneficiarias (San Juan de la Vega, Rincón de Tamayo, San Miguel Octopan, Comonfort, etc.).
* **Mapa interactivo OpenStreetMap (Leaflet):** Marcador destacado del CEDIS, paradas de entrega numeradas (1, 2, 3...) y polilínea de circuito.
* **Hoja de ruta para chofer (Manifiesto imprimible):** Formato optimizado para impresión `@media print` con instrucciones de cadena de frío, desglose de carga por lote, datos de contacto de comités comunitarios y áreas para firmas de conformidad.
* **Despacho atómico:** Al confirmar la salida, el inventario se descuenta en tiempo real de la base de datos bajo una transacción ACID.

### 2.4. Interoperabilidad y Migración con Excel
* **Exportación consolidada (.xlsx):** Genera un libro Excel con 3 pestañas: *Inventario Actual* (con cálculo FEFO), *Alertas de Caducidad* y *Historial de Rutas Despachadas*.
* **Descarga de plantilla oficial:** Archivo preformateado con validaciones de columnas para captura estándar en CEDIS.
* **Carga masiva drag-and-drop:** Zona de arrastrar y soltar con previsualización en el navegador de las filas antes de confirmar la inserción a base de datos.

---

## 3. Arquitectura y Stack Tecnológico

| Capa | Tecnología | Justificación Técnica |
| :--- | :--- | :--- |
| **Framework Web** | Next.js 14+ (App Router) | Renderizado híbrido rápido, componentes de servidor y cliente unificados. |
| **Lenguaje** | TypeScript 5.6 | Tipado estático estricto en catálogo, inventario y ruteo logístico. |
| **Estilos & UI** | Tailwind CSS + Lucide React | Diseño responsivo, contrastes accesibles y estilos dedicados para impresión de manifiestos. |
| **Base de Datos** | SQLite (`node:sqlite` nativo) | Persistencia local veloz, cero dependencias binarias C++ en Windows (`node-gyp`), transaccionalidad ACID y alta tolerancia a fallos. |
| **Mapas** | Leaflet + OpenStreetMap | Solución 100% de código abierto, sin cuotas de facturación ni claves de Google Maps. |
| **Escáner** | `html5-qrcode` + Listeners USB | Doble mecanismo de captura para maximizar velocidad en andén y patios. |
| **Hojas de Cálculo**| `xlsx` (SheetJS) | Generación y lectura directa de libros Excel sin servidores externos. |
| **Testing** | Node.js Test Runner (`node:test`) | Suite completa de 177 pruebas unitarias, de integración y E2E sin dependencias pesadas. |

---

## 4. Instalación y Puesta en Marcha

### Prerrequisitos
* **Node.js:** Versión 22+ o 24+ (incluye el módulo nativo `node:sqlite`).
* **NPM:** Versión 10+.

### Paso 1: Clonar e instalar dependencias
```bash
git clone https://github.com/<TU_USUARIO>/Food-Inventory-Manager-FNVAC.git
cd Food-Inventory-Manager-FNVAC
npm install
```

### Paso 2: Configurar variables de entorno
Copiar el archivo de plantilla `.env.example` a `.env`:
```bash
# En Linux / macOS
cp .env.example .env

# En Windows (PowerShell / CMD)
copy .env.example .env
```

### Paso 3: Poblar la base de datos inicial (Seed Data)
El script de semilla inicializa el esquema SQLite y precarga productos representativos de Cuadritos y campo del Bajío, lotes de inventario FEFO, comunidades de Celaya y usuarios con roles preconfigurados:
```bash
npm run seed
```

### Paso 4: Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre tu navegador en [http://localhost:3000](http://localhost:3000).

#### Cuentas de Demostración Preconfiguradas:
| Usuario | Contraseña | Rol | Acceso y Permisos |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **Coordinador** | Acceso total: Tablero FEFO, Despacho, Ruteo Logístico, Gestión de Usuarios y Auditoría Excel |
| `operador` | `operador123` | **Almacén** | Operación de andén: Recepción ágil por código de barras y registro rápido de cosechas |

### Paso 5: Ejecutar la suite de pruebas automatizadas
Para ejecutar las 177 pruebas unitarias, de API y el flujo operacional E2E completo:
```bash
npm test
```

### Paso 6: Compilación para producción
```bash
npm run build
npm run start
```

---

## 5. Estructura del Código Fuente

```
Food-Inventory-Manager-FNVAC/
├── data/
│   └── nutricion_vida.db        # Base de datos SQLite local persistente
├── docs/superpowers/
│   ├── specs/                    # Especificación formal aprobada
│   └── plans/                    # Plan de implementación ejecutado
├── src/
│   ├── app/
│   │   ├── api/                  # Endpoints REST (inventario, rutas, excel, seed)
│   │   ├── recepcion/            # Pantalla de escaneo y recepción
│   │   ├── rutas/                # Planificador con mapa Leaflet y manifiesto
│   │   ├── excel/                # Centro de exportación e importación .xlsx
│   │   ├── layout.tsx            # Layout institucional con Navbar
│   │   ├── globals.css           # Estilos globales, Leaflet y print media
│   │   └── page.tsx              # Tablero principal FEFO
│   ├── components/
│   │   ├── Navbar.tsx            # Navegación y botón de reset demo
│   │   ├── KPICard.tsx           # Tarjetas de indicadores con variantes de color
│   │   ├── StatusBadge.tsx       # Semáforos FEFO animados (Rojo, Amarillo, Verde)
│   │   ├── InventoryTable.tsx    # Tabla interactiva con orden FEFO estricto
│   │   ├── InventoryFilters.tsx  # Barra de filtros y búsqueda
│   │   ├── BarcodeScanner.tsx    # Escáner USB continuo + cámara html5-qrcode
│   │   ├── QuickProductModal.tsx # Alta exprés de productos
│   │   ├── MapRouteView.tsx      # Mapa Leaflet con marcadores y polyline
│   │   ├── DriverManifestModal.tsx # Hoja de ruta para chofer con botón de impresión
│   │   └── ExcelDropzone.tsx     # Dropzone con preview en navegador
│   ├── lib/
│   │   ├── db.ts                 # Cliente SQLite singleton y transacciones
│   │   ├── schema.sql            # DDL de tablas e índices
│   │   ├── seed.ts               # Semilla representativa FNVAC
│   │   ├── fefo.ts               # Algoritmo FEFO y cálculo de días
│   │   ├── routing.ts            # Algoritmo Haversine y recomendador vehicular
│   │   └── excel.ts              # Handlers para SheetJS
│   └── types/
│       └── index.ts              # Definiciones TypeScript
└── test/                         # ... (19 suites con 177 pruebas automatizadas)
    ├── db.test.mjs               # Pruebas de base de datos y transacciones
    ├── fefo.test.mjs             # Pruebas de cálculo de semáforo FEFO
    ├── routing.test.mjs          # Pruebas de distancias y selección vehicular
    ├── excel.test.mjs            # Pruebas de generación y parseo Excel
    ├── reception.test.mjs        # Pruebas de atajos y validación de recepción
    ├── api.test.mjs              # Pruebas de endpoints de API REST
    └── e2e-workflow.test.mjs     # Flujo operacional E2E completo
```

---

## 6. Validación Operativa Extremo a Extremo (E2E)

El archivo `test/e2e-workflow.test.mjs` valida de forma automatizada el recorrido operativo completo de la fundación:
1. **Recepción:** Entrada en andén de 500 litros de leche donada por Cuadritos Biotek con caducidad a 2 días.
2. **Priorización FEFO:** Aparición en tablero en primera posición bajo semáforo `CRITICO` (Rojo).
3. **Planificación de Carga:** Detección de lácteo y recomendación mandatoria de **Torton Thermo King**.
4. **Optimización Geográfica:** Selección de las comunidades más cercanas al CEDIS Celaya (San Juan de la Vega a 13.2 km, San Miguel Octopan a 13.9 km).
5. **Despacho Atómico:** Deducción de 300 litros en bodega y registro de ruta `En_Transito`, dejando exactamente 200 litros en stock.
6. **Auditoría Excel:** Exportación a `.xlsx` corroborando que el lote refleje 200 litros restantes en la hoja *Inventario Actual* y figure en la hoja *Historial de Rutas*.

---

**Proyecto:** Food-Inventory-Manager-FNVAC  
**Organización Socio Formadora:** Fundación Nutrición y Vida, A.C. (FNVAC - CEDIS Celaya)  
**Licencia:** MIT License
