-- Fundación Nutrición y Vida A.C. (FNVAC)
-- SQLite Database Schema for Inventory & Logistics System

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
