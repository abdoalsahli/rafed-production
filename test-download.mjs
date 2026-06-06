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

  worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Generate template
const buffer = generateExcelTemplate();
console.log('✅ Template generated successfully');
console.log('   Buffer size:', buffer.length, 'bytes');

// Convert to base64 (what the endpoint returns)
const base64 = buffer.toString('base64');
console.log('✅ Base64 encoded');
console.log('   Base64 size:', base64.length, 'chars');

// Simulate what the frontend does
const binaryString = Buffer.from(base64, 'base64').toString('binary');
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}

// Save to file
const blob = Buffer.from(bytes);
fs.writeFileSync('/tmp/test-download.xlsx', blob);
console.log('✅ File saved to /tmp/test-download.xlsx');

// Verify it's readable
const fileBuffer = fs.readFileSync('/tmp/test-download.xlsx');
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('✅ Template verified');
console.log('   Rows:', rows.length);
console.log('   Content:', rows.map((r) => JSON.stringify(r)));
