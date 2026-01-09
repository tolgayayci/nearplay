import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TerminalIcon,
  Search,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ChevronUp,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface ParsedLine {
  lineNumber: number;
  content: string;
  type: 'error' | 'warning' | 'info' | 'success' | 'plain';
  rawContent: string;
}

interface TerminalOutputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputBuffer: string[];
  isConnected?: boolean;
}

export function TerminalOutputModal({
  open,
  onOpenChange,
  outputBuffer,
  isConnected = false,
}: TerminalOutputModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    errors: true,
    warnings: true,
    info: true,
    success: true,
    plain: true,
  });
  const [copied, setCopied] = useState(false);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const { theme, systemTheme } = useTheme();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const isDark = effectiveTheme === 'dark';

  // Strip ANSI codes from text
  const stripAnsi = (text: string): string => {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  };

  // Parse line type based on content
  const getLineType = (content: string): ParsedLine['type'] => {
    const lowerContent = content.toLowerCase();
    const strippedContent = stripAnsi(content);
    const lowerStripped = strippedContent.toLowerCase();

    // Check for error patterns
    if (
      lowerStripped.includes('error') ||
      lowerStripped.includes('failed') ||
      lowerStripped.includes('panic') ||
      content.includes('\x1b[31m') || // Red ANSI
      content.includes('\x1b[1;31m')
    ) {
      return 'error';
    }

    // Check for warning patterns
    if (
      lowerStripped.includes('warning') ||
      lowerStripped.includes('warn') ||
      content.includes('\x1b[33m') || // Yellow ANSI
      content.includes('\x1b[1;33m')
    ) {
      return 'warning';
    }

    // Check for success patterns
    if (
      lowerStripped.includes('success') ||
      lowerStripped.includes('finished') ||
      lowerStripped.includes('compiled') ||
      lowerStripped.includes('compiling') ||
      content.includes('\x1b[32m') || // Green ANSI
      content.includes('\x1b[1;32m')
    ) {
      return 'success';
    }

    // Check for info patterns
    if (
      lowerStripped.includes('[info]') ||
      lowerStripped.includes('downloading') ||
      lowerStripped.includes('building') ||
      content.includes('\x1b[36m') || // Cyan ANSI
      content.includes('\x1b[1;36m')
    ) {
      return 'info';
    }

    return 'plain';
  };

  // Parse all lines from buffer
  const parsedLines = useMemo((): ParsedLine[] => {
    return outputBuffer.map((line, index) => ({
      lineNumber: index + 1,
      content: stripAnsi(line),
      type: getLineType(line),
      rawContent: line,
    }));
  }, [outputBuffer]);

  // Filter and search lines
  const filteredLines = useMemo(() => {
    let lines = parsedLines;

    // Apply type filters
    lines = lines.filter((line) => {
      if (line.type === 'error' && !filters.errors) return false;
      if (line.type === 'warning' && !filters.warnings) return false;
      if (line.type === 'info' && !filters.info) return false;
      if (line.type === 'success' && !filters.success) return false;
      if (line.type === 'plain' && !filters.plain) return false;
      return true;
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      lines = lines.filter((line) =>
        line.content.toLowerCase().includes(query)
      );
    }

    return lines;
  }, [parsedLines, filters, searchQuery]);

  // Search matches for navigation
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredLines.map((line, index) => index);
  }, [filteredLines, searchQuery]);

  // Count by type
  const counts = useMemo(() => {
    return {
      errors: parsedLines.filter((l) => l.type === 'error').length,
      warnings: parsedLines.filter((l) => l.type === 'warning').length,
      info: parsedLines.filter((l) => l.type === 'info').length,
      success: parsedLines.filter((l) => l.type === 'success').length,
      plain: parsedLines.filter((l) => l.type === 'plain').length,
      total: parsedLines.length,
    };
  }, [parsedLines]);

  // Navigate search results
  const navigateSearch = useCallback(
    (direction: 'next' | 'prev') => {
      if (searchMatches.length === 0) return;

      let newIndex: number;
      if (direction === 'next') {
        newIndex = (currentSearchIndex + 1) % searchMatches.length;
      } else {
        newIndex =
          (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
      }
      setCurrentSearchIndex(newIndex);

      // Scroll to the line
      const lineElement = document.getElementById(`output-line-${searchMatches[newIndex]}`);
      lineElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [searchMatches, currentSearchIndex]
  );

  // Reset search index when query changes
  useEffect(() => {
    setCurrentSearchIndex(0);
  }, [searchQuery]);

  // Copy all output
  const handleCopyAll = useCallback(async () => {
    const text = filteredLines.map((l) => l.content).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  }, [filteredLines, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Enter to go to next search result
      if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        navigateSearch(e.shiftKey ? 'prev' : 'next');
      }
      // Escape to clear search or close modal
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          onOpenChange(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, searchQuery, navigateSearch, onOpenChange]);

  // Get line style based on type
  const getLineStyle = (type: ParsedLine['type']) => {
    switch (type) {
      case 'error':
        return isDark
          ? 'text-red-400 bg-red-950/30'
          : 'text-red-700 bg-red-50';
      case 'warning':
        return isDark
          ? 'text-yellow-400 bg-yellow-950/30'
          : 'text-yellow-700 bg-yellow-50';
      case 'success':
        return isDark
          ? 'text-green-400 bg-green-950/30'
          : 'text-green-700 bg-green-50';
      case 'info':
        return isDark
          ? 'text-cyan-400 bg-cyan-950/30'
          : 'text-cyan-700 bg-cyan-50';
      default:
        return isDark ? 'text-zinc-300' : 'text-zinc-700';
    }
  };

  // Get icon for line type
  const getLineIcon = (type: ParsedLine['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'info':
        return <Info className="h-3 w-3 text-cyan-500" />;
      case 'success':
        return <Check className="h-3 w-3 text-green-500" />;
      default:
        return null;
    }
  };

  // Highlight search matches in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={i}
          className={cn(
            'px-0.5 rounded',
            isDark ? 'bg-yellow-500/40 text-yellow-100' : 'bg-yellow-300 text-yellow-900'
          )}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const activeFilterCount = Object.values(filters).filter((v) => !v).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <TerminalIcon className="h-5 w-5" />
              Terminal Output
              {isConnected ? (
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Disconnected
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filteredLines.length} lines</Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/30 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search output... (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-24"
            />
            {searchQuery && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {searchMatches.length > 0
                    ? `${currentSearchIndex + 1}/${searchMatches.length}`
                    : '0/0'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigateSearch('prev')}
                  disabled={searchMatches.length === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigateSearch('next')}
                  disabled={searchMatches.length === 0}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show by type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.errors}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, errors: checked }))
                }
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  Errors
                  <Badge variant="secondary" className="ml-auto">
                    {counts.errors}
                  </Badge>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.warnings}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, warnings: checked }))
                }
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  Warnings
                  <Badge variant="secondary" className="ml-auto">
                    {counts.warnings}
                  </Badge>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.info}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, info: checked }))
                }
              >
                <div className="flex items-center gap-2">
                  <Info className="h-3 w-3 text-cyan-500" />
                  Info
                  <Badge variant="secondary" className="ml-auto">
                    {counts.info}
                  </Badge>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.success}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, success: checked }))
                }
              >
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Success
                  <Badge variant="secondary" className="ml-auto">
                    {counts.success}
                  </Badge>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.plain}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, plain: checked }))
                }
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3" />
                  Plain text
                  <Badge variant="secondary" className="ml-auto">
                    {counts.plain}
                  </Badge>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() =>
                  setFilters({
                    errors: true,
                    warnings: true,
                    info: true,
                    success: true,
                    plain: true,
                  })
                }
              >
                Reset filters
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy Button */}
          <Button variant="outline" onClick={handleCopyAll} className="gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All
              </>
            )}
          </Button>
        </div>

        {/* Summary badges */}
        {(counts.errors > 0 || counts.warnings > 0) && (
          <div className="flex-shrink-0 px-6 py-2 border-b bg-muted/10 flex items-center gap-2">
            {counts.errors > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'gap-1 cursor-pointer',
                  filters.errors
                    ? 'border-red-500/50 text-red-500'
                    : 'opacity-50'
                )}
                onClick={() => setFilters((f) => ({ ...f, errors: !f.errors }))}
              >
                <AlertCircle className="h-3 w-3" />
                {counts.errors} error{counts.errors !== 1 ? 's' : ''}
              </Badge>
            )}
            {counts.warnings > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'gap-1 cursor-pointer',
                  filters.warnings
                    ? 'border-yellow-500/50 text-yellow-500'
                    : 'opacity-50'
                )}
                onClick={() =>
                  setFilters((f) => ({ ...f, warnings: !f.warnings }))
                }
              >
                <AlertTriangle className="h-3 w-3" />
                {counts.warnings} warning{counts.warnings !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

        {/* Output Content */}
        <ScrollArea
          ref={scrollAreaRef}
          className={cn(
            'flex-1',
            isDark ? 'bg-zinc-950' : 'bg-white'
          )}
        >
          <div className="font-mono text-sm">
            {filteredLines.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                {outputBuffer.length === 0
                  ? 'No output yet...'
                  : 'No matching lines found'}
              </div>
            ) : (
              filteredLines.map((line, index) => (
                <div
                  key={line.lineNumber}
                  id={`output-line-${index}`}
                  className={cn(
                    'flex items-start hover:bg-muted/30 group',
                    getLineStyle(line.type),
                    searchMatches.length > 0 &&
                      index === searchMatches[currentSearchIndex] &&
                      'ring-2 ring-primary ring-inset'
                  )}
                >
                  {/* Line number */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-14 px-2 py-1 text-right select-none border-r',
                      isDark
                        ? 'text-zinc-600 border-zinc-800 bg-zinc-900/50'
                        : 'text-zinc-400 border-zinc-200 bg-zinc-50'
                    )}
                  >
                    {line.lineNumber}
                  </div>
                  {/* Type icon */}
                  <div className="flex-shrink-0 w-6 flex items-center justify-center py-1">
                    {getLineIcon(line.type)}
                  </div>
                  {/* Content */}
                  <div className="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
                    {highlightText(line.content, searchQuery)}
                  </div>
                  {/* Copy line button (on hover) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 mr-2 mt-0.5 transition-opacity"
                    onClick={async () => {
                      await navigator.clipboard.writeText(line.content);
                      toast({ title: 'Line copied' });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t bg-muted/30 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Tip: Use Ctrl+F to search, Enter to navigate results
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
