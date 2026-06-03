export interface ConfigRow {
  inputLength: number;
  outputLength: number;
  cachePercent: number;
  batchSize: number;
  maxMs: number;
  targetMaxMs: number;
  promptOnlyThroughput: number;
  genOnlyThroughput: number;
  throughput: number;
  throughputPerBox: number;
  uncachedThroughput: number;
  uncachedThroughputPerBox: number;
  cachedThroughput: number;
  cachedThroughputPerBox: number;
  ttftMs: number;
  realPromptSpeed: number;
  promptSpeedWithQueueing: number;
  genSpeed: number;
  rpm: number;
}

export interface ProfileData {
  profileNumber: number;
  configs: ConfigRow[];
}

export interface ModelData {
  modelName: string;
  profiles: Map<number, ProfileData>;
}

export type ModelsMap = Map<string, ModelData>;

export interface SerializedModels {
  [modelName: string]: {
    [profileNumber: string]: ConfigRow[];
  };
}

export type ViewMode = 'customer' | 'engineer';

export const PROFILE_DESCRIPTIONS: Record<number, string> = {
  1: 'Summarization / RAG',
  2: 'Long Generation (no cache)',
  3: 'Chat / Conversational',
  4: 'Balanced Chat',
  5: 'Document QA',
  6: 'Long-Context Retrieval',
  7: 'Code Generation',
};

export const CUSTOMER_COLUMNS: (keyof ConfigRow)[] = [
  'genSpeed',
  'ttftMs',
  'throughput',
  'rpm',
  'throughputPerBox',
];

export const COLUMN_LABELS: Record<keyof ConfigRow, string> = {
  inputLength: 'Input Length',
  outputLength: 'Output Length',
  cachePercent: 'Cache %',
  batchSize: 'Batch Size',
  maxMs: 'Max ms',
  targetMaxMs: 'Target Max ms',
  promptOnlyThroughput: 'Prompt Throughput (t/s)',
  genOnlyThroughput: 'Gen Throughput (t/s)',
  throughput: 'Throughput (t/s)',
  throughputPerBox: 'Throughput/Box (t/s/hw)',
  uncachedThroughput: 'Uncached Throughput (t/s)',
  uncachedThroughputPerBox: 'Uncached Throughput/Box',
  cachedThroughput: 'Cached Throughput (t/s)',
  cachedThroughputPerBox: 'Cached Throughput/Box',
  ttftMs: 'TTFT (ms)',
  realPromptSpeed: 'Prompt Speed (t/s/user)',
  promptSpeedWithQueueing: 'Prompt Speed w/ Queue',
  genSpeed: 'Gen Speed (t/s/user)',
  rpm: 'RPM',
};
