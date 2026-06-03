import { useDataStore } from '../stores/dataStore';
import { PROFILE_DESCRIPTIONS } from '../lib/types';

export default function ProfileSelector() {
  const selectedProfile = useDataStore((s) => s.selectedProfile);
  const setSelectedProfile = useDataStore((s) => s.setSelectedProfile);
  const models = useDataStore((s) => s.models);

  const availableProfiles = new Set<number>();
  for (const model of models.values()) {
    for (const pNum of model.profiles.keys()) {
      availableProfiles.add(pNum);
    }
  }
  const sorted = Array.from(availableProfiles).sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-gray-700">Workload Profile:</span>
      {sorted.map((p) => (
        <button
          key={p}
          onClick={() => setSelectedProfile(p)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            selectedProfile === p
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          P{p}
          <span className="hidden sm:inline ml-1 text-xs opacity-75">
            {PROFILE_DESCRIPTIONS[p] || ''}
          </span>
        </button>
      ))}
    </div>
  );
}
