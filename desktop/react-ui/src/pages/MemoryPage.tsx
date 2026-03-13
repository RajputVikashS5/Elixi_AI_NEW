import React, { useEffect, useState } from 'react';
import { Search, Trash2, Tag } from 'lucide-react';
import { memoryService, MemoryFact } from '../services/memoryService';
import { Button } from '../components/ui/Button';

const MemoryPage: React.FC = () => {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    memoryService.getFacts()
      .then(setFacts)
      .catch(() => setError('Could not load memories. Is the backend running?'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await memoryService.deleteFact(id);
      setFacts((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Failed to delete memory entry.');
    }
  };

  const filtered = facts.filter((f) =>
    f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-elixi-text">Memory</h1>
        <p className="text-sm text-elixi-muted mt-0.5">Browse and manage what ELIXI knows about you</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-elixi-muted" />
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-elixi-surface border border-elixi-border rounded-lg py-2 pl-9 pr-3 text-sm text-elixi-text placeholder:text-elixi-muted outline-none focus:border-elixi-primary/50 selectable"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-elixi-muted text-sm py-8">Loading memories...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-elixi-muted text-sm py-8">
          {searchQuery ? 'No memories match your search.' : 'No memories stored yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((fact) => (
            <div
              key={fact.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-elixi-surface border border-elixi-border hover:border-elixi-border/80"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Tag size={11} className="text-elixi-primary shrink-0" />
                  <span className="text-xs font-medium text-elixi-primary capitalize">{fact.category}</span>
                  <span className="text-xs text-elixi-muted">·</span>
                  <span className="text-xs font-semibold text-elixi-text truncate">{fact.key}</span>
                </div>
                <p className="text-sm text-elixi-muted truncate selectable">{fact.value}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(fact.id)}
                className="shrink-0 text-red-400 hover:text-red-300"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemoryPage;
