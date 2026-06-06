import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Replicate the generateExcelTemplate function
function generateExcelTemplate() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['PIN', 'Serial Number'],
    ['1234567890', 'SN-000001'],
    ['ABCD-1234-EFGH', 'SN-000002'],
  ]);

  // Set column widths
  worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Generate and save
const buffer = generateExcelTemplate();
fs.writeFileSync('/tmp/test-template.xlsx', buffer);

// Read it back to verify
const fileBuffer = fs.readFileSync('/tmp/test-template.xlsx');
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('Template structure:');
console.log(`Total rows: ${rows.length}`);
console.log('Row contents:');
rows.forEach((row, i) => {
  console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
});
