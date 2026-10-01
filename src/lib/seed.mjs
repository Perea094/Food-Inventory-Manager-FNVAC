#!/usr/bin/env node
import { getDb } from './db.ts';
import { hashPassword } from './auth.ts';

function getRelativeDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const SEED_PRODUCTS = [
  {
    id: 'prod-001',
    barcode: '7501020511111',
    name: 'Leche Entera UHT 1L Cuadritos',
    donorType: 'Cuadritos',
    category: 'LACTEO_FRIO',
    unit: 'litros',
    storageArea: 'Camara_Fria',
    minStock: 100,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-002',
    barcode: '7501020522222',
    name: 'Queso Panela 400g Cuadritos',
    donorType: 'Cuadritos',
    category: 'LACTEO_FRIO',
    unit: 'piezas',
    storageArea: 'Camara_Fria',
    minStock: 50,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-003',
    barcode: '7501020533333',
    name: 'Yogur Natural 1L Cuadritos',
    donorType: 'Cuadritos',
    category: 'LACTEO_FRIO',
    unit: 'litros',
    storageArea: 'Camara_Fria',
    minStock: 40,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-004',
    barcode: '7501020544444',
    name: 'Bebida de Soya Nutrivida 1L',
    donorType: 'Nutrivida',
    category: 'LACTEO_FRIO',
    unit: 'litros',
    storageArea: 'Camara_Fria',
    minStock: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-005',
    barcode: '7501020555555',
    name: 'Brócoli Fresco a Granel',
    donorType: 'Campo del Bajío',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    storageArea: 'Anden',
    minStock: 200,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-006',
    barcode: '7501020566666',
    name: 'Zanahoria Fresca a Granel',
    donorType: 'Campo del Bajío',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    storageArea: 'Anden',
    minStock: 200,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-007',
    barcode: '7501020577777',
    name: 'Arroz Grano Grueso 1kg',
    donorType: 'Donación Central',
    category: 'SECO_ABARROTE',
    unit: 'kilos',
    storageArea: 'Nave_Secos',
    minStock: 150,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-008',
    barcode: '7501020588888',
    name: 'Frijol Negro 1kg',
    donorType: 'Donación Central',
    category: 'SECO_ABARROTE',
    unit: 'kilos',
    storageArea: 'Nave_Secos',
    minStock: 150,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-009',
    barcode: '7501020599999',
    name: 'Aceite Vegetal 1L',
    donorType: 'Donación Central',
    category: 'SECO_ABARROTE',
    unit: 'litros',
    storageArea: 'Nave_Secos',
    minStock: 100,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-010',
    barcode: '7501020500000',
    name: 'Mochila Escolar con Útiles',
    donorType: 'Campaña Escolar',
    category: 'NO_ALIMENTARIO',
    unit: 'piezas',
    storageArea: 'Nave_Secos',
    minStock: 20,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-011',
    barcode: '7501020577111',
    name: 'Jitomate Bola Fresco',
    donorType: 'Campo del Bajío',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    storageArea: 'Anden',
    minStock: 150,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-012',
    barcode: '7501020577222',
    name: 'Lechuga Romana Fresca',
    donorType: 'Campo del Bajío',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'piezas',
    storageArea: 'Anden',
    minStock: 100,
    createdAt: new Date().toISOString(),
  },
];

export function getSeedBatches() {
  return [
    // 4 CRITICOS (Vencimiento en 2 días)
    {
      id: 'batch-001',
      productId: 'prod-002', // Queso Panela
      lotCode: 'LT-QP-2401',
      expirationDate: getRelativeDate(2),
      currentQuantity: 85,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-002',
      productId: 'prod-003', // Yogur Natural
      lotCode: 'LT-YN-2401',
      expirationDate: getRelativeDate(2),
      currentQuantity: 60,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-003',
      productId: 'prod-005', // Brócoli Fresco
      lotCode: 'LT-BR-2401',
      expirationDate: getRelativeDate(2),
      currentQuantity: 320,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-004',
      productId: 'prod-001', // Leche Entera
      lotCode: 'LT-LE-2401',
      expirationDate: getRelativeDate(2),
      currentQuantity: 150,
      receivedAt: new Date().toISOString(),
    },

    // 4 ATENCION (Vencimiento en 5 días)
    {
      id: 'batch-005',
      productId: 'prod-005', // Brócoli Lote 2
      lotCode: 'LT-BR-2402',
      expirationDate: getRelativeDate(5),
      currentQuantity: 450,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-006',
      productId: 'prod-006', // Zanahoria Lote 1
      lotCode: 'LT-ZN-2401',
      expirationDate: getRelativeDate(5),
      currentQuantity: 500,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-007',
      productId: 'prod-002', // Queso Panela Lote 2
      lotCode: 'LT-QP-2402',
      expirationDate: getRelativeDate(5),
      currentQuantity: 110,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-008',
      productId: 'prod-004', // Bebida Nutrivida
      lotCode: 'LT-BN-2401',
      expirationDate: getRelativeDate(5),
      currentQuantity: 220,
      receivedAt: new Date().toISOString(),
    },

    // 4 ESTABLES (Vencimiento en 30-180 días)
    {
      id: 'batch-009',
      productId: 'prod-007', // Arroz
      lotCode: 'LT-AR-2401',
      expirationDate: getRelativeDate(60),
      currentQuantity: 800,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-010',
      productId: 'prod-008', // Frijol
      lotCode: 'LT-FN-2401',
      expirationDate: getRelativeDate(90),
      currentQuantity: 750,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-011',
      productId: 'prod-009', // Aceite
      lotCode: 'LT-AV-2401',
      expirationDate: getRelativeDate(120),
      currentQuantity: 400,
      receivedAt: new Date().toISOString(),
    },
    {
      id: 'batch-012',
      productId: 'prod-010', // Mochilas
      lotCode: 'LT-ME-2401',
      expirationDate: getRelativeDate(180),
      currentQuantity: 120,
      receivedAt: new Date().toISOString(),
    },
  ];
}

