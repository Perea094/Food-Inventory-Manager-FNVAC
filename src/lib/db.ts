import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  Product,
  InventoryBatch,
  Community,
  DispatchRoute,
  Vehicle,
  DispatchedItem,
  RouteStop,
  User,
} from '../types/index';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  donorType TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  storageArea TEXT NOT NULL,
  minStock REAL NOT NULL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator')),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lotCode TEXT NOT NULL,
  expirationDate TEXT NOT NULL,
  currentQuantity REAL NOT NULL,
  receivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdBy TEXT NOT NULL DEFAULT 'admin' REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  municipality TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  representativeName TEXT NOT NULL,
  phone TEXT NOT NULL,
  beneficiariesCount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dispatch_routes (
  id TEXT PRIMARY KEY,
  routeCode TEXT UNIQUE NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  vehicleType TEXT NOT NULL,
  driverName TEXT NOT NULL,
  status TEXT NOT NULL,
  totalDistanceKm REAL NOT NULL,
  stops TEXT NOT NULL,
  dispatchedItems TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plate TEXT NOT NULL,
  vehicleType TEXT NOT NULL,
  maxCapacityKg REAL NOT NULL,
  hasRefrigeration INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_expiration ON inventory_batches(expirationDate);
CREATE INDEX IF NOT EXISTS idx_batches_product ON inventory_batches(productId);
`;

declare global {
  // eslint-disable-next-line no-var
  var __fnvac_db: DatabaseSync | undefined;
}

export function getDefaultDbPath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'nutricion_vida.db');
}

export function initSchema(database: DatabaseSync): void {
  // Read schema file if accessible, or fallback to embedded SCHEMA_SQL
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  let loaded = false;
  if (fs.existsSync(schemaPath)) {
    try {
      const content = fs.readFileSync(schemaPath, 'utf8');
      database.exec(content);
      loaded = true;
    } catch {
      // fallback to embedded schema
    }
  }
  if (!loaded) {
    database.exec(SCHEMA_SQL);
  }

  // Ensure table users is created
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operator')),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration check for createdBy in inventory_batches
  const batchCols = database.prepare("PRAGMA table_info(inventory_batches);").all() as any[];
  if (!batchCols.some((c) => c.name === 'createdBy')) {
    database.exec("ALTER TABLE inventory_batches ADD COLUMN createdBy TEXT NOT NULL DEFAULT 'admin';");
  }
}

export function createDatabase(dbPath: string = ':memory:'): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');
  initSchema(db);
  return db;
}

export function getDb(customPath?: string): DatabaseSync {
  if (customPath === ':memory:') {
    return createDatabase(':memory:');
  }

  if (customPath && customPath !== ':memory:') {
    const db = new DatabaseSync(customPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    initSchema(db);
    return db;
  }

  if (!global.__fnvac_db) {
    const dbPath = getDefaultDbPath();
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    initSchema(db);
    global.__fnvac_db = db;
  }

  return global.__fnvac_db;
}

export const db = getDb();

// Helper Functions for Data Operations

export function getAllProducts(database: DatabaseSync = getDb()): Product[] {
  const stmt = database.prepare('SELECT * FROM products ORDER BY name ASC');
  return stmt.all() as unknown as Product[];
}

export function getProductByBarcode(barcode: string, database: DatabaseSync = getDb()): Product | null {
  const stmt = database.prepare('SELECT * FROM products WHERE barcode = ?');
  const result = stmt.get(barcode);
  return (result as unknown as Product) || null;
}

export function getProductById(id: string, database: DatabaseSync = getDb()): Product | null {
  const stmt = database.prepare('SELECT * FROM products WHERE id = ?');
  const result = stmt.get(id);
  return (result as unknown as Product) || null;
}

export function createProduct(product: Omit<Product, 'createdAt'> & { createdAt?: string }, database: DatabaseSync = getDb()): void {
  const stmt = database.prepare(`
    INSERT INTO products (id, barcode, name, donorType, category, unit, storageArea, minStock, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `);
  stmt.run(
    product.id,
    product.barcode,
    product.name,
    product.donorType,
    product.category,
    product.unit,
    product.storageArea,
    product.minStock ?? 0,
    product.createdAt ?? null
  );
}

export function getFrequentProducts(
  limit: number = 8,
  database: DatabaseSync = getDb()
): (Product & { batchCount: number; totalQuantity: number })[] {
  const stmt = database.prepare(`
    SELECT 
      p.id,
      p.barcode,
      p.name,
      p.donorType,
      p.category,
      p.unit,
      p.storageArea,
      p.minStock,
      p.createdAt,
      COUNT(b.id) AS batchCount,
      COALESCE(SUM(b.currentQuantity), 0) AS totalQuantity
    FROM products p
    LEFT JOIN inventory_batches b ON p.id = b.productId
    GROUP BY p.id
    ORDER BY batchCount DESC, totalQuantity DESC, p.name ASC
    LIMIT ?
  `);
  const rows = stmt.all(limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    barcode: r.barcode,
    name: r.name,
    donorType: r.donorType,
    category: r.category,
    unit: r.unit,
    storageArea: r.storageArea,
    minStock: Number(r.minStock ?? 0),
    createdAt: r.createdAt,
    batchCount: Number(r.batchCount ?? 0),
    totalQuantity: Number(r.totalQuantity ?? 0),
  }));
}

export function getAllBatches(database: DatabaseSync = getDb()): (InventoryBatch & { product?: Product })[] {
  const stmt = database.prepare(`
    SELECT 
      b.id, b.productId, b.lotCode, b.expirationDate, b.currentQuantity, b.receivedAt, b.createdBy,
      p.id as prod_id, p.barcode as prod_barcode, p.name as prod_name,
      p.donorType as prod_donorType, p.category as prod_category,
      p.unit as prod_unit, p.storageArea as prod_storageArea,
      p.minStock as prod_minStock, p.createdAt as prod_createdAt
    FROM inventory_batches b
    JOIN products p ON b.productId = p.id
    ORDER BY b.expirationDate ASC
  `);
  
  const rows = stmt.all() as any[];
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    lotCode: r.lotCode,
    expirationDate: r.expirationDate,
    currentQuantity: r.currentQuantity,
    receivedAt: r.receivedAt,
    createdBy: r.createdBy,
    product: {
      id: r.prod_id,
      barcode: r.prod_barcode,
      name: r.prod_name,
      donorType: r.prod_donorType,
      category: r.prod_category,
      unit: r.prod_unit,
      storageArea: r.prod_storageArea,
      minStock: r.prod_minStock,
      createdAt: r.prod_createdAt,
    },
  }));
}

export function getBatchById(id: string, database: DatabaseSync = getDb()): (InventoryBatch & { product?: Product }) | null {
  const stmt = database.prepare(`
    SELECT 
      b.id, b.productId, b.lotCode, b.expirationDate, b.currentQuantity, b.receivedAt, b.createdBy,
      p.id as prod_id, p.barcode as prod_barcode, p.name as prod_name,
      p.donorType as prod_donorType, p.category as prod_category,
      p.unit as prod_unit, p.storageArea as prod_storageArea,
      p.minStock as prod_minStock, p.createdAt as prod_createdAt
    FROM inventory_batches b
    JOIN products p ON b.productId = p.id
    WHERE b.id = ?
  `);
  const r = stmt.get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    productId: r.productId,
    lotCode: r.lotCode,
    expirationDate: r.expirationDate,
    currentQuantity: r.currentQuantity,
    receivedAt: r.receivedAt,
    createdBy: r.createdBy,
    product: {
      id: r.prod_id,
      barcode: r.prod_barcode,
      name: r.prod_name,
      donorType: r.prod_donorType,
      category: r.prod_category,
      unit: r.prod_unit,
      storageArea: r.prod_storageArea,
      minStock: r.prod_minStock,
      createdAt: r.prod_createdAt,
    },
  };
}

export function getBatchByProductAndLot(
  productId: string,
  lotCode: string,
  database: DatabaseSync = getDb()
): (InventoryBatch & { product?: Product }) | null {
  const cleanLot = (lotCode || '').trim();
  const stmt = database.prepare(`
    SELECT 
      b.id, b.productId, b.lotCode, b.expirationDate, b.currentQuantity, b.receivedAt, b.createdBy,
      p.id as prod_id, p.barcode as prod_barcode, p.name as prod_name,
      p.donorType as prod_donorType, p.category as prod_category,
      p.unit as prod_unit, p.storageArea as prod_storageArea,
      p.minStock as prod_minStock, p.createdAt as prod_createdAt
    FROM inventory_batches b
    JOIN products p ON b.productId = p.id
    WHERE b.productId = ? AND LOWER(TRIM(b.lotCode)) = LOWER(?)
    ORDER BY b.receivedAt DESC
    LIMIT 1
  `);
  const r = stmt.get(productId, cleanLot) as any;
  if (!r) return null;
  return {
    id: r.id,
    productId: r.productId,
    lotCode: r.lotCode,
    expirationDate: r.expirationDate,
    currentQuantity: r.currentQuantity,
    receivedAt: r.receivedAt,
    createdBy: r.createdBy,
    product: {
      id: r.prod_id,
      barcode: r.prod_barcode,
      name: r.prod_name,
      donorType: r.prod_donorType,
      category: r.prod_category,
      unit: r.prod_unit,
      storageArea: r.prod_storageArea,
      minStock: r.prod_minStock,
      createdAt: r.prod_createdAt,
    },
  };
}

export function consolidateBatch(
  id: string,
  addedQuantity: number,
  options?: {
    expirationDate?: string;
    updateExpirationStrategy?: 'earliest' | 'incoming' | 'keep';
  },
  database: DatabaseSync = getDb()
): (InventoryBatch & { product?: Product }) | null {
  const existing = getBatchById(id, database);
  if (!existing) return null;

  const newQuantity = (existing.currentQuantity || 0) + addedQuantity;
  let finalExpirationDate = existing.expirationDate;

  if (options?.expirationDate) {
    const incomingExp = options.expirationDate.trim();
    const strategy = options.updateExpirationStrategy || 'earliest';

    if (strategy === 'earliest') {
      finalExpirationDate =
        existing.expirationDate <= incomingExp
          ? existing.expirationDate
          : incomingExp;
    } else if (strategy === 'incoming') {
      finalExpirationDate = incomingExp;
    } else if (strategy === 'keep') {
      finalExpirationDate = existing.expirationDate;
    }
  }

  updateBatch(
    id,
    {
      currentQuantity: newQuantity,
      expirationDate: finalExpirationDate,
    },
    database
  );

  return getBatchById(id, database);
}

export function createBatch(
  batch: Omit<InventoryBatch, 'receivedAt'> & { receivedAt?: string; createdBy?: string },
  database: DatabaseSync = getDb()
): void {
  const userId = batch.createdBy || 'admin';
  const userCheck = database.prepare('SELECT id FROM users WHERE id = ?');
  if (!userCheck.get(userId)) {
    database.prepare(`
      INSERT OR IGNORE INTO users (id, username, passwordHash, salt, name, role)
      VALUES (?, ?, 'system_hash', 'system_salt', ?, 'admin')
    `).run(userId, userId, userId);
  }

  const stmt = database.prepare(`
    INSERT INTO inventory_batches (id, productId, lotCode, expirationDate, currentQuantity, receivedAt, createdBy)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)
  `);
  stmt.run(
    batch.id,
    batch.productId,
    batch.lotCode,
    batch.expirationDate,
    batch.currentQuantity,
    batch.receivedAt ?? null,
    userId
  );
}

export function updateBatchQuantity(id: string, newQuantity: number, database: DatabaseSync = getDb()): void {
  const stmt = database.prepare('UPDATE inventory_batches SET currentQuantity = ? WHERE id = ?');
  stmt.run(newQuantity, id);
}

export function updateBatch(
  id: string,
  updates: Partial<Pick<InventoryBatch, 'lotCode' | 'expirationDate' | 'currentQuantity' | 'productId'>>,
  database: DatabaseSync = getDb()
): boolean {
  const existing = getBatchById(id, database);
  if (!existing) return false;

  const lotCode = updates.lotCode !== undefined ? updates.lotCode : existing.lotCode;
  const expirationDate = updates.expirationDate !== undefined ? updates.expirationDate : existing.expirationDate;
  const currentQuantity = updates.currentQuantity !== undefined ? updates.currentQuantity : existing.currentQuantity;
  const productId = updates.productId !== undefined ? updates.productId : existing.productId;

  const stmt = database.prepare(`
    UPDATE inventory_batches
    SET lotCode = ?, expirationDate = ?, currentQuantity = ?, productId = ?
    WHERE id = ?
  `);
  stmt.run(lotCode, expirationDate, currentQuantity, productId, id);
  return true;
}

export function deleteBatch(id: string, database: DatabaseSync = getDb()): boolean {
  const stmt = database.prepare('DELETE FROM inventory_batches WHERE id = ?');
  const res = stmt.run(id);
  return Number(res.changes) > 0;
}

export function getAllCommunities(database: DatabaseSync = getDb()): Community[] {
  const stmt = database.prepare('SELECT * FROM communities ORDER BY name ASC');
  return stmt.all() as unknown as Community[];
}

export function getCommunityById(id: string, database: DatabaseSync = getDb()): Community | null {
  const stmt = database.prepare('SELECT * FROM communities WHERE id = ?');
  const result = stmt.get(id);
  return (result as unknown as Community) || null;
}

export function createCommunity(community: Community, database: DatabaseSync = getDb()): void {
  const stmt = database.prepare(`
    INSERT INTO communities (id, name, municipality, latitude, longitude, representativeName, phone, beneficiariesCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    community.id,
    community.name,
    community.municipality,
    community.latitude,
    community.longitude,
    community.representativeName,
    community.phone,
    community.beneficiariesCount
  );
}

