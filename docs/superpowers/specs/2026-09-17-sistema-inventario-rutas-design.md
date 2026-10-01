# Documento de Diseño de Sistema (Spec): Food-Inventory-Manager-FNVAC

**Proyecto:** Food-Inventory-Manager-FNVAC • Sistema de Gestión de Almacén, Inventario FEFO y Rutas para Bancos de Alimentos  
**Organización Socio Formadora (OSF):** Fundación Nutrición y Vida, A.C. (FNVAC) - CEDIS Celaya  
**Equipo:** Equipo de Desarrollo de Software  
**Fecha:** 17 de Septiembre de 2026  
**Estado:** Aprobado para Planificación e Implementación  

---

## 1. Resumen Ejecutivo y Objetivos

Fundación Nutrición y Vida A.C. (FNVAC) rescata anualmente más de **6,100 toneladas de alimento** y distribuye más de **314,000 despensas** en Guanajuato y zonas aledañas. Su operación cuenta con el respaldo de *Grupo Industrial Cuadritos Biotek* (proveedor constante de lácteos y bebidas de soya que requieren estricta cadena de frío), hortalizas frescas del campo del Bajío y una flota que incluye **3 camiones Torton refrigerados Thermo King y 1 tractocamión**.

Actualmente, el control de inventario y almacén se gestiona mediante **hojas de cálculo de Excel manuales**, lo que ocasiona:
1. Lentitud en la captura de entradas y salidas.
2. Dificultad para rastrear fechas de caducidad en tiempo real, aumentando el riesgo de mermas en bodega.
3. Desconexión entre los alimentos críticos próximos a vencer y la programación de rutas de reparto a los comités comunitarios.

### Objetivo del MVP
Desarrollar una aplicación web unificada, intuitiva y responsiva que reemplace el flujo manual de Excel, permitiendo:
1. **Captura ágil con códigos de barras:** Lectura con escáner físico USB y cámara de smartphone/tablet.
2. **Priorización FEFO (*First Expired, First Out*):** Semáforo visual de caducidades (Rojo ≤ 3 días, Amarillo 4-7 días, Verde > 7 días) y clasificación por áreas del CEDIS (Cámaras Frías vs. Nave de Secos).
3. **Recomendador asistido de rutas y cargas:** Selección automática de comunidades cercanas al CEDIS Celaya para despachar alimentos en riesgo de caducidad y visualización en mapa interactivo con OpenStreetMap/Leaflet.
4. **Interoperabilidad con Excel:** Importación y exportación masiva en formato `.xlsx` para una transición sin fricción y respaldo de datos.

---

## 2. Arquitectura de Software y Stack Tecnológico

* **Framework Principal:** Next.js 14+ (App Router con TypeScript).
* **Estilos y UI:** Tailwind CSS + Lucide React Icons (diseño limpio, contrastes accesibles y responsivo para desktop y mobile).
* **Persistencia de Datos:** SQLite local (autocontenido, veloz, cero configuración externa y fácilmente desplegable en red local o en la nube).
* **Mapeo y Ruteo:** Leaflet + React-Leaflet + OpenStreetMap (100% de código abierto, sin cuotas de facturación ni claves de Google Maps).
* **Lector de Códigos de Barras:** `html5-qrcode` para escaneo por cámara web/móvil + soporte nativo para pistolas lectoras USB/Bluetooth (input listener).
* **Procesamiento de Hojas de Cálculo:** `xlsx` (SheetJS) para lectura y generación de archivos Excel sin dependencias externas.

---

## 3. Modelo de Datos (Esquema de Base de Datos)

### 3.1. `Product` (Catálogo de Artículos)
* `id` (string, PK)
* `barcode` (string, unique): Código EAN-13/UPC de fábrica o identificador único para granel.
* `name` (string): Nombre común (ej. *"Leche Entera UHT 1L"*, *"Brócoli Fresco a Granel"*).
* `donorType` (string): Donante frecuente (*Cuadritos Biotek*, *Campo Bajío*, *Walmart*, *Central de Abasto*).
* `category` (enum): `LACTEO_FRIO`, `AGRICOLA_PERECEDERO`, `SECO_ABARROTE`, `NO_ALIMENTARIO`.
* `unit` (enum): `piezas`, `kilos`, `cajas`, `litros`.
* `storageArea` (enum): `Camara_Fria`, `Nave_Secos`, `Anden`.
* `minStock` (number): Umbral mínimo de stock de seguridad.

