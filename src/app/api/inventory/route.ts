import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import {
  getAllBatches,
  getBatchById,
  getProductById,
  createBatch,
  getAllProducts,
  getBatchByProductAndLot,
  consolidateBatch,
} from '../../../lib/db.ts';
import {
  calculateDaysRemaining,
  getFEFOStatus,
  isAlreadyExpired,
  sortBatchesFEFO,
  calculateInventoryKPIs,
} from '../../../lib/fefo.ts';
import { getSessionFromRequest } from '../../../lib/auth.ts';
import type { FEFOStatus, ProductCategory, StorageArea } from '../../../types/index';

export const dynamic = 'force-dynamic';

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchDonor(productDonor: string, queryDonor: string): boolean {
  if (!productDonor || !queryDonor) return false;
  const normProd = normalizeText(productDonor);
  const normQuery = normalizeText(queryDonor);

  if (normProd === normQuery) return true;
  if (normProd.includes(normQuery) || normQuery.includes(normProd)) return true;

  const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e']);
  const prodTokens = normProd
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const queryTokens = normQuery
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  return queryTokens.some((q) =>
    prodTokens.some((p) => p.includes(q) || q.includes(p))
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get('search')?.trim();
    const search = rawSearch ? normalizeText(rawSearch) : null;
    const category = searchParams.get('category')?.trim() as ProductCategory | null;
    const donor = searchParams.get('donor')?.trim();
    const storageArea = searchParams.get('storageArea')?.trim() as StorageArea | null;
    const status = searchParams.get('status')?.trim() as FEFOStatus | null;
    const hideExhausted = searchParams.get('hideExhausted') === 'true';
    const myShift = searchParams.get('myShift') === 'true';
    const session = getSessionFromRequest(req);

    const rawBatches = getAllBatches();

    // Enrich with FEFO fields
    const enrichedBatches = rawBatches.map((b) => {
      const daysRemaining = calculateDaysRemaining(b.expirationDate);
      const batchStatus = getFEFOStatus(daysRemaining, b.currentQuantity);
      return {
        ...b,
        daysRemaining,
        status: batchStatus,
      };
    });

    // Compute warehouse-wide global KPIs on enrichedBatches BEFORE applying filters
    const kpis = calculateInventoryKPIs(enrichedBatches);

    // Compute global warehouse master metadata from all products in catalog
    const allProducts = getAllProducts();
    const allDonors = Array.from(
      new Set(allProducts.map((p) => p.donorType).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
    const allCategories: ProductCategory[] = [
      'LACTEO_FRIO',
      'AGRICOLA_PERECEDERO',
      'SECO_ABARROTE',
      'NO_ALIMENTARIO',
    ];
    const allStorageAreas: StorageArea[] = ['Camara_Fria', 'Nave_Secos', 'Anden'];

    let batches = [...enrichedBatches];

    // Apply filters
    if (search) {
      batches = batches.filter(
        (b) =>
          normalizeText(b.lotCode).includes(search) ||
          (b.product?.name && normalizeText(b.product.name).includes(search)) ||
          (b.product?.barcode && normalizeText(b.product.barcode).includes(search))
      );
    }

    if (category) {
      batches = batches.filter((b) => b.product?.category === category);
    }

    if (donor) {
      batches = batches.filter(
        (b) => b.product?.donorType && matchDonor(b.product.donorType, donor)
      );
    }

    if (storageArea) {
      batches = batches.filter((b) => b.product?.storageArea === storageArea);
    }

    if (status) {
      batches = batches.filter((b) => b.status === status);
    }

    if (hideExhausted && status !== 'AGOTADO') {
      batches = batches.filter(
        (b) => (b.currentQuantity ?? 0) > 0 && b.status !== 'AGOTADO'
      );
    }

    if (myShift) {
      batches = session ? batches.filter((b) => b.createdBy === session.userId) : [];
    }

    // Sort by FEFO (earliest expiration first, with stock prioritized over exhausted)
    batches = sortBatchesFEFO(batches);

    return NextResponse.json({
      batches,
      kpis,
      totalBatchesCount: enrichedBatches.length,
      filteredBatchesCount: batches.length,
      allDonors,
      allCategories,
      allStorageAreas,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al consultar inventario' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req);
    const createdBy = session?.userId || 'admin';

    const body = await req.json();
    const {
      productId,
      lotCode,
      expirationDate,
      currentQuantity,
      forceReject,
      action,
      consolidate,
      allowDuplicate,
      updateExpirationStrategy,
    } = body;

    // Fast pre-check endpoint to see if a batch exists before submitting
    if (action === 'check') {
      if (!productId || !lotCode) {
        return NextResponse.json(
          { error: 'Campos requeridos para verificación: productId, lotCode' },
          { status: 400 }
        );
      }
      const cleanLot = String(lotCode).trim();
      const existingBatch = getBatchByProductAndLot(productId, cleanLot);
      const enrichedExisting = existingBatch
        ? {
            ...existingBatch,
            daysRemaining: calculateDaysRemaining(existingBatch.expirationDate),
            status: getFEFOStatus(
              calculateDaysRemaining(existingBatch.expirationDate),
              existingBatch.currentQuantity
            ),
          }
        : null;

      return NextResponse.json({
        duplicateFound: !!existingBatch,
        existingBatch: enrichedExisting,
      });
    }

    if (!productId || !lotCode || !expirationDate || currentQuantity === undefined) {
      return NextResponse.json(
        { error: 'Campos obligatorios requeridos: productId, lotCode, expirationDate, currentQuantity' },
        { status: 400 }
      );
    }

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { error: `No se encontró el producto con ID "${productId}"` },
        { status: 404 }
      );
    }

    const qty = Number(currentQuantity);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json(
        { error: 'La cantidad actual debe ser un número mayor o igual a 0' },
        { status: 400 }
      );
    }

    const expDate = new Date(expirationDate);
    if (isNaN(expDate.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha de caducidad inválido. Use AAAA-MM-DD' },
        { status: 400 }
      );
    }

    const expired = isAlreadyExpired(expirationDate);
    if (expired && forceReject === true) {
      return NextResponse.json(
        { error: 'Lote rechazado: la fecha de caducidad ya ha vencido' },
        { status: 400 }
      );
    }

    const cleanLot = String(lotCode).trim();
    const existingBatch = getBatchByProductAndLot(productId, cleanLot);

    if (existingBatch) {
      const existingDaysRemaining = calculateDaysRemaining(existingBatch.expirationDate);
      const existingStatus = getFEFOStatus(existingDaysRemaining, existingBatch.currentQuantity);
      const enrichedExisting = {
        ...existingBatch,
        daysRemaining: existingDaysRemaining,
        status: existingStatus,
      };

      // 1. Consolidation requested
      if (action === 'consolidate' || consolidate === true) {
        const updated = consolidateBatch(existingBatch.id, qty, {
          expirationDate: String(expirationDate).trim(),
          updateExpirationStrategy,
        });

        if (!updated) {
          return NextResponse.json(
            { error: 'No se pudo consolidar el lote existente' },
            { status: 500 }
          );
        }

        const daysRemaining = calculateDaysRemaining(updated.expirationDate);
        const status = getFEFOStatus(daysRemaining, updated.currentQuantity);

        return NextResponse.json(
          {
            ...updated,
            consolidated: true,
            previousQuantity: existingBatch.currentQuantity,
            addedQuantity: qty,
            daysRemaining,
            status,
            message: `Se sumaron ${qty} ${product.unit} al lote ${cleanLot}. Nueva existencia total en bodega: ${updated.currentQuantity} ${product.unit}`,
          },
          { status: 200 }
        );
      }

      // 2. Collision detected and no explicit instruction -> 409 Conflict
      if (!action && !consolidate && !allowDuplicate && action !== 'create_new') {
        return NextResponse.json(
          {
            error: 'Lote existente detectado',
            duplicateDetected: true,
            existingBatch: enrichedExisting,
            message: `Ya existe un lote registrado con el código "${cleanLot}" para este producto (${existingBatch.currentQuantity} ${product.unit}). ¿Desea consolidar las existencias o crear una entrada independiente?`,
          },
          { status: 409 }
        );
      }

      // 3. If action === 'create_new' || allowDuplicate === true -> continue below to create separate batch
    }

    // Insert new batch
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();

    createBatch({
      id,
      productId,
      lotCode: cleanLot,
      expirationDate: String(expirationDate).trim(),
      currentQuantity: qty,
      receivedAt,
      createdBy,
    });

    const created = getBatchById(id);
    const daysRemaining = calculateDaysRemaining(created!.expirationDate);
    const status = getFEFOStatus(daysRemaining, created!.currentQuantity);

    const responsePayload = {
      ...created,
      daysRemaining,
      status,
      ...(existingBatch ? { isDuplicateLot: true, consolidated: false } : {}),
      ...(expired ? { warning: 'Lote ingresado con fecha de caducidad vencida' } : {}),
    };

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al recepcionar lote' },
      { status: 500 }
    );
  }
}
