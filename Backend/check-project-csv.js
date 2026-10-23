const assert = require('node:assert/strict');
const { parseProjectCsv, REQUIRED_HEADERS } = require('./lib/project-csv');

const extraHeader = 'Project Area(s), where the project is an area based offsets project';
const values = new Map([
  ['Project Name', 'Sample project'],
  ['Project ID', 'CER-CHECK-001'],
  ['Project Proponent', 'Sample proponent'],
  ['Method', 'Sample methodology'],
  ['Method Type', 'Vegetation'],
  ['Project Description', 'Quoted CSV check'],
  ['Date Project Registered', '01/02/2026'],
  ['Crediting period start date', '01/02/2026'],
  ['Crediting period end date', '31/01/2051'],
  ['Project location', 'Victoria'],
  ['ACCUs Total units issued', '12'],
  ['KACCUs Total units issued', '12'],
  ['NKACCUs Total units issued', '0'],
  ['Total Number of KACCUs units relinquished', '1'],
  ['Total Number of NKACCUs units relinquished', '0'],
  ['Project revoked', 'No'],
  [extraHeader, 'Lot 1\nLot 2'],
]);

const headers = [...REQUIRED_HEADERS, extraHeader, 'Project revoked'];
const csvField = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = `${headers.map(csvField).join(',')}\n${headers.map((header) => csvField(values.get(header))).join(',')}\n`;
const result = parseProjectCsv(Buffer.from(csv));

assert.equal(result.errors.length, 0);
assert.equal(result.records.length, 1);
assert.equal(result.records[0].project.project_reference, 'CER-CHECK-001');
assert.equal(result.records[0].project.project_registered_at, '2026-02-01');
assert.equal(result.records[0].details.project_area, 'Lot 1\nLot 2');
console.log('Project CSV parser OK (quoted multi-line field and core mapping checked)');
