import React from 'react';
import { X, FileCode, Settings, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpenFile, isFileDirty } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FileTabsProps {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
  onCloseAllFiles?: () => void;
  className?: string;
}

// Get file icon based on extension
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'rs':
      return <FileCode className="h-3.5 w-3.5 text-orange-500" />;
    case 'toml':
      return <Settings className="h-3.5 w-3.5 text-gray-500" />;
    case 'md':
      return <FileText className="h-3.5 w-3.5 text-blue-500" />;
    case 'json':
      return <FileCode className="h-3.5 w-3.5 text-yellow-600" />;
    default:
      return <File className="h-3.5 w-3.5 text-gray-400" />;
  }
}

export function FileTabs({
  openFiles,
  activeFilePath,
  onSelectFile,
  onCloseFile,
  onCloseAllFiles,
  className,
}: FileTabsProps) {
  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center border-b bg-muted/30 overflow-x-auto', className)}>
      <div className="flex items-center min-w-0 flex-1">
        {openFiles.map(file => {
          const isActive = file.path === activeFilePath;
          const isDirty = isFileDirty(file);

          return (
            <div
              key={file.path}
              className={cn(
                'group flex items-center gap-1.5 px-3 py-1.5 border-r cursor-pointer min-w-0',
                'hover:bg-accent/50 transition-colors',
                isActive ? 'bg-background border-b-2 border-b-primary' : 'bg-muted/50'
              )}
              onClick={() => onSelectFile(file.path)}
            >
              {getFileIcon(file.name)}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm truncate max-w-[120px]">
                    {file.name}
                    {isDirty && <span className="text-primary ml-0.5">*</span>}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{file.path}</p>
                  {isDirty && <p className="text-xs text-muted-foreground">Unsaved changes</p>}
                </TooltipContent>
              </Tooltip>
              <button
                className={cn(
                  'ml-1 p-0.5 rounded hover:bg-accent',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  isDirty && 'opacity-100'
                )}
                onClick={e => {
                  e.stopPropagation();
                  onCloseFile(file.path);
                }}
              >
                {isDirty ? (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {openFiles.length > 1 && onCloseAllFiles && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onCloseAllFiles}
        >
          Close All
        </Button>
      )}
    </div>
  );
}
