import { NextResponse } from 'next/server.js';
import { generateTemplateWorkbook } from '../../../../lib/excel.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const buffer = generateTemplateWorkbook();

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla_captura_fnvac.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al generar la plantilla de Excel' },
      { status: 500 }
    );
  }
}
