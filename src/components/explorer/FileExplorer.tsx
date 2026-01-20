import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Trash2,
  Edit2,
  RefreshCw,
  FilePlus,
  FolderPlus,
  FileCode,
  Settings,
  FileText,
  Loader2,
  FolderTree,
  Search,
  X,
  FileSearch,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { FileNode, getFileTypeInfo } from '@/lib/types';
import {
  getFileTree,
  createFile,
  createDirectory,
  deleteFile,
  renameFile,
  searchFiles,
} from '@/lib/api';
interface FileExplorerProps {
  userId: string;
  projectId: string;
  projectName?: string;
  onFileSelect?: (path: string, lineNumber?: number) => void;
  className?: string;
  selectedFile?: string | null;
  onOpenPackageManager?: () => void;
}

export interface FileExplorerRef {
  refresh: () => void;
}

interface SearchResult {
  path: string;
  name: string;
  preview?: string;
  line_number?: number;
}

// Get file icon based on extension with syntax-aware coloring
function getFileIcon(name: string, path: string, isDirectory: boolean, isExpanded: boolean) {
  if (isDirectory) {
    return isExpanded ? (
      <FolderOpen className="h-4 w-4 text-yellow-500" />
    ) : (
      <Folder className="h-4 w-4 text-yellow-500" />
    );
  }

  const fileInfo = getFileTypeInfo(path || name);
  const ext = name.split('.').pop()?.toLowerCase();

  // Use specific icons based on file type
  switch (ext) {
    case 'rs':
      return <FileCode className={`h-4 w-4 ${fileInfo.color}`} />;
    case 'toml':
      return <Settings className={`h-4 w-4 ${fileInfo.color}`} />;
    case 'md':
      return <FileText className={`h-4 w-4 ${fileInfo.color}`} />;
    case 'json':
    case 'yml':
    case 'yaml':
      return <FileCode className={`h-4 w-4 ${fileInfo.color}`} />;
    case 'txt':
      return <FileText className={`h-4 w-4 ${fileInfo.color}`} />;
    default:
      return <File className={`h-4 w-4 ${fileInfo.color}`} />;
  }
}

