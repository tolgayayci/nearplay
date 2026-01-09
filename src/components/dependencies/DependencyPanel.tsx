import React, { useState, useEffect, useCallback } from 'react';
import { Package, Trash2, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { cn } from '@/lib/utils';
import { DependencySearch } from './DependencySearch';
import { useToast } from '@/hooks/use-toast';
import { readFile, writeFile } from '@/lib/api';

interface Dependency {
  name: string;
  version: string;
  features?: string[];
}

interface DependencyPanelProps {
  userId: string;
  projectId: string;
  onDependenciesChanged?: () => void;
  className?: string;
}

// Parse Cargo.toml to extract dependencies
function parseDependencies(cargoToml: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = cargoToml.split('\n');

  let inDependencies = false;
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers
    if (trimmed.startsWith('[')) {
      if (trimmed === '[dependencies]') {
        inDependencies = true;
        currentSection = 'dependencies';
      } else if (trimmed === '[dev-dependencies]') {
        inDependencies = true;
        currentSection = 'dev-dependencies';
      } else if (trimmed.startsWith('[dependencies.') || trimmed.startsWith('[dev-dependencies.')) {
        // Handle table format [dependencies.crate-name]
        const match = trimmed.match(/\[((?:dev-)?dependencies)\.([^\]]+)\]/);
        if (match) {
          // We'll handle these separately if needed
        }
        inDependencies = false;
      } else {
        inDependencies = false;
      }
      continue;
    }

    if (!inDependencies || !trimmed || trimmed.startsWith('#')) continue;

    // Parse dependency line
    // Format: name = "version" or name = { version = "x", features = [...] }
    const simpleMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (simpleMatch) {
      deps.push({
        name: simpleMatch[1],
        version: simpleMatch[2],
      });
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
      });
    }
  }

  return deps;
}

// Add a dependency to Cargo.toml
function addDependencyToToml(cargoToml: string, name: string, version: string): string {
  const lines = cargoToml.split('\n');
  let dependenciesIndex = -1;
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '[dependencies]') {
      dependenciesIndex = i;
    } else if (dependenciesIndex >= 0 && trimmed.startsWith('[') && trimmed !== '[dependencies]') {
      // Found next section after dependencies
      insertIndex = i;
      break;
    }
  }

  const newLine = `${name} = "${version}"`;

  if (dependenciesIndex === -1) {
    // No [dependencies] section, add it
    lines.push('');
    lines.push('[dependencies]');
    lines.push(newLine);
  } else if (insertIndex === -1) {
    // [dependencies] exists but no section after it, append to end
    lines.push(newLine);
  } else {
    // Insert before next section
    lines.splice(insertIndex, 0, newLine);
  }

  return lines.join('\n');
}

// Remove a dependency from Cargo.toml
function removeDependencyFromToml(cargoToml: string, name: string): string {
  const lines = cargoToml.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    // Match simple format: name = "version"
    if (trimmed.startsWith(`${name} =`) || trimmed.startsWith(`${name}=`)) {
      return false;
    }
    // Match table format [dependencies.name]
    if (trimmed === `[dependencies.${name}]` || trimmed === `[dev-dependencies.${name}]`) {
      return false;
    }
    return true;
  });

  return filtered.join('\n');
}

export function DependencyPanel({
  userId,
  projectId,
  onDependenciesChanged,
  className,
}: DependencyPanelProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cargoTomlContent, setCargoTomlContent] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  const loadDependencies = useCallback(async () => {
    if (!userId || !projectId) return;

    setIsLoading(true);
    try {
      const file = await readFile(userId, projectId, 'Cargo.toml');
      setCargoTomlContent(file.content);
      const deps = parseDependencies(file.content);
      setDependencies(deps);
    } catch (error) {
      console.error('Failed to load Cargo.toml:', error);
      // Cargo.toml might not exist yet
      setDependencies([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  const handleAddDependency = async (name: string, version: string) => {
    try {
      const newContent = addDependencyToToml(cargoTomlContent, name, version);
      await writeFile(userId, projectId, 'Cargo.toml', newContent);
      setCargoTomlContent(newContent);
      setDependencies(parseDependencies(newContent));
      setIsSearchOpen(false);
      toast({
        title: 'Dependency added',
        description: `Added ${name} v${version}`,
      });
      onDependenciesChanged?.();
    } catch (error) {
      console.error('Failed to add dependency:', error);
      toast({
        title: 'Error',
        description: 'Failed to add dependency',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveDependency = async () => {
    if (!deleteTarget) return;

    try {
      const newContent = removeDependencyFromToml(cargoTomlContent, deleteTarget);
      await writeFile(userId, projectId, 'Cargo.toml', newContent);
      setCargoTomlContent(newContent);
      setDependencies(parseDependencies(newContent));
      toast({
        title: 'Dependency removed',
        description: `Removed ${deleteTarget}`,
      });
      onDependenciesChanged?.();
    } catch (error) {
      console.error('Failed to remove dependency:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove dependency',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const existingDepNames = dependencies.map((d) => d.name);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Dependencies
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={loadDependencies}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Add Dependency Section */}
          <Collapsible open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs h-8"
              >
                + Add Dependency
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <DependencySearch
                onAddDependency={handleAddDependency}
                existingDependencies={existingDepNames}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Dependencies List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : dependencies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No dependencies found</p>
              <p className="text-xs mt-1">Add dependencies from crates.io</p>
            </div>
          ) : (
            <div className="space-y-1">
              {dependencies.map((dep) => (
                <div
                  key={dep.name}
                  className="group flex items-center justify-between p-2 rounded hover:bg-accent/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {dep.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
                        {dep.version}
                      </Badge>
                    </div>
                    {dep.features && dep.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dep.features.map((f) => (
                          <Badge
                            key={f}
                            variant="outline"
                            className="text-[9px] h-3 px-1"
                          >
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
                      className="p-1 hover:bg-accent rounded"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                    <button
                      className="p-1 hover:bg-destructive/20 rounded"
                      onClick={() => setDeleteTarget(dep.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
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
              className="bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
