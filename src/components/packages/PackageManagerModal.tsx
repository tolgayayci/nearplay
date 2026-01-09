import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Package,
  Search,
  Plus,
  Loader2,
  ExternalLink,
  Download,
  Trash2,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { readFile, writeFile, searchCrates, getCrateVersions } from '@/lib/api';
import { CrateInfo, CrateVersion } from '@/lib/types';

interface Dependency {
  name: string;
  version: string;
  features?: string[];
  isDev?: boolean;
}

interface PackageManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  projectId: string;
  onDependenciesChanged?: () => void;
}

// Parse Cargo.toml to extract both dependencies and dev-dependencies
function parseDependencies(cargoToml: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = cargoToml.split('\n');

  let currentSection: 'none' | 'dependencies' | 'dev-dependencies' = 'none';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[')) {
      if (trimmed === '[dependencies]') {
        currentSection = 'dependencies';
      } else if (trimmed === '[dev-dependencies]') {
        currentSection = 'dev-dependencies';
      } else {
        currentSection = 'none';
      }
      continue;
    }

    if (currentSection === 'none' || !trimmed || trimmed.startsWith('#')) continue;

    const isDev = currentSection === 'dev-dependencies';

    // Simple format: name = "version"
    const simpleMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (simpleMatch) {
      deps.push({ name: simpleMatch[1], version: simpleMatch[2], isDev });
      continue;
    }

    // Complex format with curly braces
    const complexMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{/);
    if (complexMatch) {
      const crateName = complexMatch[1];
      const versionMatch = trimmed.match(/version\s*=\s*"([^"]+)"/);
      const featuresMatch = trimmed.match(/features\s*=\s*\[([^\]]*)\]/);

      let features: string[] | undefined;
      if (featuresMatch) {
        features = featuresMatch[1]
          .split(',')
          .map((f) => f.trim().replace(/"/g, ''))
          .filter(Boolean);
      }

      deps.push({
        name: crateName,
        version: versionMatch?.[1] || '*',
        features,
        isDev,
      });
    }
  }

  return deps;
}

// Add a dependency to Cargo.toml
function addDependencyToToml(cargoToml: string, name: string, version: string, isDev: boolean = false): string {
  const lines = cargoToml.split('\n');
  const sectionHeader = isDev ? '[dev-dependencies]' : '[dependencies]';
  let sectionIndex = -1;
  let lastDepLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === sectionHeader) {
      sectionIndex = i;
      lastDepLine = i;
    } else if (sectionIndex >= 0) {
      // Check if we hit another section
      if (trimmed.startsWith('[')) {
        break;
      }
      // Track last non-empty line in the section
      if (trimmed && !trimmed.startsWith('#')) {
        lastDepLine = i;
      }
    }
  }

  const newLine = `${name} = "${version}"`;

  if (sectionIndex === -1) {
    // No section exists, add one
    lines.push('');
    lines.push(sectionHeader);
    lines.push(newLine);
  } else {
    // Insert right after the last dependency line
    lines.splice(lastDepLine + 1, 0, newLine);
  }

  return lines.join('\n');
}