export const FileExplorer = forwardRef<FileExplorerRef, FileExplorerProps>(
  ({ userId, projectId, projectName, onFileSelect, className, selectedFile, onOpenPackageManager }, ref) => {
    const [tree, setTree] = useState<FileNode | null>(null);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['', 'src']));
    const [selectedPath, setSelectedPath] = useState<string | null>(selectedFile || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'filename' | 'content'>('filename');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Dialog states
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'file' | 'folder' | 'rename'>('file');
    const [dialogValue, setDialogValue] = useState('');
    const [dialogPath, setDialogPath] = useState('');

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);

    const { toast } = useToast();

    // Sync selectedPath with selectedFile prop
    useEffect(() => {
      if (selectedFile) {
        setSelectedPath(selectedFile);
      }
    }, [selectedFile]);

    // Fetch file tree
    const fetchTree = useCallback(async () => {
      if (!userId || !projectId) return;

      setLoading(true);
      setError(null);

      try {
        const treeData = await getFileTree(userId, projectId);
        if (projectName) {
          treeData.name = projectName;
        }
        setTree(treeData);

        // Auto-expand root and src
        setExpandedPaths(prev => {
          const newPaths = new Set(prev);
          newPaths.add('');
          if (treeData.children) {
            const srcFolder = treeData.children.find(
              child => child.name === 'src' && child.is_directory
            );
            if (srcFolder) {
              newPaths.add(srcFolder.path);
            }
          }
          return newPaths;
        });
      } catch (err) {
        console.error('Failed to fetch file tree:', err);
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    }, [userId, projectId, projectName]);

    useEffect(() => {
      fetchTree();
    }, [fetchTree]);

    // Expose refresh via ref
    useImperativeHandle(ref, () => ({
      refresh: fetchTree,
    }), [fetchTree]);

    // Toggle folder expansion
    const toggleExpand = (path: string) => {
      setExpandedPaths(prev => {
        const newSet = new Set(prev);
        if (newSet.has(path)) {
          newSet.delete(path);
        } else {
          newSet.add(path);
        }
        return newSet;
      });
    };

    // Handle file/folder click
    const handleNodeClick = (node: FileNode) => {
      setSelectedPath(node.path);
      if (node.is_directory) {
        toggleExpand(node.path);
      } else {
        onFileSelect?.(node.path);
      }
    };

    // Get the target directory for creating new files/folders
    // Based on current selection: if directory selected, use it; if file selected, use its parent
    const getCreateTargetDirectory = useCallback((): string => {
      if (!selectedPath) return '';

      // Find the node in the tree to check if it's a directory
      const findNode = (node: FileNode, path: string): FileNode | null => {
        if (node.path === path) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child, path);
            if (found) return found;
          }
        }
        return null;
      };

      if (tree) {
        const selectedNode = findNode(tree, selectedPath);
        if (selectedNode?.is_directory) {
          return selectedPath;
        }
      }

      // If it's a file, get parent directory
      const lastSlash = selectedPath.lastIndexOf('/');
      return lastSlash > 0 ? selectedPath.substring(0, lastSlash) : '';
    }, [selectedPath, tree]);

    // Open create dialog
    const openCreateDialog = (mode: 'file' | 'folder', parentPath: string) => {
      setDialogMode(mode);
      setDialogPath(parentPath);
      setDialogValue('');
      setDialogOpen(true);
    };

    // Open rename dialog
    const openRenameDialog = (path: string, name: string) => {
      setDialogMode('rename');
      setDialogPath(path);
      setDialogValue(name);
      setDialogOpen(true);
    };

    // Handle create/rename submit
    const handleDialogSubmit = async () => {
      if (!dialogValue.trim()) return;

      try {
        if (dialogMode === 'rename') {
          const newPath = dialogPath.replace(/[^/]+$/, dialogValue);
          await renameFile(userId, projectId, dialogPath, newPath);
          toast({ title: 'Renamed successfully' });
        } else if (dialogMode === 'file') {
          const newPath = dialogPath ? `${dialogPath}/${dialogValue}` : dialogValue;
          await createFile(userId, projectId, newPath);
          toast({ title: 'File created' });
          onFileSelect?.(newPath);
        } else {
          const newPath = dialogPath ? `${dialogPath}/${dialogValue}` : dialogValue;
          await createDirectory(userId, projectId, newPath);
          toast({ title: 'Folder created' });
        }
        setDialogOpen(false);
        fetchTree();
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Operation failed',
          variant: 'destructive',
        });
      }
    };

    // Handle delete
    const handleDelete = async () => {
      if (!deleteTarget) return;

      try {
        await deleteFile(userId, projectId, deleteTarget.path);
        toast({ title: 'Deleted successfully' });
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        fetchTree();
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Delete failed',
          variant: 'destructive',
        });
      }
    };

    // Client-side filename search (instant, no backend call)
    const flattenTree = useCallback((node: FileNode, results: FileNode[] = []): FileNode[] => {
      if (!node.is_directory) {
        results.push(node);
      }
      node.children?.forEach(child => flattenTree(child, results));
      return results;
    }, []);

    const searchByFilename = useCallback((query: string): SearchResult[] => {
      if (!tree || !query.trim()) return [];
      const files = flattenTree(tree);
      const lowerQuery = query.toLowerCase();
      return files
        .filter(f =>
          f.name.toLowerCase().includes(lowerQuery) ||
          f.path.toLowerCase().includes(lowerQuery)
        )
        .map(f => ({
          path: f.path,
          name: f.name,
        }));
    }, [tree, flattenTree]);

    // Perform search (debounced)
    const performSearch = useCallback(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      if (searchMode === 'filename') {
        // Client-side filename search (instant)
        const results = searchByFilename(query);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        // Backend content search
        setIsSearching(true);
        try {
          const results = await searchFiles(userId, projectId, query, true);
          setSearchResults(results);
        } catch (err) {
          console.error('Search failed:', err);
          toast({
            title: 'Search failed',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          });
        } finally {
          setIsSearching(false);
        }
      }
    }, [searchMode, searchByFilename, userId, projectId, toast]);

    // Debounced search handler
    const handleSearchChange = useCallback((value: string) => {
      setSearchQuery(value);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (!value.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // For filename search, use shorter debounce
      const debounceTime = searchMode === 'filename' ? 150 : 300;

      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, debounceTime);
    }, [searchMode, performSearch]);

    // Clear search
    const clearSearch = useCallback(() => {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      searchInputRef.current?.focus();
    }, []);

    // Handle search result click
    const handleSearchResultClick = (result: SearchResult) => {
      setSelectedPath(result.path);
      onFileSelect?.(result.path, result.line_number);
      // Optionally clear search after selection
      // clearSearch();
    };

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, []);

    // Re-run search when mode changes
    useEffect(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      }
    }, [searchMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Render tree node
    const renderNode = (node: FileNode, depth: number = 0) => {
      const isExpanded = expandedPaths.has(node.path);
      const isSelected = selectedPath === node.path;

      return (
        <div key={node.path || node.name}>
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                className={cn(
                  'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-accent rounded-sm',
                  isSelected && 'bg-accent'
                )}
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
                onClick={() => handleNodeClick(node)}
              >
                {node.is_directory && (
                  <span className="w-4 h-4 flex items-center justify-center">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </span>
                )}
                {!node.is_directory && <span className="w-4" />}
                {getFileIcon(node.name, node.path, node.is_directory, isExpanded)}
                <span className="text-sm truncate">{node.name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {node.is_directory && (
                <>
                  <ContextMenuItem onClick={() => openCreateDialog('file', node.path)}>
                    <FilePlus className="h-4 w-4 mr-2" />
                    New File
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => openCreateDialog('folder', node.path)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem onClick={() => openRenameDialog(node.path, node.name)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive"
                onClick={() => {
                  setDeleteTarget({ path: node.path, name: node.name });
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {node.is_directory && isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className={cn('flex flex-col h-full bg-background border rounded-lg overflow-hidden', className)}>
        {/* Header - matches Editor/Contract Interface style */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/40">
          <div className="p-2 bg-primary/10 rounded-md">
            <FolderTree className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">File Explorer</h3>
            <p className="text-xs text-muted-foreground">Manage your project</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-2 py-1.5 border-b space-y-1.5">
          {/* Search Mode Tabs */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
            <button
              onClick={() => setSearchMode('filename')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                searchMode === 'filename'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <File className="h-3 w-3" />
              Files
            </button>
            <button
              onClick={() => setSearchMode('content')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                searchMode === 'content'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileSearch className="h-3 w-3" />
              Content
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={searchMode === 'filename' ? 'Search filenames...' : 'Search in file contents...'}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && clearSearch()}
              className="h-7 pl-7 pr-7 text-xs"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="text-[10px] text-muted-foreground">
              {isSearching ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>

        {/* Toolbar with File, Folder, Packages buttons */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => openCreateDialog('file', getCreateTargetDirectory())}
              title={`New File${selectedPath ? ` in ${getCreateTargetDirectory() || 'root'}` : ''}`}
            >
              <FilePlus className="h-3.5 w-3.5" />
              File
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => openCreateDialog('folder', getCreateTargetDirectory())}
              title={`New Folder${selectedPath ? ` in ${getCreateTargetDirectory() || 'root'}` : ''}`}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Folder
            </Button>
            {onOpenPackageManager && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={onOpenPackageManager}
                title="Manage packages"
              >
                <Package className="h-3.5 w-3.5" />
                Packages
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={fetchTree}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content area - Files or Search Results */}
        <ScrollArea className="flex-1">
          <div className="p-1">
            {/* Show search results when searching */}
            {searchQuery ? (
              isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-0.5">
                  {searchResults.map((result) => {
                    const isSelected = selectedPath === result.path;
                    return (
                      <div
                        key={`${result.path}-${result.line_number || 0}`}
                        className={cn(
                          'flex flex-col py-1.5 px-2 cursor-pointer hover:bg-accent rounded-sm',
                          isSelected && 'bg-accent'
                        )}
                        onClick={() => handleSearchResultClick(result)}
                      >
                        <div className="flex items-center gap-2">
                          {getFileIcon(result.name, result.path, false, false)}
                          <span className="text-sm font-medium truncate">{result.name}</span>
                          {result.line_number && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              :{result.line_number}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate ml-6">
                          {result.path}
                        </span>
                        {result.preview && (
                          <div className="text-[10px] text-muted-foreground mt-1 ml-6 bg-muted/50 px-1.5 py-1 rounded truncate font-mono">
                            {result.preview}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No files found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              )
            ) : (
              <>
                {/* Normal file tree view */}
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {error && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">{error}</p>
                    <Button variant="link" size="sm" onClick={fetchTree}>
                      Retry
                    </Button>
                  </div>
                )}
                {!loading && !error && tree && renderNode(tree)}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Create/Rename Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'rename'
                  ? 'Rename'
                  : dialogMode === 'file'
                  ? 'New File'
                  : 'New Folder'}
              </DialogTitle>
              <DialogDescription>
                {dialogMode === 'rename'
                  ? 'Enter a new name'
                  : `Create a new ${dialogMode} in ${dialogPath || 'root'}`}
              </DialogDescription>
            </DialogHeader>
            <Input
              value={dialogValue}
              onChange={e => setDialogValue(e.target.value)}
              placeholder={dialogMode === 'file' ? 'filename.rs' : 'folder-name'}
              onKeyDown={e => e.key === 'Enter' && handleDialogSubmit()}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDialogSubmit}>
                {dialogMode === 'rename' ? 'Rename' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the{' '}
                {deleteTarget?.path.includes('/') ? 'file' : 'item'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
);

FileExplorer.displayName = 'FileExplorer';
