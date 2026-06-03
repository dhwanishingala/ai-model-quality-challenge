import { useEffect } from 'react';
import { useDataStore } from './stores/dataStore';
import FileUploader from './components/FileUploader';
import ProfileSelector from './components/ProfileSelector';
import CustomerView from './components/CustomerView';
import EngineerView from './components/EngineerView';

export default function App() {
  const viewMode = useDataStore((s) => s.viewMode);
  const setViewMode = useDataStore((s) => s.setViewMode);
  const loading = useDataStore((s) => s.loading);
  const models = useDataStore((s) => s.models);
  const loadPrebuiltData = useDataStore((s) => s.loadPrebuiltData);

  useEffect(() => {
    loadPrebuiltData();
  }, [loadPrebuiltData]);

  const modelCount = models.size;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cerebras Performance Dashboard</h1>
            <p className="text-xs text-gray-500">
              {modelCount} model{modelCount !== 1 ? 's' : ''} loaded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('customer')}
              className={`px-4 py-2 text-sm rounded-l-lg border transition-colors ${
                viewMode === 'customer'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Customer View
            </button>
            <button
              onClick={() => setViewMode('engineer')}
              className={`px-4 py-2 text-sm rounded-r-lg border border-l-0 transition-colors ${
                viewMode === 'engineer'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Engineer View
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex-1 w-full">
            <ProfileSelector />
          </div>
          <div className="w-full sm:w-80">
            <FileUploader />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Loading performance data...</p>
          </div>
        ) : viewMode === 'customer' ? (
          <CustomerView />
        ) : (
          <EngineerView />
        )}
      </main>
    </div>
  );
}