### 3.2. `InventoryBatch` (Lotes de Inventario y Caducidades)
* `id` (string, PK)
* `productId` (string, FK -> Product.id)
* `lotCode` (string): Código de lote asignado o registrado.
* `expirationDate` (datetime / string ISO): Fecha de caducidad formal.
* `currentQuantity` (number): Existencia disponible actual.
* `receivedAt` (datetime): Fecha y hora de recepción en el andén.
* `status` (calculado / enum):
  * 🔴 `CRITICO` (días restantes ≤ 3)
  * 🟡 `ATENCION` (días restantes entre 4 y 7)
  * 🟢 `ESTABLE` (días restantes > 7)
  * ⚪ `AGOTADO` / `DESPACHADO` (cantidad = 0)

### 3.3. `Community` (Comunidades y Comités Destino)
* `id` (string, PK)
* `name` (string): Nombre de la localidad o comedor (ej. *San Juan de la Vega*, *Rincón de Tamayo*, *San Miguel Octopan*).
* `municipality` (string): Municipio (*Celaya*, *Comonfort*, *Apaseo el Grande*, *Apaseo el Alto*, etc.).
* `latitude` (float) y `longitude` (float): Coordenadas GPS del punto de entrega.
* `representativeName` (string): Nombre de la representante comunitaria avalada por Trabajo Social.
* `phone` (string): Teléfono de contacto.
* `beneficiariesCount` (number): Familias registradas en el padrón.

### 3.4. `DispatchRoute` (Rutas de Salida)
* `id` (string, PK)
* `routeCode` (string): Folio identificador (ej. `RUT-2026-001`).
* `createdAt` (datetime): Fecha y hora de creación.
* `vehicleType` (enum): `Torton_ThermoKing`, `Camioneta_3_5T`, `Tractocamion`.
* `driverName` (string): Operador asignado.
* `status` (enum): `Planificada`, `En_Transito`, `Completada`.
* `totalDistanceKm` (number): Kilómetros estimados del circuito.
* `stops` (JSON string / relación): Lista ordenada de comunidades a visitar.
* `dispatchedItems` (JSON string / relación): Lotes y cantidades asignadas.

---

## 4. Descripción Detallada de Módulos

### 4.1. Módulo de Recepción y Escaneo de Código de Barras
* **Doble interfaz de captura:**
  1. *Campo de escaneo continuo con autofocus:* Permite registrar productos con lector de código de barras USB/láser a máxima velocidad.
  2. *Escáner por cámara:* Botón interactivo que activa la cámara del celular con recuadro guía y sonido de confirmación al detectar el código.
  3. *Botones rápidos de hortalizas a granel:* Accesos directos con un toque para vegetales sin empaque (brócoli, lechuga, zanahoria, jitomate).
* **Lógica de Entrada:**
  * Al detectar el código, autocompleta el producto y sugiere el área de almacén recomendada.
  * El operador captura:
    * Cantidad recibida.
    * Fecha de caducidad (con atajos: *+3 días*, *+7 días*, *+15 días*, *+30 días* o selector de fecha).
  * Si el código no está registrado en el catálogo, abre un modal de alta rápida de 10 segundos.

### 4.2. Tablero de Control de Inventario y Semáforo FEFO
* **Métricas Principales (KPI Cards):**
  * Total de kilos/piezas en almacén.
  * Número de lotes en riesgo crítico (≤ 3 días).
  * Número de lotes en atención (4-7 días).
  * Desglose por área: Cámaras Frías vs Nave de Secos.
* **Tabla de Lotes Interactiva:**
  * Ordenada por defecto en modo **FEFO estricto** (lo que vence primero aparece hasta arriba).
  * Distintivos visuales por color (rojo, amarillo, verde).
  * Filtros por categoría, donante y texto libre.
  * Botón directo de acción: **"Despachar Lote"** para incluirlo de inmediato en una orden de salida.

### 4.3. Planificador Inteligente de Rutas por Proximidad y Caducidad
* **Asistente de Carga Crítica:**
  * Detecta automáticamente todos los lotes con semáforo rojo y amarillo.
  * Sugiere la flota vehicular adecuada: si incluye lácteos o perecederos frescos, recomienda obligatoriamente el **Torton con caja refrigerada Thermo King**; si solo son secos, recomienda camioneta de 3.5 toneladas.