export function getAllVehicles(database: DatabaseSync = getDb()): Vehicle[] {
  const stmt = database.prepare('SELECT * FROM vehicles ORDER BY name ASC');
  const rows = stmt.all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    plate: r.plate,
    vehicleType: r.vehicleType,
    maxCapacityKg: r.maxCapacityKg,
    hasRefrigeration: Boolean(r.hasRefrigeration),
  }));
}

export function createVehicle(vehicle: Vehicle, database: DatabaseSync = getDb()): void {
  const stmt = database.prepare(`
    INSERT INTO vehicles (id, name, plate, vehicleType, maxCapacityKg, hasRefrigeration)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    vehicle.id,
    vehicle.name,
    vehicle.plate,
    vehicle.vehicleType,
    vehicle.maxCapacityKg,
    vehicle.hasRefrigeration ? 1 : 0
  );
}

export function getAllRoutes(database: DatabaseSync = getDb()): DispatchRoute[] {
  const stmt = database.prepare('SELECT * FROM dispatch_routes ORDER BY createdAt DESC');
  const rows = stmt.all() as any[];
  return rows.map((r) => ({
    id: r.id,
    routeCode: r.routeCode,
    createdAt: r.createdAt,
    vehicleType: r.vehicleType,
    driverName: r.driverName,
    status: r.status,
    totalDistanceKm: r.totalDistanceKm,
    stops: typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops,
    dispatchedItems: typeof r.dispatchedItems === 'string' ? JSON.parse(r.dispatchedItems) : r.dispatchedItems,
  }));
}

export function getRouteById(id: string, database: DatabaseSync = getDb()): DispatchRoute | null {
  const stmt = database.prepare('SELECT * FROM dispatch_routes WHERE id = ?');
  const r = stmt.get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    routeCode: r.routeCode,
    createdAt: r.createdAt,
    vehicleType: r.vehicleType,
    driverName: r.driverName,
    status: r.status,
    totalDistanceKm: r.totalDistanceKm,
    stops: typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops,
    dispatchedItems: typeof r.dispatchedItems === 'string' ? JSON.parse(r.dispatchedItems) : r.dispatchedItems,
  };
}

export interface DispatchRouteInput {
  id?: string;
  routeCode: string;
  createdAt?: string;
  vehicleType: string;
  driverName: string;
  status: string;
  totalDistanceKm: number;
  stops: RouteStop[] | string;
  dispatchedItems: DispatchedItem[] | string;
}

export interface ItemToDeduct {
  batchId: string;
  quantity: number;
}

/**
 * Executes atomic transaction to register a dispatch route and deduct the dispatched items from inventory batches.
 * If any batch lacks sufficient stock, rolls back completely.
 */
export function dispatchRouteTransaction(
  routeData: DispatchRouteInput,
  itemsToDeduct: ItemToDeduct[],
  database: DatabaseSync = getDb()
): { routeId: string; success: boolean } {
  const routeId = routeData.id || crypto.randomUUID();
  const stopsJson = typeof routeData.stops === 'string' ? routeData.stops : JSON.stringify(routeData.stops);
  const itemsJson = typeof routeData.dispatchedItems === 'string' ? routeData.dispatchedItems : JSON.stringify(routeData.dispatchedItems);

  database.exec('BEGIN IMMEDIATE;');
  try {
    // 1. Verify and deduct each batch
    const checkBatchStmt = database.prepare('SELECT id, currentQuantity FROM inventory_batches WHERE id = ?');
    const updateBatchStmt = database.prepare('UPDATE inventory_batches SET currentQuantity = currentQuantity - ? WHERE id = ?');

    for (const item of itemsToDeduct) {
      const batch = checkBatchStmt.get(item.batchId) as { id: string; currentQuantity: number } | undefined;
      if (!batch) {
        throw new Error(`Lote con ID "${item.batchId}" no existe en el inventario.`);
      }
      if (batch.currentQuantity < item.quantity) {
        throw new Error(
          `Stock insuficiente en lote "${item.batchId}". Cantidad actual: ${batch.currentQuantity}, solicitada para despacho: ${item.quantity}.`
        );
      }
      updateBatchStmt.run(item.quantity, item.batchId);
    }

    // 2. Insert the dispatch route
    const insertRouteStmt = database.prepare(`
      INSERT INTO dispatch_routes (id, routeCode, createdAt, vehicleType, driverName, status, totalDistanceKm, stops, dispatchedItems)
      VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?)
    `);

    insertRouteStmt.run(
      routeId,
      routeData.routeCode,
      routeData.createdAt ?? null,
      routeData.vehicleType,
      routeData.driverName,
      routeData.status,
      routeData.totalDistanceKm,
      stopsJson,
      itemsJson
    );

    database.exec('COMMIT;');
    return { routeId, success: true };
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}

export interface UndoRouteDispatchResult {
  success: boolean;
  routeId: string;
  routeCode: string;
  restoredItemsCount: number;
  restoredUnits: number;
}

export function deleteRoute(id: string, database: DatabaseSync = getDb()): boolean {
  const stmt = database.prepare('DELETE FROM dispatch_routes WHERE id = ?');
  const res = stmt.run(id);
  return Number(res.changes) > 0;
}

/**
 * Reverts an existing dispatch route: restores deducted quantities back to inventory batches,
 * recreates deleted batches if the product still exists, and removes the route from dispatch_routes.
 * Executes atomically in a transaction.
 */
export function undoRouteDispatchTransaction(
  routeId: string,
  database: DatabaseSync = getDb()
): UndoRouteDispatchResult {
  database.exec('BEGIN IMMEDIATE;');
  try {
    const fetchRouteStmt = database.prepare('SELECT * FROM dispatch_routes WHERE id = ?');
    const routeRow = fetchRouteStmt.get(routeId) as any;
    if (!routeRow) {
      throw new Error(`Ruta de despacho con ID "${routeId}" no encontrada.`);
    }

    let items: DispatchedItem[] = [];
    if (typeof routeRow.dispatchedItems === 'string') {
      try {
        items = JSON.parse(routeRow.dispatchedItems);
      } catch {
        items = [];
      }
    } else if (Array.isArray(routeRow.dispatchedItems)) {
      items = routeRow.dispatchedItems;
    }

    const checkBatchStmt = database.prepare('SELECT id, currentQuantity FROM inventory_batches WHERE id = ?');
    const updateBatchStmt = database.prepare('UPDATE inventory_batches SET currentQuantity = currentQuantity + ? WHERE id = ?');
    const checkProductStmt = database.prepare('SELECT id FROM products WHERE id = ?');
    const insertBatchStmt = database.prepare(`
      INSERT INTO inventory_batches (id, productId, lotCode, expirationDate, currentQuantity, receivedAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    let restoredUnits = 0;
    let restoredItemsCount = 0;

    for (const item of items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) continue;

      const existingBatch = checkBatchStmt.get(item.batchId) as { id: string; currentQuantity: number } | undefined;
      if (existingBatch) {
        updateBatchStmt.run(qty, item.batchId);
      } else if (item.productId) {
        const prod = checkProductStmt.get(item.productId);
        if (prod) {
          const checkUserStmt = database.prepare('SELECT id FROM users WHERE id = ?');
          if (!checkUserStmt.get('admin')) {
            database.prepare(`
              INSERT OR IGNORE INTO users (id, username, passwordHash, salt, name, role)
              VALUES ('admin', 'admin', 'system_hash', 'system_salt', 'Administrator', 'admin')
            `).run();
          }
          const fallbackExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          insertBatchStmt.run(
            item.batchId,
            item.productId,
            item.lotCode || 'LOTE-RECUPERADO',
            item.expirationDate || fallbackExp,
            qty
          );
        }
      }

      restoredUnits += qty;
      restoredItemsCount += 1;
    }

    deleteRoute(routeId, database);

    database.exec('COMMIT;');
    return {
      success: true,
      routeId,
      routeCode: routeRow.routeCode,
      restoredItemsCount,
      restoredUnits,
    };
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}