export const SEED_COMMUNITIES = [
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

export const SEED_VEHICLES = [
  {
    id: 'veh-001',
    name: 'Torton Thermo King #1',
    plate: 'GT-4821-C',
    vehicleType: 'Torton_ThermoKing',
    maxCapacityKg: 12000,
    hasRefrigeration: 1,
  },
  {
    id: 'veh-002',
    name: 'Camioneta 3.5 Ton Reparto',
    plate: 'GT-1092-B',
    vehicleType: 'Camioneta_3_5T',
    maxCapacityKg: 3500,
    hasRefrigeration: 0,
  },
];

const adminAuth = hashPassword('admin123');
const opAuth = hashPassword('operador123');

export const SEED_USERS = [
  {
    id: 'admin',
    username: 'admin',
    name: 'Coordinador CEDIS Celaya',
    passwordHash: adminAuth.hash,
    salt: adminAuth.salt,
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'operador',
    username: 'operador',
    name: 'Operador de Almacén',
    passwordHash: opAuth.hash,
    salt: opAuth.salt,
    role: 'operator',
    createdAt: new Date().toISOString(),
  },
];

export function runSeed(targetDb = getDb()) {
  targetDb.exec('BEGIN IMMEDIATE;');
  try {
    targetDb.exec('DELETE FROM dispatch_routes;');
    targetDb.exec('DELETE FROM inventory_batches;');
    targetDb.exec('DELETE FROM products;');
    targetDb.exec('DELETE FROM communities;');
    targetDb.exec('DELETE FROM vehicles;');

    const checkUserStmt = targetDb.prepare('SELECT id, passwordHash FROM users WHERE username = ?');
    const insertUserStmt = targetDb.prepare(`
      INSERT INTO users (id, username, passwordHash, salt, name, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const updateUserStmt = targetDb.prepare(`
      UPDATE users SET passwordHash = ?, salt = ?, name = ?, role = ? WHERE id = ?
    `);

    for (const u of SEED_USERS) {
      const existing = checkUserStmt.get(u.username);
      if (!existing) {
        insertUserStmt.run(u.id, u.username, u.passwordHash, u.salt, u.name, u.role, u.createdAt ?? null);
      } else if (existing.passwordHash === 'system_hash') {
        updateUserStmt.run(u.passwordHash, u.salt, u.name, u.role, existing.id);
      }
    }

    const insertProduct = targetDb.prepare(`
      INSERT INTO products (id, barcode, name, donorType, category, unit, storageArea, minStock, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SEED_PRODUCTS) {
      insertProduct.run(p.id, p.barcode, p.name, p.donorType, p.category, p.unit, p.storageArea, p.minStock, p.createdAt);
    }

    const seedBatches = getSeedBatches();
    const insertBatch = targetDb.prepare(`
      INSERT INTO inventory_batches (id, productId, lotCode, expirationDate, currentQuantity, receivedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const b of seedBatches) {
      insertBatch.run(b.id, b.productId, b.lotCode, b.expirationDate, b.currentQuantity, b.receivedAt);
    }

    const insertCommunity = targetDb.prepare(`
      INSERT INTO communities (id, name, municipality, latitude, longitude, representativeName, phone, beneficiariesCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of SEED_COMMUNITIES) {
      insertCommunity.run(c.id, c.name, c.municipality, c.latitude, c.longitude, c.representativeName, c.phone, c.beneficiariesCount);
    }

    const insertVehicle = targetDb.prepare(`
      INSERT INTO vehicles (id, name, plate, vehicleType, maxCapacityKg, hasRefrigeration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const v of SEED_VEHICLES) {
      insertVehicle.run(v.id, v.name, v.plate, v.vehicleType, v.maxCapacityKg, v.hasRefrigeration);
    }

    targetDb.exec('COMMIT;');
    return {
      productsCount: SEED_PRODUCTS.length,
      batchesCount: seedBatches.length,
      communitiesCount: SEED_COMMUNITIES.length,
      vehiclesCount: SEED_VEHICLES.length,
      usersCount: SEED_USERS.length,
    };
  } catch (error) {
    targetDb.exec('ROLLBACK;');
    throw error;
  }
}

try {
  console.log('🌱 Sembrando base de datos SQLite para Fundación Nutrición y Vida A.C...');
  const db = getDb();
  const results = runSeed(db);
  console.log('✅ Base de datos inicializada y sembrada con éxito:');
  console.log(`   - ${results.productsCount} Productos del catálogo FNVAC`);
  console.log(`   - ${results.batchesCount} Lotes de inventario (4 Críticos, 4 Atención, 4 Estables)`);
  console.log(`   - ${results.communitiesCount} Comunidades beneficiarias de la región Celaya`);
  console.log(`   - ${results.vehiclesCount} Vehículos logísticos`);
  console.log(`   - ${results.usersCount} Usuarios del sistema (admin, operador)`);
} catch (err) {
  console.error('❌ Error al sembrar base de datos:', err);
  process.exit(1);
}
