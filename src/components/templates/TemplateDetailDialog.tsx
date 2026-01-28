import { useState, useEffect, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UseTemplateDialog } from './UseTemplateDialog';
import {
  getTemplateFiles,
  getTemplateFile,
  TemplateFileNode,
} from '@/lib/templates-api';
import { toggleLikeTemplate, hasUserLikedTemplate } from '@/lib/likes-api';
import { initializeMonaco, defineEditorTheme, defaultEditorOptions } from '@/lib/editor';
import { getLanguageFromPath } from '@/lib/types';
import type { Template } from '@/lib/types';
import {
  Heart,
  Download,
  Eye,
  Github,
  Star,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Settings,
  Loader2,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Difficulty colors
const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  Intermediate: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  Advanced: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

// File icon helper
function getFileIcon(name: string, isDirectory: boolean, isExpanded: boolean) {
  if (isDirectory) {
    return isExpanded ? (
      <FolderOpen className="h-4 w-4 text-yellow-500" />
    ) : (
      <Folder className="h-4 w-4 text-yellow-500" />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'rs':
      return <FileCode className="h-4 w-4 text-orange-500" />;
    case 'toml':
      return <Settings className="h-4 w-4 text-purple-500" />;
    case 'md':
      return <FileText className="h-4 w-4 text-blue-500" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

interface TemplateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  userId?: string;
}

export function TemplateDetailDialog({
  open,
  onOpenChange,
  template,
  userId,
}: TemplateDetailDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, systemTheme } = useTheme();

  const [fileTree, setFileTree] = useState<TemplateFileNode | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['', 'src']));
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(0);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Reset state when dialog opens with a new template
  useEffect(() => {
    if (open && template) {
      setFileTree(null);
      setSelectedFilePath(null);
      setFileContent('');
      setExpandedPaths(new Set(['', 'src']));
      setLocalLikesCount(template.likes_count || 0);
      fetchFiles();
      checkLikeStatus();
    }
  }, [open, template?.id]);

  const fetchFiles = async () => {
    if (!template?.id) return;

    try {
      setIsLoadingFiles(true);
      const filesData = await getTemplateFiles(template.id);
      setFileTree(filesData);

      // Auto-select src/lib.rs if it exists
      const libRsPath = findFile(filesData, 'src/lib.rs');
      if (libRsPath) {
        setSelectedFilePath(libRsPath);
        loadFileContent(template.id, libRsPath);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const checkLikeStatus = async () => {
    if (!userId || !template?.id) return;
    try {
      const liked = await hasUserLikedTemplate(template.id);
      setIsLiked(liked);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  // Find a file in the tree
  const findFile = (node: TemplateFileNode, targetPath: string): string | null => {
    if (node.path === targetPath) return node.path;
    if (node.children) {
      for (const child of node.children) {
        const found = findFile(child, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  // Load file content
  const loadFileContent = async (templateId: string, filePath: string) => {
    try {
      setIsLoadingFile(true);
      const content = await getTemplateFile(templateId, filePath);
      setFileContent(content);
    } catch (error) {
      console.error('Error loading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to load file content',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (path: string, isDirectory: boolean) => {
    if (isDirectory) {
      toggleExpand(path);
    } else {
      setSelectedFilePath(path);
      if (template?.id) {
        loadFileContent(template.id, path);
      }
    }
  };

  // Toggle folder expansion
  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Handle like
  const handleLike = async () => {
    if (!userId) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like templates',
      });
      return;
    }

    if (!template?.id) return;

    try {
      setIsLikeLoading(true);
      const nowLiked = await toggleLikeTemplate(template.id);
      setIsLiked(nowLiked);
      setLocalLikesCount((prev) => prev + (nowLiked ? 1 : -1));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    } finally {
      setIsLikeLoading(false);
    }
  };

  // Handle use template
  const handleUseTemplate = () => {
    if (!userId) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to use templates',
      });
      onOpenChange(false);
      navigate('/auth');
      return;
    }
    setShowUseDialog(true);
  };

  // Handle share
  const handleShare = () => {
    if (!template) return;
    const url = `${window.location.origin}/templates?t=${template.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copied',
      description: 'Template link copied to clipboard',
    });
  };

  // Monaco editor mount handler
  const handleEditorDidMount = (editor: any, monaco: any) => {
    initializeMonaco(monaco);
    defineEditorTheme(monaco, effectiveTheme === 'dark');
  };

  // Get language from file path
  const editorLanguage = useMemo(() => {
    if (!selectedFilePath) return 'plaintext';
    return getLanguageFromPath(selectedFilePath);
  }, [selectedFilePath]);

  // Render file tree node
  const renderFileNode = (node: TemplateFileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedFilePath === node.path;

    return (
      <div key={node.path || node.name}>
        <div
          className={cn(
            'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-accent rounded-sm',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => handleFileSelect(node.path, node.is_directory)}
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
          {getFileIcon(node.name, node.is_directory, isExpanded)}
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {node.is_directory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!template) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="text-xl font-bold">
                    {template.name}
                  </DialogTitle>
                  {template.is_official && (
                    <Badge
                      variant="outline"
                      className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                    >
                      NEAR Playground
                    </Badge>
                  )}
                  {template.is_featured && !template.is_official && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                      <Star className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {template.description}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {template.author && (
                    <span>
                      by{' '}
                      <span className="font-medium text-foreground">
                        {template.author.name || template.author.email}
                      </span>
                    </span>
                  )}
                  {template.published_at && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>
                        {formatDistanceToNow(new Date(template.published_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLike}
                  disabled={isLikeLoading}
                  className={cn(isLiked && 'text-red-500 border-red-500/50')}
                >
                  <Heart className={cn('h-4 w-4 mr-1', isLiked && 'fill-current')} />
                  {localLikesCount}
                </Button>
                <Button size="sm" onClick={handleUseTemplate}>
                  Use Template
                </Button>
              </div>
            </div>

            {/* Badges and Stats */}
            <div className="flex flex-wrap items-center gap-4 mt-5">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs', difficultyColors[template.difficulty] || '')}
                >
                  {template.difficulty}
                </Badge>
                <Badge variant="outline" className="bg-muted/50 text-xs">
                  {template.category}
                </Badge>
                {template.source_type === 'github' && template.github_url && (
                  <Badge
                    variant="outline"
                    className="bg-muted/50 cursor-pointer hover:bg-muted text-xs"
                    onClick={() => window.open(template.github_url, '_blank')}
                  >
                    <Github className="h-3 w-3 mr-1" />
                    Source
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {template.uses_count || 0} uses
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {template.view_count || 0} views
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* File Explorer and Code Preview */}
          <div className="flex-1 overflow-hidden p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[450px]">
              {/* File Tree */}
              <div className="lg:col-span-1 border rounded-lg overflow-hidden bg-card">
                <div className="px-3 py-2 border-b bg-muted/40">
                  <h3 className="font-medium text-sm">Files</h3>
                </div>
                <ScrollArea className="h-[calc(100%-41px)]">
                  <div className="p-2">
                    {isLoadingFiles ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : fileTree ? (
                      renderFileNode(fileTree)
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No files available
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Code Preview */}
              <div className="lg:col-span-3 border rounded-lg overflow-hidden bg-card">
                <div className="px-3 py-2 border-b bg-muted/40">
                  <h3 className="font-medium text-sm">
                    {selectedFilePath || 'Select a file to preview'}
                  </h3>
                </div>
                <div className="h-[calc(100%-41px)]">
                  {isLoadingFile ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : selectedFilePath ? (
                    <MonacoEditor
                      height="100%"
                      language={editorLanguage}
                      value={fileContent}
                      options={{
                        ...defaultEditorOptions,
                        readOnly: true,
                        theme: effectiveTheme === 'dark' ? 'rust-dark' : 'rust-light',
                      }}
                      onMount={handleEditorDidMount}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <FileCode className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Select a file from the tree to preview</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Use Template Dialog */}
      <UseTemplateDialog
        open={showUseDialog}
        onOpenChange={setShowUseDialog}
        template={template}
        onSuccess={() => {
          setShowUseDialog(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
