/**
 * Domain types and models for Fundación Nutrición y Vida A.C. (FNVAC)
 * Inventory FEFO and Logistic Routing System
 */

export type ProductCategory =
  | 'LACTEO_FRIO'
  | 'AGRICOLA_PERECEDERO'
  | 'SECO_ABARROTE'
  | 'NO_ALIMENTARIO';

export type UnitType = 'piezas' | 'kilos' | 'cajas' | 'litros';

export type StorageArea = 'Camara_Fria' | 'Nave_Secos' | 'Anden';

export type FEFOStatus = 'CRITICO' | 'ATENCION' | 'ESTABLE' | 'AGOTADO';

export type VehicleType =
  | 'Torton_ThermoKing'
  | 'Camioneta_3_5T'
  | 'Tractocamion';

export type RouteStatus = 'Planificada' | 'En_Transito' | 'Completada';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  donorType: string;
  category: ProductCategory;
  unit: UnitType;
  storageArea: StorageArea;
  minStock: number;
  createdAt: string;
}

export interface InventoryBatch {
  id: string;
  productId: string;
  lotCode: string;
  expirationDate: string;
  currentQuantity: number;
  receivedAt: string;
  status?: FEFOStatus;
  daysRemaining?: number;
  product?: Product;
  createdBy?: string;
}

export interface Community {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  representativeName: string;
  phone: string;
  beneficiariesCount: number;
}

export interface RouteStop {
  communityId: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  order: number;
  phone?: string;
  representativeName?: string;
  beneficiariesCount?: number;
}

export interface DispatchedItem {
  batchId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: UnitType;
  lotCode?: string;
  expirationDate?: string;
  donor?: string;
  category?: ProductCategory;
  weightKg?: number;
}

export interface DispatchRoute {
  id: string;
  routeCode: string;
  createdAt: string;
  vehicleType: VehicleType;
  driverName: string;
  status: RouteStatus;
  totalDistanceKm: number;
  stops: RouteStop[] | string;
  dispatchedItems: DispatchedItem[] | string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  vehicleType: VehicleType;
  maxCapacityKg: number;
  hasRefrigeration: boolean;
}

export interface InventoryKPIs {
  totalQuantity: number;
  criticalBatchesCount: number;
  warningBatchesCount: number;
  stableBatchesCount: number;
  coldRoomCount: number;
  dryStorageCount: number;
  exhaustedBatchesCount: number;
}

export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  expiresAt: number;
}
