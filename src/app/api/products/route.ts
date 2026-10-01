import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { getAllProducts, getProductByBarcode, createProduct, getFrequentProducts } from '../../../lib/db.ts';
import { normalizeText } from '../../../lib/fefo.ts';
import type { Product, ProductCategory, StorageArea, UnitType } from '../../../types/index';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const barcode = searchParams.get('barcode')?.trim();
    const isFrequent = searchParams.get('frequent') === 'true';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 8;

    if (isFrequent) {
      const frequent = getFrequentProducts(isNaN(limit) || limit <= 0 ? 8 : limit);
      return NextResponse.json(frequent);
    }

    let products = getAllProducts();

    if (barcode) {
      products = products.filter((p) => p.barcode === barcode);
    }

    if (q) {
      const normQ = normalizeText(q);
      products = products.filter((p) => {
        const normName = normalizeText(p.name);
        const normBarcode = normalizeText(p.barcode);
        const normDonor = normalizeText(p.donorType);
        const normCategory = normalizeText(p.category ? p.category.replace(/_/g, ' ') : '');
        return (
          normName.includes(normQ) ||
          normBarcode.includes(normQ) ||
          normDonor.includes(normQ) ||
          normCategory.includes(normQ)
        );
      });
    }

    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener productos' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { barcode, name, donorType, category, unit, storageArea, minStock } = body;

    if (!barcode || !name || !donorType || !category || !unit || !storageArea) {
      return NextResponse.json(
        { error: 'Todos los campos obligatorios deben ser proporcionados (barcode, name, donorType, category, unit, storageArea)' },
        { status: 400 }
      );
    }

    const cleanBarcode = String(barcode).trim();
    const existing = getProductByBarcode(cleanBarcode);
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un producto registrado con el código de barras "${cleanBarcode}"` },
        { status: 409 }
      );
    }

    const newProduct: Product = {
      id: crypto.randomUUID(),
      barcode: cleanBarcode,
      name: String(name).trim(),
      donorType: String(donorType).trim(),
      category: category as ProductCategory,
      unit: unit as UnitType,
      storageArea: storageArea as StorageArea,
      minStock: Number(minStock ?? 0),
      createdAt: new Date().toISOString(),
    };

    createProduct(newProduct);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al crear el producto' },
      { status: 500 }
    );
  }
}
