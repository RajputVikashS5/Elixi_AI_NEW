import React, { useEffect, useState } from 'react';
import { Search, Trash2, Tag, Zap } from 'lucide-react';
import { memoryService, MemoryFact, SemanticResult } from '../services/memoryService';
import { Button } from '../components/ui/Button';

type ViewMode = 'facts' | 'semantic';

const MemoryPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('facts');
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  
  // Semantic search filters
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string | undefined>();
  const [semanticLimit, setSemanticLimit] = useState(10);

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

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const response = await memoryService.semanticBrowse(searchQuery, {
        confidenceThreshold,
        sourceType: sourceTypeFilter,
        limit: semanticLimit,
      });
      setSemanticResults(response.results);
    } catch (err) {
      setError('Semantic search failed. Is the backend running?');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && viewMode === 'semantic') {
      handleSemanticSearch();
    }
  };

  const getSourceBadgeColor = (source: string): string => {
    switch (source) {
      case 'memory':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'message':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'habit':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'vector':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
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

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b border-elixi-border">
        <button
          onClick={() => setViewMode('facts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'facts'
              ? 'border-elixi-primary text-elixi-primary'
              : 'border-transparent text-elixi-muted hover:text-elixi-text'
          }`}
        >
          Facts
        </button>
        <button
          onClick={() => setViewMode('semantic')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            viewMode === 'semantic'
              ? 'border-elixi-primary text-elixi-primary'
              : 'border-transparent text-elixi-muted hover:text-elixi-text'
          }`}
        >
          <Zap size={13} />
          Semantic Search
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Facts View */}
      {viewMode === 'facts' && (
        <>
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
        </>
      )}

      {/* Semantic Search View */}
      {viewMode === 'semantic' && (
        <>
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-elixi-muted" />
              <input
                type="text"
                placeholder="Search across all memories semantically..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full bg-elixi-surface border border-elixi-border rounded-lg py-2 pl-9 pr-3 text-sm text-elixi-text placeholder:text-elixi-muted outline-none focus:border-elixi-primary/50 selectable"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-elixi-muted">Confidence</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-elixi-surface border border-elixi-border rounded cursor-pointer"
                  />
                  <span className="text-xs text-elixi-muted w-6">{confidenceThreshold.toFixed(1)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-elixi-muted">Source Type</label>
                <select
                  value={sourceTypeFilter || ''}
                  onChange={(e) => setSourceTypeFilter(e.target.value || undefined)}
                  className="text-xs bg-elixi-surface border border-elixi-border rounded px-2 py-1 text-elixi-text outline-none focus:border-elixi-primary/50"
                >
                  <option value="">All Sources</option>
                  <option value="memory">Memory</option>
                  <option value="message">Message</option>
                  <option value="habit">Habit</option>
                  <option value="vector">Vector</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-elixi-muted">Limit</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={semanticLimit}
                  onChange={(e) => setSemanticLimit(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
                  className="text-xs bg-elixi-surface border border-elixi-border rounded px-2 py-1 text-elixi-text outline-none focus:border-elixi-primary/50"
                />
              </div>
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSemanticSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="w-full"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Results */}
          {semanticResults.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-elixi-muted">
                Found {semanticResults.length} result{semanticResults.length !== 1 ? 's' : ''}
              </div>
              {semanticResults.map((result) => (
                <div
                  key={result.id}
                  className="p-3 rounded-lg bg-elixi-surface border border-elixi-border/60 hover:border-elixi-border"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-elixi-text leading-snug selectable">{result.content}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-elixi-primary">
                          {(result.score * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-elixi-muted">score</div>
                      </div>
                    </div>
                  </div>

                  {/* Meta Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceBadgeColor(result.source)}`}>
                      {result.source}
                    </span>
                    {result.metadata && result.metadata.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-elixi-primary/10 text-elixi-primary border border-elixi-primary/20 font-medium capitalize">
                        {String(result.metadata.category)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSearching && searchQuery.trim() && semanticResults.length === 0 && (
            <div className="text-center text-elixi-muted text-sm py-8">
              No results found. Try adjusting your filters.
            </div>
          )}

          {!isSearching && !searchQuery.trim() && semanticResults.length === 0 && (
            <div className="text-center text-elixi-muted text-sm py-8">
              Enter a search query above to find related memories across all sources and sessions.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MemoryPage;
