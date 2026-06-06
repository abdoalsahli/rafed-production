import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseCSV, parseXLSX, generateExcelTemplate } from '../utils/file-parser';
import * as XLSX from 'xlsx';

describe('Excel Upload Support', () => {
  describe('Test 1: CSV with PIN only', () => {
    it('should parse CSV with PIN column only', () => {
      const csvContent = `1234567890
ABCD-1234-EFGH
9876543210`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.cards[0]).toEqual({
        pin: '1234567890',
        serialNumber: null,
        rowNumber: 1,
      });
      expect(result.cards[1]).toEqual({
        pin: 'ABCD-1234-EFGH',
        serialNumber: null,
        rowNumber: 2,
      });
    });
  });

  describe('Test 2: CSV with PIN + Serial Number', () => {
    it('should parse CSV with PIN and Serial Number columns', () => {
      const csvContent = `1234567890,SN-000001
ABCD-1234-EFGH,SN-000002
9876543210,SN-000003`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.cards[0]).toEqual({
        pin: '1234567890',
        serialNumber: 'SN-000001',
        rowNumber: 1,
      });
      expect(result.cards[1].serialNumber).toBe('SN-000002');
    });
  });

  describe('Test 3: XLSX with PIN only', () => {
    it('should parse XLSX with PIN column only', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN'],
        ['1234567890'],
        ['ABCD-1234-EFGH'],
        ['9876543210'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.cards[0].pin).toBe('1234567890');
      expect(result.cards[0].serialNumber).toBeNull();
    });
  });

  describe('Test 4: XLSX with PIN + Serial Number', () => {
    it('should parse XLSX with PIN and Serial Number columns', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['1234567890', 'SN-000001'],
        ['ABCD-1234-EFGH', 'SN-000002'],
        ['9876543210', 'SN-000003'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.cards[0]).toEqual({
        pin: '1234567890',
        serialNumber: 'SN-000001',
        rowNumber: 2,
      });
    });
  });

  describe('Test 5: XLSX missing PIN column', () => {
    it('should reject XLSX without PIN column', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Serial Number'],
        ['SN-000001'],
        ['SN-000002'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('PIN column is required');
    });
  });

  describe('Test 6: XLSX serial number longer than 128 chars', () => {
    it('should reject serial numbers exceeding 128 characters', () => {
      const longSerial = 'A'.repeat(129);
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['1234567890', longSerial],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('exceeds 128 characters');
    });
  });

  describe('Test 7: XLSX with empty rows', () => {
    it('should ignore completely empty rows', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['PIN', 'Serial Number'],
        ['1234567890', 'SN-000001'],
        ['', ''], // Empty row
        ['ABCD-1234-EFGH', 'SN-000002'],
        ['', ''], // Another empty row
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.cards[0].pin).toBe('1234567890');
      expect(result.cards[1].pin).toBe('ABCD-1234-EFGH');
    });
  });

  describe('Test 8: Excel template generation', () => {
    it('should generate valid Excel template', () => {
      const buffer = generateExcelTemplate();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a valid Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Cards');

      const worksheet = workbook.Sheets['Cards'];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Check header
      expect(data[0]).toContain('PIN');
      expect(data[0]).toContain('Serial Number');

      // Check example rows
      expect(data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Test 9: CSV with mixed valid and invalid rows', () => {
    it('should report errors for invalid rows', () => {
      const csvContent = `1234567890,SN-000001
,SN-000002
ABCD-1234-EFGH,SN-000003`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(2); // Only valid rows
      expect(result.errors).toHaveLength(1); // One error for empty PIN
      expect(result.errors[0].rowNumber).toBe(2);
      expect(result.errors[0].error).toContain('PIN is required');
    });
  });

  describe('Test 10: Whitespace trimming', () => {
    it('should trim whitespace from PIN and Serial Number', () => {
      const csvContent = `  1234567890  ,  SN-000001  
ABCD-1234-EFGH,SN-000002`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].pin).toBe('1234567890');
      expect(result.cards[0].serialNumber).toBe('SN-000001');
    });
  });

  describe('Test 11: CSV with empty lines', () => {
    it('should skip empty lines in CSV', () => {
      const csvContent = `1234567890,SN-000001

ABCD-1234-EFGH,SN-000002

9876543210,SN-000003`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Test 12: CSV with only serial number (missing PIN)', () => {
    it('should reject rows with missing PIN', () => {
      const csvContent = `,SN-000001
1234567890,SN-000002`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rowNumber).toBe(1);
    });
  });

  describe('Test 13: XLSX case-insensitive column matching', () => {
    it('should match PIN and Serial Number columns case-insensitively', () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['pin', 'serial number'], // lowercase
        ['1234567890', 'SN-000001'],
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = parseXLSX(buffer);

      expect(result.cards).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.cards[0].pin).toBe('1234567890');
    });
  });

  describe('Test 14: CSV backward compatibility', () => {
    it('should handle old CSV format with only PIN', () => {
      const csvContent = `1111111111
2222222222
3333333333`;

      const result = parseCSV(csvContent);

      expect(result.cards).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.cards.every((c) => c.serialNumber === null)).toBe(true);
    });
  });
});
