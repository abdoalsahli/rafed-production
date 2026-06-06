import { describe, it, expect } from 'vitest';
import { parseCSV, parseXLSX, generateExcelTemplate } from './file-parser';
import XLSX from 'xlsx';

describe('File Parser', () => {
  describe('parseCSV', () => {
    it('should parse CSV with PIN only', () => {
      const csv = 'PIN123456789\nPIN987654321';
      const result = parseCSV(csv);

      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].pin).toBe('PIN123456789');
      expect(result.cards[0].serialNumber).toBeNull();
      expect(result.cards[1].pin).toBe('PIN987654321');
    });

    it('should parse CSV with PIN and Serial Number', () => {
      const csv = 'PIN123456789,SN-001\nPIN987654321,SN-002';
      const result = parseCSV(csv);

      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].pin).toBe('PIN123456789');
      expect(result.cards[0].serialNumber).toBe('SN-001');
      expect(result.cards[1].pin).toBe('PIN987654321');
      expect(result.cards[1].serialNumber).toBe('SN-002');
    });

    it('should skip empty lines', () => {
      const csv = 'PIN123456789\n\nPIN987654321\n';
      const result = parseCSV(csv);

      expect(result.cards).toHaveLength(2);
    });

    it('should handle missing PIN', () => {
      const csv = ',SN-001\nPIN123456789,SN-002';
      const result = parseCSV(csv);

      expect(result.cards).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('PIN is required');
    });

    it('should handle serial number exceeding 128 characters', () => {
      const longSerial = 'a'.repeat(129);
      const csv = `PIN123456789,${longSerial}`;
      const result = parseCSV(csv);

      expect(result.cards).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Serial number exceeds 128 characters');
    });
  });

  describe('parseXLSX', () => {
    it('should parse XLSX with PIN only', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['PIN123456789', ''],
        ['PIN987654321', ''],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].pin).toBe('PIN123456789');
      expect(result.cards[0].serialNumber).toBeNull();
    });

    it('should parse XLSX with PIN and Serial Number', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['PIN123456789', 'SN-001'],
        ['PIN987654321', 'SN-002'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].pin).toBe('PIN123456789');
      expect(result.cards[0].serialNumber).toBe('SN-001');
    });

    it('should skip empty rows in XLSX', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['PIN123456789', 'SN-001'],
        ['', ''],
        ['PIN987654321', 'SN-002'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing PIN column', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Serial Number'],
        ['SN-001'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(0);
      expect(result.errors[0].error).toContain('PIN column is required');
    });

    it('should handle serial number exceeding 128 characters', () => {
      const longSerial = 'a'.repeat(129);
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['PIN123456789', longSerial],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(0);
      expect(result.errors[0].error).toContain('Serial number exceeds 128 characters');
    });
  });

  describe('generateExcelTemplate', () => {
    it('should have correct structure', () => {
      const buffer = generateExcelTemplate();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as string[][];

      // Should have only header row (no example data)
      expect(rows.length).toBe(1);

      // Header row
      expect(rows[0][0]).toBe('PIN');
      expect(rows[0][1]).toBe('Serial Number');
    });

    it('should generate template that parses correctly', () => {
      const buffer = generateExcelTemplate();
      const result = parseXLSX(buffer);

      // Should have no cards (header only)
      expect(result.cards).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(1);
    });

    it('should not include empty rows in generated template', () => {
      const buffer = generateExcelTemplate();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as string[][];

      // Verify only header row (1 row total)
      expect(rows.length).toBe(1);

      // Header row should have content
      expect(rows[0].some((cell) => cell && cell.toString().trim() !== '')).toBe(true);
    });
  });
});
