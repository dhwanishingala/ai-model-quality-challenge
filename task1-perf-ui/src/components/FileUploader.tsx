import { useCallback, useState } from 'react';
import { parseXlsxFile, addParsedDataToMap } from '../lib/parser';
import { useDataStore } from '../stores/dataStore';
import type { ModelsMap } from '../lib/types';

export default function FileUploader() {
  const mergeModels = useDataStore((s) => s.mergeModels);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const xlsxFiles = Array.from(files).filter((f) => f.name.endsWith('.xlsx'));
      if (xlsxFiles.length === 0) {
        setStatus('No .xlsx files found');
        return;
      }

      setStatus(`Parsing ${xlsxFiles.length} file(s)...`);
      let parsed: ModelsMap = new Map();
      let count = 0;

      for (const file of xlsxFiles) {
        const result = await parseXlsxFile(file);
        if (result) {
          parsed = addParsedDataToMap(parsed, result.modelName, result.profileNumber, result.configs);
          count++;
        }
      }

      if (count > 0) {
        mergeModels(parsed);
        setStatus(`Loaded ${count} file(s)`);
      } else {
        setStatus('No valid perf sweep files found. Expected: "Model X profile N.xlsx"');
      }

      setTimeout(() => setStatus(null), 3000);
    },
    [mergeModels]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input
        type="file"
        accept=".xlsx"
        multiple
        onChange={onInputChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <p className="text-sm text-gray-600">
          Drop <code>.xlsx</code> perf sweep files here, or{' '}
          <span className="text-blue-600 underline">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Expects files named "Model X profile N.xlsx"
        </p>
      </label>
      {status && <p className="text-sm mt-2 text-blue-600">{status}</p>}
    </div>
  );
}