// Remove a dependency from Cargo.toml
function removeDependencyFromToml(cargoToml: string, name: string): string {
  const lines = cargoToml.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${name} =`) || trimmed.startsWith(`${name}=`)) {
      return false;
    }
    if (trimmed === `[dependencies.${name}]` || trimmed === `[dev-dependencies.${name}]`) {
      return false;
    }
    return true;
  });
  return filtered.join('\n');
}

export function PackageManagerModal({
  open,
  onOpenChange,
  userId,
  projectId,
  onDependenciesChanged,
}: PackageManagerModalProps) {
  // Dependencies state
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [cargoTomlContent, setCargoTomlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CrateInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCrate, setSelectedCrate] = useState<CrateInfo | null>(null);
  const [versions, setVersions] = useState<CrateVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [addAsDev, setAddAsDev] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const { toast } = useToast();

  // Load dependencies from Cargo.toml
  const loadDependencies = useCallback(async () => {
    if (!userId || !projectId) return;

    setIsLoading(true);
    try {
      const file = await readFile(userId, projectId, 'Cargo.toml');
      setCargoTomlContent(file.content);
      setDependencies(parseDependencies(file.content));
    } catch (error) {
      console.error('Failed to load Cargo.toml:', error);
      setDependencies([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  // Load dependencies when modal opens
  useEffect(() => {
    if (open) {
      loadDependencies();
    }
  }, [open, loadDependencies]);

  // Search crates when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const doSearch = async () => {
      setIsSearching(true);
      try {
        const response = await searchCrates(debouncedQuery, 1, 15);
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
        const activeVersions = crateVersions.filter((v) => !v.yanked).slice(0, 20);
        setVersions(activeVersions);
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
    setAddAsDev(false);
  };

  const handleAddDependency = async () => {
    if (!selectedCrate || !selectedVersion) return;

    const crateName = selectedCrate.name;
    const crateVersion = selectedVersion;
    const isDev = addAsDev;

    try {
      const newContent = addDependencyToToml(cargoTomlContent, crateName, crateVersion, isDev);

      // Save to file
      await writeFile(userId, projectId, 'Cargo.toml', newContent);

      // Verify the save worked by reading the file back
      const verifyFile = await readFile(userId, projectId, 'Cargo.toml');
      if (!verifyFile.content.includes(crateName)) {
        throw new Error('Package was not saved to Cargo.toml - please try again');
      }

      // Update state with verified content
      setCargoTomlContent(verifyFile.content);
      setDependencies(parseDependencies(verifyFile.content));

      setSelectedCrate(null);
      setSelectedVersion('');
      setVersions([]);
      setAddAsDev(false);
      toast({
        title: 'Dependency added',
        description: `Added ${crateName} v${crateVersion}${isDev ? ' (dev)' : ''}`,
      });
      onDependenciesChanged?.();
    } catch (error) {
      console.error('Failed to add dependency:', error);
      // Reload from file to ensure UI is in sync
      await loadDependencies();
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add dependency',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveDependency = async () => {
    if (!deleteTarget) return;

    const targetName = deleteTarget;

    try {
      const newContent = removeDependencyFromToml(cargoTomlContent, targetName);
      await writeFile(userId, projectId, 'Cargo.toml', newContent);

      // Verify the save worked by reading the file back
      const verifyFile = await readFile(userId, projectId, 'Cargo.toml');
      if (verifyFile.content.includes(`${targetName} =`) || verifyFile.content.includes(`${targetName}=`)) {
        throw new Error('Package was not removed from Cargo.toml - please try again');
      }

      // Update state with verified content
      setCargoTomlContent(verifyFile.content);
      setDependencies(parseDependencies(verifyFile.content));

      toast({
        title: 'Dependency removed',
        description: `Removed ${targetName}`,
      });
      onDependenciesChanged?.();
    } catch (error) {
      console.error('Failed to remove dependency:', error);
      // Reload from file to ensure UI is in sync
      await loadDependencies();
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove dependency',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`;
    return downloads.toString();
  };

  const isAlreadyAdded = (crateName: string) => dependencies.some((d) => d.name === crateName);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Package Manager
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{dependencies.length} packages</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={loadDependencies}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Search & Add */}
            <div className="w-1/2 border-r flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-medium mb-2">Search Crates.io</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search packages..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {/* Selected Crate for Adding */}
                  {selectedCrate && (
                    <div className="mb-3 border rounded-lg p-3 bg-primary/5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{selectedCrate.name}</span>
                            {selectedCrate.repository && (
                              <a
                                href={selectedCrate.repository}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
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
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setSelectedCrate(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedVersion}
                            onValueChange={setSelectedVersion}
                            disabled={loadingVersions}
                          >
                            <SelectTrigger className="flex-1 h-9">
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
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="dev-dependency"
                              checked={addAsDev}
                              onCheckedChange={setAddAsDev}
                            />
                            <Label htmlFor="dev-dependency" className="text-xs cursor-pointer">
                              Dev dependency
                            </Label>
                          </div>
                          <Button
                            onClick={handleAddDependency}
                            disabled={!selectedVersion || loadingVersions}
                            className="h-9"
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
                    </div>
                  )}

                  {/* Search Results */}
                  {results.length > 0 ? (
                    <div className="space-y-1">
                      {results.map((crate) => {
                        const added = isAlreadyAdded(crate.name);
                        return (
                          <div
                            key={crate.id}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                              added
                                ? 'opacity-50 cursor-not-allowed bg-muted/30'
                                : 'hover:bg-accent'
                            )}
                            onClick={() => !added && handleSelectCrate(crate)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{crate.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  v{crate.max_stable_version || crate.max_version}
                                </Badge>
                                {added && (
                                  <Badge variant="outline" className="text-xs">
                                    Added
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {crate.description || 'No description'}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Download className="h-3 w-3" />
                                  {formatDownloads(crate.downloads)}
                                </span>
                                <a
                                  href={`https://crates.io/crates/${crate.name}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:text-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  crates.io
                                </a>
                              </div>
                            </div>
                            {!added && <Plus className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : query.length >= 2 && !isSearching ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No packages found</p>
                    </div>
                  ) : !selectedCrate ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Search for packages to add</p>
                      <p className="text-xs mt-1">Type at least 2 characters</p>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            {/* Right Panel - Current Dependencies */}
            <div className="w-1/2 flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-medium">Installed Packages</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dependencies from Cargo.toml
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : dependencies.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No dependencies installed</p>
                      <p className="text-xs mt-1">Search and add packages from crates.io</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Regular Dependencies */}
                      {dependencies.filter(d => !d.isDev).length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground px-3 py-2 bg-muted/50 rounded-t-md">
                            Dependencies
                          </h4>
                          <div className="divide-y border rounded-b-md">
                            {dependencies.filter(d => !d.isDev).map((dep) => (
                              <div
                                key={dep.name}
                                className="group flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{dep.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      v{dep.version}
                                    </Badge>
                                  </div>
                                  {dep.features && dep.features.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {dep.features.map((f) => (
                                        <Badge key={f} variant="outline" className="text-[10px] h-4 px-1.5">
                                          {f}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a
                                    href={`https://crates.io/crates/${dep.name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-accent rounded-md"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  </a>
                                  <button
                                    className="p-2 hover:bg-destructive/20 rounded-md"
                                    onClick={() => setDeleteTarget(dep.name)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dev Dependencies */}
                      {dependencies.filter(d => d.isDev).length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground px-3 py-2 bg-muted/50 rounded-t-md">
                            Dev Dependencies
                          </h4>
                          <div className="divide-y border rounded-b-md">
                            {dependencies.filter(d => d.isDev).map((dep) => (
                              <div
                                key={`dev-${dep.name}`}
                                className="group flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{dep.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      v{dep.version}
                                    </Badge>
                                  </div>
                                  {dep.features && dep.features.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {dep.features.map((f) => (
                                        <Badge key={f} variant="outline" className="text-[10px] h-4 px-1.5">
                                          {f}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a
                                    href={`https://crates.io/crates/${dep.name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-accent rounded-md"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  </a>
                                  <button
                                    className="p-2 hover:bg-destructive/20 rounded-md"
                                    onClick={() => setDeleteTarget(dep.name)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-3 border-t bg-muted/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Changes are saved to Cargo.toml automatically. Recompile after changes.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove dependency?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteTarget}</strong> from your Cargo.toml.
              You'll need to recompile after removing dependencies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveDependency}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
