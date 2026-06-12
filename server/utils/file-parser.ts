import * as XLSX from 'xlsx';

export interface ParsedCard {
  pin: string;
  serialNumber: string | null;
  rowNumber: number;
}

export interface ParseResult {
  cards: ParsedCard[];
  errors: Array<{ rowNumber: number; error: string }>;
  totalRows: number;
}

/**
 * Parse CSV content and extract card data
 * Format: PIN or PIN,SerialNumber
 */
export function parseCSV(csvContent: string): ParseResult {
  const lines = csvContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const cards: ParsedCard[] = [];
  const errors: Array<{ rowNumber: number; error: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const rowNumber = i + 1;
    const line = lines[i];
    const parts = line.split(',').map((p) => p.trim());

    const pin          = parts[0];
    const serialNumber = parts[1]?.trim() || null;

    // Validate PIN
    if (!pin || pin.length === 0) {
      errors.push({ rowNumber, error: 'PIN is required' });
      continue;
    }

    // Serial number is required
    if (!serialNumber) {
      errors.push({ rowNumber, error: 'Serial number is required' });
      continue;
    }

    // Validate serial number length
    if (serialNumber.length > 128) {
      errors.push({ rowNumber, error: 'Serial number exceeds 128 characters' });
      continue;
    }

    cards.push({ pin, serialNumber, rowNumber });
  }

  return {
    cards,
    errors,
    totalRows: lines.length,
  };
}

/**
 * Parse XLSX file and extract card data
 * First worksheet only, header row required
 * Columns: PIN, Serial Number
 */
export function parseXLSX(buffer: Buffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        cards: [],
        errors: [{ rowNumber: 0, error: 'Excel file is empty' }],
        totalRows: 0,
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    }) as string[][];

    if (rows.length === 0) {
      return {
        cards: [],
        errors: [{ rowNumber: 0, error: 'Excel file is empty' }],
        totalRows: 0,
      };
    }

    // First row is header
    const headerRow = rows[0];
    const pinColumnIndex = headerRow.findIndex(
      (h) => h.toLowerCase() === 'pin'
    );
    const serialColumnIndex = headerRow.findIndex(
      (h) => h.toLowerCase() === 'serial number'
    );

    if (pinColumnIndex === -1) {
      return {
        cards: [],
        errors: [{ rowNumber: 0, error: 'PIN column is required. Expected columns: PIN, Serial Number' }],
        totalRows: rows.length,
      };
    }

    if (serialColumnIndex === -1) {
      return {
        cards: [],
        errors: [{ rowNumber: 0, error: 'Serial Number column is required. Expected columns: PIN, Serial Number' }],
        totalRows: rows.length,
      };
    }

    const cards: ParsedCard[] = [];
    const errors: Array<{ rowNumber: number; error: string }> = [];

    // Process data rows (skip header)
    for (let i = 1; i < rows.length; i++) {
      const rowNumber = i + 1; // 1-indexed for user display
      const row = rows[i];

      // Skip completely empty rows
      if (!row || row.every((cell) => !cell || cell.toString().trim() === '')) {
        continue;
      }

      const pin = (row[pinColumnIndex] || '').toString().trim();
      const serialNumber =
        serialColumnIndex !== -1
          ? (row[serialColumnIndex] || '').toString().trim()
          : '';

      // Validate PIN
      if (!pin || pin.length === 0) {
        errors.push({ rowNumber, error: 'PIN is required' });
        continue;
      }

      // Serial number is required
      if (!serialNumber) {
        errors.push({ rowNumber, error: 'Serial number is required' });
        continue;
      }

      // Validate serial number length
      if (serialNumber.length > 128) {
        errors.push({ rowNumber, error: 'Serial number exceeds 128 characters' });
        continue;
      }

      cards.push({ pin, serialNumber, rowNumber });
    }

    return {
      cards,
      errors,
      totalRows: rows.length,
    };
  } catch (error) {
    return {
      cards: [],
      errors: [
        {
          rowNumber: 0,
          error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      totalRows: 0,
    };
  }
}

/**
 * Generate Excel template buffer
 * Includes header and 2 example rows only (no empty rows)
 */
export function generateExcelTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['PIN', 'Serial Number'],
  ]);

  // Set column widths and freeze header row
  worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }];
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }; // Freeze header row

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