* **Algoritmo de Asignación por Proximidad:**
  * Calcula distancias geográficas mediante la fórmula de Haversine tomando como origen el **CEDIS Celaya (Lat: 20.5950, Lon: -100.8160 aprox.)**.
  * Selecciona y ordena las comunidades más cercanas que cuenten con demanda pendiente.
* **Mapa Interactivo:**
  * Mapa Leaflet con marcadores diferenciados: CEDIS Celaya (icono de base/almacén) y paradas de entrega numeradas (1, 2, 3...).
  * Trazado de ruta conectando las paradas con resumen de kilometraje y tiempo estimado.
* **Manifiesto de Chofer (Hoja de Ruta):**
  * Vista imprimible y descargable con la lista de carga detallada, requerimiento de refrigeración y teléfonos de los comités vecinales.
  * Botón **"Confirmar y Despachar"**: descuenta en tiempo real los inventarios del almacén.

### 4.4. Módulo de Integración y Migración con Excel
* **Exportar a Excel:**
  * Generación instantánea de archivo `.xlsx` con hojas separadas: *Inventario Actual*, *Alertas de Caducidad* y *Historial de Rutas*.
* **Descarga de Plantilla Oficial:**
  * Archivo `.xlsx` con formato estándar y validación de columnas para que la organización pueda estructurar sus datos existentes.
* **Importación Masiva:**
  * Subida de archivo arrastrando (.xlsx o .csv) con previsualización de filas leídas y reporte de registros creados o actualizados.

### 4.5. Datos Semilla (Seed Data) Pre-cargados
* **Base inicial representativa de Celaya y FNVAC:**
  * 10 productos típicos (Leche Entera Cuadritos, Queso Panela Cuadritos, Yogur Natural, Bebida Nutrivida, Brócoli de campo, Zanahoria, Arroz, Frijol, Aceite vegetal, Mochilas escolares).
  * 12 lotes de inventario distribuidos entre semáforo rojo (vencen en 2 días), amarillo (5 días) y verde (30 días).
  * 8 comunidades y comedores reales en Celaya y municipios vecinos (San Juan de la Vega, Rincón de Tamayo, San Miguel Octopan, Juan Martín, Comonfort, Apaseo el Grande, Cortazar, Villagrán).
  * 2 vehículos registrados: Torton Thermo King #1 y Camioneta 3.5 Ton.

---

## 5. Manejo de Errores y Casos Borde

1. **Lectura de código de barras fallida o código dañado:**
   * La interfaz siempre ofrece búsqueda manual en tiempo real por texto o selección directa de catálogo para no detener la operación.
2. **Registro de producto ya caducado en recepción:**
   * El sistema bloquea el registro normal y lanza una alerta: *"La fecha ingresada ya expiró. ¿Deseas clasificarlo como merma de rechazo o corregir la fecha?"*.
3. **Falta de conexión temporal a internet en patio:**
   * Al ser una aplicación local o PWA-ready con SQLite, las consultas y navegación interna se mantienen fluidas.
4. **Capacidad vehicular excedida:**
   * Si la suma de paquetes a despachar excede la capacidad estimada del vehículo seleccionado, el sistema muestra una advertencia preventiva de sobrecupo.

---

## 6. Estrategia de Pruebas y Validación

1. **Pruebas de Componentes y Lógica:**
   * Validación del cálculo de días restantes y asignación de semáforo FEFO (Rojo, Amarillo, Verde).
   * Validación del algoritmo de cálculo de distancias geográficas desde CEDIS Celaya.
   * Validación de exportación y parseo de archivos Excel (`xlsx`).
2. **Prueba Operativa Extremo a Extremo (E2E User Flow):**
   * Paso 1: Escanear o registrar un producto lácteo con fecha de vencimiento a 2 días.
   * Paso 2: Verificar que aparezca en el tablero con Semáforo Rojo.
   * Paso 3: Entrar al planificador de rutas, generar la ruta sugerida a comunidades cercanas y revisar el mapa interactivo.
   * Paso 4: Despachar la ruta y confirmar que el stock se descuente en inventario.
   * Paso 5: Exportar el inventario resultante a Excel y corroborar consistencia.
