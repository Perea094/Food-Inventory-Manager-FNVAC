export interface BulkProduceShortcut {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
  emoji: string;
}

export const BULK_PRODUCE_SHORTCUTS: BulkProduceShortcut[] = [
  {
    id: 'bulk-brocoli',
    name: 'Brócoli Fresco',
    barcode: '7501020555555',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    emoji: '🥦',
  },
  {
    id: 'bulk-zanahoria',
    name: 'Zanahoria Fresca',
    barcode: '7501020566666',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    emoji: '🥕',
  },
  {
    id: 'bulk-jitomate',
    name: 'Jitomate Bola',
    barcode: '7501020577111',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    emoji: '🍅',
  },
  {
    id: 'bulk-lechuga',
    name: 'Lechuga Romana',
    barcode: '7501020577222',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'piezas',
    emoji: '🥬',
  },
];

/**
 * Generates an internal barcode identifier for items lacking physical barcodes
 */
export function generateInternalBarcode(): string {
  return `INT-${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
}

