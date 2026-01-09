import React, { useState, useCallback, useEffect } from 'react';
import { Search, Plus, Loader2, ExternalLink, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { searchCrates, getCrateVersions } from '@/lib/api';
import { CrateInfo, CrateVersion } from '@/lib/types';
import { useDebounce } from '@/hooks/useDebounce';

interface DependencySearchProps {
  onAddDependency: (name: string, version: string) => void;
  existingDependencies: string[];
  className?: string;
}

export function DependencySearch({
  onAddDependency,
  existingDependencies,
  className,
}: DependencySearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CrateInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCrate, setSelectedCrate] = useState<CrateInfo | null>(null);
  const [versions, setVersions] = useState<CrateVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [loadingVersions, setLoadingVersions] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Search crates when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const doSearch = async () => {
      setIsSearching(true);
      try {
        const response = await searchCrates(debouncedQuery, 1, 10);
        setResults(response.crates);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    doSearch();
  }, [debouncedQuery]);

  // Load versions when crate is selected
  useEffect(() => {
    if (!selectedCrate) {
      setVersions([]);
      setSelectedVersion('');
      return;
    }

    const loadVersions = async () => {
      setLoadingVersions(true);
      try {
        const crateVersions = await getCrateVersions(selectedCrate.name);
        // Filter out yanked versions and sort by version number
        const activeVersions = crateVersions
          .filter((v) => !v.yanked)
          .slice(0, 20); // Limit to recent 20 versions
        setVersions(activeVersions);
        // Default to latest stable or newest version
        const defaultVersion =
          selectedCrate.max_stable_version ||
          selectedCrate.max_version ||
          (activeVersions[0]?.num ?? '');
        setSelectedVersion(defaultVersion);
      } catch (error) {
        console.error('Failed to load versions:', error);
        setVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    };

    loadVersions();
  }, [selectedCrate]);

  const handleSelectCrate = (crate: CrateInfo) => {
    setSelectedCrate(crate);
    setQuery('');
    setResults([]);
  };

  const handleAddDependency = () => {
    if (selectedCrate && selectedVersion) {
      onAddDependency(selectedCrate.name, selectedVersion);
      setSelectedCrate(null);
      setSelectedVersion('');
      setVersions([]);
    }
  };

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) {
      return `${(downloads / 1000000).toFixed(1)}M`;
    }
    if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}K`;
    }
    return downloads.toString();
  };

  const isAlreadyAdded = (crateName: string) => {
    return existingDependencies.includes(crateName);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search crates.io..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <ScrollArea className="max-h-[200px] border rounded-md">
          <div className="p-1">
            {results.map((crate) => (
              <div
                key={crate.id}
                className={cn(
                  'flex items-start gap-2 p-2 rounded hover:bg-accent cursor-pointer',
                  isAlreadyAdded(crate.name) && 'opacity-50'
                )}
                onClick={() => !isAlreadyAdded(crate.name) && handleSelectCrate(crate)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {crate.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4">
                      {crate.max_stable_version || crate.max_version}
                    </Badge>
                    {isAlreadyAdded(crate.name) && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        Added
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {crate.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Download className="h-3 w-3" />
                      {formatDownloads(crate.downloads)}
                    </span>
                  </div>
                </div>
                {!isAlreadyAdded(crate.name) && (
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Selected Crate */}
      {selectedCrate && (
        <div className="border rounded-md p-3 bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedCrate.name}</span>
                {selectedCrate.repository && (
                  <a
                    href={selectedCrate.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {selectedCrate.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setSelectedCrate(null)}
            >
              Cancel
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Select
              value={selectedVersion}
              onValueChange={setSelectedVersion}
              disabled={loadingVersions}
            >
              <SelectTrigger className="flex-1 h-8">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.num} value={v.num}>
                    {v.num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8"
              onClick={handleAddDependency}
              disabled={!selectedVersion || loadingVersions}
            >
              {loadingVersions ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
