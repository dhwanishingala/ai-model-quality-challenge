import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const PERF_DATA_DIR = path.resolve('..', 'perf_data');
const OUTPUT_PATH = path.resolve('public', 'data', 'models.json');
const FILENAME_REGEX = /Model\s+(.+?)\s+profile\s+(\d+)/i;

function parseSummarySheet(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const configs = [];
  const inherited = { input: 0, output: 0, cache: 0 };

  for (let r = 2; r <= range.e.r; r++) {
    const cells = [];
    for (let c = 0; c <= 18; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      cells.push(cell ? cell.v : null);
    }

    if (r === 2) {
      inherited.input = typeof cells[0] === 'number' ? cells[0] : 0;
      inherited.output = typeof cells[1] === 'number' ? cells[1] : 0;
      inherited.cache = typeof cells[2] === 'number' ? cells[2] : 0;
    }

    const num = (v, fallback = 0) => (typeof v === 'number' ? v : fallback);

    const row = {
      inputLength: num(cells[0]) || inherited.input,
      outputLength: num(cells[1]) || inherited.output,
      cachePercent: cells[2] != null ? num(cells[2]) : inherited.cache,
      batchSize: num(cells[3]),
      maxMs: num(cells[4]),
      targetMaxMs: num(cells[5]),
      promptOnlyThroughput: num(cells[6]),
      genOnlyThroughput: num(cells[7]),
      throughput: num(cells[8]),
      throughputPerBox: num(cells[9]),
      uncachedThroughput: num(cells[10]),
      uncachedThroughputPerBox: num(cells[11]),
      cachedThroughput: num(cells[12]),
      cachedThroughputPerBox: num(cells[13]),
      ttftMs: num(cells[14]),
      realPromptSpeed: num(cells[15]),
      promptSpeedWithQueueing: num(cells[16]),
      genSpeed: num(cells[17]),
      rpm: num(cells[18]),
    };

    if (row.batchSize > 0) configs.push(row);
  }
  return configs;
}

const result = {};
const dirs = fs.readdirSync(PERF_DATA_DIR).filter(d =>
  fs.statSync(path.join(PERF_DATA_DIR, d)).isDirectory()
);

for (const dir of dirs) {
  const files = fs.readdirSync(path.join(PERF_DATA_DIR, dir)).filter(f => f.endsWith('.xlsx'));
  for (const file of files) {
    const match = file.match(FILENAME_REGEX);
    if (!match) continue;

    const modelName = match[1];
    const profileNumber = match[2];
    const wb = XLSX.readFile(path.join(PERF_DATA_DIR, dir, file));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const configs = parseSummarySheet(sheet);

    if (!result[modelName]) result[modelName] = {};
    result[modelName][profileNumber] = configs;
  }
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result));
console.log(`Wrote ${Object.keys(result).length} models to ${OUTPUT_PATH}`);
for (const [name, profiles] of Object.entries(result)) {
  console.log(`  ${name}: ${Object.keys(profiles).length} profiles`);
}
