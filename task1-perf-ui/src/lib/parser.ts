import * as XLSX from 'xlsx';
import type { ConfigRow, ProfileData, ModelData, ModelsMap, SerializedModels } from './types';

const FILENAME_REGEX = /Model\s+(.+?)\s+profile\s+(\d+)/i;

function parseFilename(filename: string): { modelName: string; profileNumber: number } | null {
  const match = filename.match(FILENAME_REGEX);
  if (!match) return null;
  return { modelName: match[1], profileNumber: parseInt(match[2], 10) };
}

function parseRow(cells: (string | number | null | undefined)[], inherited: { input: number; output: number; cache: number }): ConfigRow {
  const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);

  return {
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
}

export function parseSummarySheet(sheet: XLSX.WorkSheet): ConfigRow[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const configs: ConfigRow[] = [];
  const inherited = { input: 0, output: 0, cache: 0 };

  for (let r = 2; r <= range.e.r; r++) {
    const cells: (string | number | null)[] = [];
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

    const row = parseRow(cells, inherited);
    if (row.batchSize > 0) {
      configs.push(row);
    }
  }

  return configs;
}

export function parseXlsxFile(file: File): Promise<{ modelName: string; profileNumber: number; configs: ConfigRow[] } | null> {
  return new Promise((resolve) => {
    const info = parseFilename(file.name);
    if (!info) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const configs = parseSummarySheet(sheet);
      resolve({ ...info, configs });
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

export function addParsedDataToMap(
  map: ModelsMap,
  modelName: string,
  profileNumber: number,
  configs: ConfigRow[]
): ModelsMap {
  const newMap = new Map(map);
  const existing = newMap.get(modelName) || { modelName, profiles: new Map<number, ProfileData>() };
  const profiles = new Map(existing.profiles);
  profiles.set(profileNumber, { profileNumber, configs });
  newMap.set(modelName, { modelName, profiles });
  return newMap;
}

export function deserializeModels(data: SerializedModels): ModelsMap {
  const map: ModelsMap = new Map();
  for (const [modelName, profiles] of Object.entries(data)) {
    const profileMap = new Map<number, ProfileData>();
    for (const [pNum, configs] of Object.entries(profiles)) {
      profileMap.set(parseInt(pNum, 10), { profileNumber: parseInt(pNum, 10), configs });
    }
    map.set(modelName, { modelName, profiles: profileMap });
  }
  return map;
}
