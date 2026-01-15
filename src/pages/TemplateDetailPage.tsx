import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';
import { SEO } from '@/components/seo/SEO';
import { useAuth } from '@/App';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UseTemplateDialog } from '@/components/templates/UseTemplateDialog';
import { FaucetDialog } from '@/components/faucet';
import {
  getTemplate,
  getTemplateFiles,
  getTemplateFile,
  incrementTemplateViews,
  TemplateFileNode,
} from '@/lib/templates-api';
import { toggleLikeTemplate, hasUserLikedTemplate } from '@/lib/likes-api';
import { initializeMonaco, defineEditorTheme, defaultEditorOptions } from '@/lib/editor';
import { getLanguageFromPath } from '@/lib/types';
import type { Template } from '@/lib/types';
import {
  ArrowLeft,
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
  Sparkles,
  Layout,
  Link2,
  Code2,
  Droplets,
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

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, systemTheme } = useTheme();

  const [template, setTemplate] = useState<Template | null>(null);
  const [fileTree, setFileTree] = useState<TemplateFileNode | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['', 'src']));
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [showFaucetDialog, setShowFaucetDialog] = useState(false);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Fetch template data on mount
  useEffect(() => {
    if (id) {
      fetchTemplateData();
      incrementTemplateViews(id).catch(console.error);
    }
  }, [id]);

  // Check if use=true query param is present
  useEffect(() => {
    if (searchParams.get('use') === 'true' && template) {
      setShowUseDialog(true);
    }
  }, [searchParams, template]);

  // Check if user has liked this template
  useEffect(() => {
    if (user && id) {
      hasUserLikedTemplate(id).then(setIsLiked).catch(console.error);
    }
  }, [user, id]);

  const fetchTemplateData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const [templateData, filesData] = await Promise.all([
        getTemplate(id),
        getTemplateFiles(id),
      ]);

      if (!templateData) {
        toast({
          title: 'Template not found',
          description: 'This template may have been deleted',
          variant: 'destructive',
        });
        navigate('/templates');
        return;
      }

      setTemplate(templateData);
      setFileTree(filesData);

      // Auto-select src/lib.rs if it exists
      const libRsPath = findFile(filesData, 'src/lib.rs');
      if (libRsPath) {
        setSelectedFilePath(libRsPath);
        loadFileContent(id, libRsPath);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast({
        title: 'Error',
        description: 'Failed to load template',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      if (id) {
        loadFileContent(id, path);
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
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like templates',
      });
      return;
    }

    if (!id) return;

    try {
      setIsLikeLoading(true);
      const nowLiked = await toggleLikeTemplate(id);
      setIsLiked(nowLiked);
      setTemplate((prev) =>
        prev
          ? { ...prev, likes_count: prev.likes_count + (nowLiked ? 1 : -1) }
          : prev
      );
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
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to use templates',
      });
      navigate('/auth');
      return;
    }
    setShowUseDialog(true);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Template not found</h2>
          <Button variant="link" onClick={() => navigate('/templates')}>
            Back to templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${template.name} | NearPlay Templates`}
        description={template.description || `${template.name} template for NEAR smart contracts`}
      />
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/templates')}
                className="md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950">
                  <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">NEAR Playground</span>
                </div>
              </div>
              <nav className="hidden md:flex items-center gap-1 ml-4">
                <Button variant="ghost" onClick={() => navigate('/projects')} className="gap-2">
                  <Code2 className="h-4 w-4" />
                  Projects
                </Button>
                <Button variant="ghost" onClick={() => navigate('/templates')} className="bg-muted gap-2">
                  <Layout className="h-4 w-4" />
                  Templates
                </Button>
                <Button variant="ghost" onClick={() => navigate('/embeds')} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Embeds
                </Button>
                {user && (
                  <Button variant="ghost" onClick={() => setShowFaucetDialog(true)} className="gap-2">
                    <Droplets className="h-4 w-4" />
                    Faucet
                  </Button>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <UserNav />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/templates')}
            className="mb-4 -ml-2 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Templates
          </Button>

          {/* Template Info */}
          <div className="mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{template.name}</h1>
                  {template.is_official && (
                    <Badge
                      variant="outline"
                      className="bg-blue-500/10 text-blue-500 border-blue-500/20"
                    >
                      Official
                    </Badge>
                  )}
                  {template.is_featured && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                      <Star className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  {template.description}
                </p>
                <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                  {template.author && (
                    <span>
                      Published by{' '}
                      <span className="font-medium text-foreground">
                        {template.author.name || template.author.email}
                      </span>
                    </span>
                  )}
                  {template.published_at && (
                    <>
                      {template.author && <span className="text-muted-foreground/50">|</span>}
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
                  onClick={handleLike}
                  disabled={isLikeLoading}
                  className={cn(isLiked && 'text-red-500 border-red-500/50')}
                >
                  <Heart className={cn('h-4 w-4 mr-2', isLiked && 'fill-current')} />
                  {template.likes_count || 0}
                </Button>
                <Button onClick={handleUseTemplate}>
                  Use Template
                </Button>
              </div>
            </div>

            {/* Badges and Stats */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={difficultyColors[template.difficulty] || ''}
                >
                  {template.difficulty}
                </Badge>
                <Badge variant="outline" className="bg-muted/50">
                  {template.category}
                </Badge>
                {template.source_type === 'github' && template.github_url && (
                  <Badge
                    variant="outline"
                    className="bg-muted/50 cursor-pointer hover:bg-muted"
                    onClick={() => window.open(template.github_url, '_blank')}
                  >
                    <Github className="h-3 w-3 mr-1" />
                    Source
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {template.uses_count || 0} uses
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {template.view_count || 0} views
                </span>
              </div>
            </div>

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4">
                {template.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs font-normal bg-secondary/50"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* File Explorer and Code Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
            {/* File Tree */}
            <div className="lg:col-span-1 border rounded-lg overflow-hidden bg-card">
              <div className="px-4 py-3 border-b bg-muted/40">
                <h3 className="font-medium text-sm">Files</h3>
              </div>
              <ScrollArea className="h-[calc(100%-49px)]">
                <div className="p-2">
                  {fileTree ? (
                    renderFileNode(fileTree)
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Code Preview */}
            <div className="lg:col-span-3 border rounded-lg overflow-hidden bg-card">
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                <h3 className="font-medium text-sm">
                  {selectedFilePath || 'Select a file to preview'}
                </h3>
              </div>
              <div className="h-[calc(100%-49px)]">
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
                      <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a file from the tree to preview its contents</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Use Template Dialog */}
      <UseTemplateDialog
        open={showUseDialog}
        onOpenChange={setShowUseDialog}
        template={template}
      />

      {/* Faucet Dialog */}
      <FaucetDialog
        open={showFaucetDialog}
        onOpenChange={setShowFaucetDialog}
        userId={user?.id || ''}
      />
    </>
  );
}