// User Authentication and Management Operations

export function findUserByUsername(db: DatabaseSync, username: string): User | undefined;
export function findUserByUsername(username: string): User | undefined;
export function findUserByUsername(dbOrUsername: DatabaseSync | string, maybeUsername?: string): User | undefined {
  const db = typeof dbOrUsername === 'string' ? getDb() : dbOrUsername;
  const username = typeof dbOrUsername === 'string' ? dbOrUsername : maybeUsername!;
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const row = stmt.get(username) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    salt: row.salt,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export function getUserById(db: DatabaseSync, id: string): User | undefined;
export function getUserById(id: string): User | undefined;
export function getUserById(dbOrId: DatabaseSync | string, maybeId?: string): User | undefined {
  const db = typeof dbOrId === 'string' ? getDb() : dbOrId;
  const id = typeof dbOrId === 'string' ? dbOrId : maybeId!;
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    salt: row.salt,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export function createUser(db: DatabaseSync, user: User): void;
export function createUser(user: User): void;
export function createUser(dbOrUser: DatabaseSync | User, maybeUser?: User): void {
  const isDb = typeof (dbOrUser as any)?.prepare === 'function';
  const db = isDb ? (dbOrUser as DatabaseSync) : getDb();
  const user = isDb ? maybeUser! : (dbOrUser as User);
  const stmt = db.prepare(`
    INSERT INTO users (id, username, passwordHash, salt, name, role, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `);
  stmt.run(
    user.id,
    user.username,
    user.passwordHash,
    user.salt,
    user.name,
    user.role,
    user.createdAt ?? null
  );
}

export function listUsers(db: DatabaseSync = getDb()): Omit<User, 'passwordHash' | 'salt'>[] {
  const stmt = db.prepare('SELECT id, username, name, role, createdAt FROM users ORDER BY createdAt ASC');
  const rows = stmt.all() as any[];
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    createdAt: r.createdAt,
  }));
}

export function deleteUser(db: DatabaseSync, id: string): boolean;
export function deleteUser(id: string): boolean;
export function deleteUser(dbOrId: DatabaseSync | string, maybeId?: string): boolean {
  const db = typeof dbOrId === 'string' ? getDb() : dbOrId;
  const id = typeof dbOrId === 'string' ? dbOrId : maybeId!;
  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  const res = stmt.run(id);
  return Number(res.changes) > 0;
}

