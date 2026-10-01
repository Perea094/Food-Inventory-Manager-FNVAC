import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { getProductByBarcode, createProduct, createBatch } from '../../../../lib/db.ts';
import { parseInventoryFile } from '../../../../lib/excel.ts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'No se ha proporcionado ningún archivo en el campo "file"' },
        { status: 400 }
      );
    }

    const fileObj = file as File;
    const arrayBuffer = await fileObj.arrayBuffer();
    const { validRows, errors } = parseInventoryFile(arrayBuffer);

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          processedCount: 0,
          errors: errors.length > 0 ? errors : ['El archivo no contiene filas de inventario válidas para procesar.'],
        },
        { status: 400 }
      );
    }

    let insertedBatchesCount = 0;

    for (const row of validRows) {
      // 1. Find or create product
      let product = getProductByBarcode(row.barcode);
      let productId = product?.id;

      if (!product) {
        productId = crypto.randomUUID();
        createProduct({
          id: productId,
          barcode: row.barcode,
          name: row.name,
          donorType: row.donorType,
          category: row.category,
          unit: row.unit,
          storageArea: row.storageArea,
          minStock: 0,
        });
      }

      // 2. Insert batch
      const batchId = crypto.randomUUID();
      createBatch({
        id: batchId,
        productId: productId!,
        lotCode: row.lotCode,
        expirationDate: row.expirationDate,
        currentQuantity: row.quantity,
      });

      insertedBatchesCount++;
    }

    return NextResponse.json({
      success: true,
      processedCount: insertedBatchesCount,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al procesar el archivo Excel' },
      { status: 500 }
    );
  }
}
