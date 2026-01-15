import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';
import { SEO } from '@/components/seo/SEO';
import { EmbedGeneratorDialog } from '@/components/embeds/EmbedGeneratorDialog';
import { FaucetDialog } from '@/components/faucet';
import { useAuth } from '@/App';
import { useToast } from '@/hooks/use-toast';
import {
  getUserEmbeds,
  deleteEmbed,
  generateEmbedCode,
  generateInlineButtonCode,
} from '@/lib/embeds-api';
import type { Embed } from '@/lib/types';
import {
  Plus,
  Loader2,
  ExternalLink,
  Copy,
  Trash2,
  MousePointer,
  Eye,
  Github,
  FolderOpen,
  Layout,
  Check,
  Sparkles,
  Link2,
  Code2,
  Droplets,
  Clock,
  ChevronDown,
  Image,
  FileCode,
  FileText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

export function EmbedsPage() {
  const [embeds, setEmbeds] = useState<Embed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [embedToDelete, setEmbedToDelete] = useState<Embed | null>(null);
  const [copiedEmbedId, setCopiedEmbedId] = useState<string | null>(null);
  const [showFaucetDialog, setShowFaucetDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch embeds on mount
  useEffect(() => {
    if (user) {
      fetchEmbeds();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchEmbeds = async () => {
    try {
      setIsLoading(true);
      const data = await getUserEmbeds();
      setEmbeds(data);
    } catch (error) {
      console.error('Error fetching embeds:', error);
      toast({
        title: 'Error',
        description: 'Failed to load embeds',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEmbed = async () => {
    if (!embedToDelete) return;

    try {
      await deleteEmbed(embedToDelete.id);
      setEmbeds((prev) => prev.filter((e) => e.id !== embedToDelete.id));
      toast({
        title: 'Embed deleted',
        description: 'The embed has been deleted',
      });
    } catch (error) {
      console.error('Error deleting embed:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete embed',
        variant: 'destructive',
      });
    } finally {
      setEmbedToDelete(null);
    }
  };

  const handleCopyCode = async (embed: Embed, format: 'html' | 'inline' | 'markdown') => {
    try {
      const codes = generateEmbedCode(embed);
      const inlineCode = generateInlineButtonCode(embed);

      let textToCopy = '';
      let formatLabel = '';

      switch (format) {
        case 'html':
          textToCopy = codes.html;
          formatLabel = 'HTML (Image)';
          break;
        case 'inline':
          textToCopy = inlineCode;
          formatLabel = 'HTML (Button)';
          break;
        case 'markdown':
          textToCopy = codes.markdown;
          formatLabel = 'Markdown';
          break;
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopiedEmbedId(embed.id);
      setTimeout(() => setCopiedEmbedId(null), 2000);
      toast({
        title: 'Copied',
        description: `${formatLabel} code copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleEmbedCreated = (embedId: string) => {
    fetchEmbeds();
    toast({
      title: 'Embed created',
      description: 'Your embed has been created',
    });
  };

  // Get source icon
  const getSourceIcon = (embed: Embed) => {
    switch (embed.source_type) {
      case 'template':
        return <Layout className="h-4 w-4" />;
      case 'project':
        return <FolderOpen className="h-4 w-4" />;
      case 'github':
        return <Github className="h-4 w-4" />;
    }
  };

  // Get source name
  const getSourceName = (embed: Embed) => {
    switch (embed.source_type) {
      case 'template':
        return embed.template?.name || 'Template';
      case 'project':
        return embed.project?.name || 'Project';
      case 'github':
        return embed.github_url?.split('/').slice(-2).join('/') || 'GitHub';
    }
  };

  return (
    <>
      <SEO
        title="My Embeds | NearPlay"
        description="Manage your embeddable NearPlay buttons"
      />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
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
                <Button variant="ghost" onClick={() => navigate('/templates')} className="gap-2">
                  <Layout className="h-4 w-4" />
                  Templates
                </Button>
                <Button variant="ghost" className="bg-muted gap-2">
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
        <main className="container mx-auto px-0 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 via-blue-500/10 to-purple-500/10">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">My Embeds</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Create embeddable buttons to share your templates and projects
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Embed
            </Button>
          </div>

              {/* Loading */}
              {isLoading ? (
                <div className="rounded-lg border bg-card animate-pulse">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
                      <div className="w-10 h-10 rounded-md bg-muted" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-48 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : embeds.length === 0 ? (
                // Empty state
                <div className="min-h-[calc(100vh-16rem)] rounded-lg border bg-card flex items-center justify-center p-8">
                  <div className="text-center max-w-sm mx-auto">
                    <div className="relative mx-auto w-24 h-24">
                      <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                      <div className="relative bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center">
                        <Sparkles className="h-12 w-12 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold mt-6">No Embeds Yet</h3>
                    <p className="text-muted-foreground mt-2">
                      Create embeddable buttons to share your templates and
                      projects on external websites.
                    </p>
                    <Button
                      onClick={() => setShowCreateDialog(true)}
                      className="mt-6 gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Your First Embed
                    </Button>
                  </div>
                </div>
              ) : (
                // Embeds table
                <div className="flex flex-col">
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[35%]">Name</th>
                          <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[15%]">Type</th>
                          <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[12%]">Clicks</th>
                          <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[12%]">Views</th>
                          <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[18%]">Created</th>
                          <th className="h-12 px-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(() => {
                          const totalPages = Math.max(1, Math.ceil(embeds.length / itemsPerPage));
                          const startIndex = (currentPage - 1) * itemsPerPage;
                          const paginatedEmbeds = embeds.slice(startIndex, startIndex + itemsPerPage);

                          return paginatedEmbeds.map((embed) => (
                            <tr
                              key={embed.id}
                              className="group hover:bg-muted/50 transition-colors duration-100"
                            >
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20">
                                    <Link2 className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="font-medium truncate max-w-[200px]">
                                      {embed.name || getSourceName(embed)}
                                    </span>
                                    {embed.name && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                        {getSourceName(embed)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                                  {getSourceIcon(embed)}
                                  {embed.source_type}
                                </Badge>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MousePointer className="h-4 w-4 flex-shrink-0" />
                                  <span>{embed.click_count}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Eye className="h-4 w-4 flex-shrink-0" />
                                  <span>{embed.view_count}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">
                                    {formatDistanceToNow(new Date(embed.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center justify-end gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                      >
                                        {copiedEmbedId === embed.id ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                        Copy
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleCopyCode(embed, 'html')}>
                                        <Image className="mr-2 h-4 w-4" />
                                        HTML (Image)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleCopyCode(embed, 'inline')}>
                                        <FileCode className="mr-2 h-4 w-4" />
                                        HTML (Button)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleCopyCode(embed, 'markdown')}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Markdown
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                  >
                                    <a
                                      href={`/embed/${embed.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="gap-1.5"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      Preview
                                    </a>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEmbedToDelete(embed)}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(embeds.length / itemsPerPage));
                    const startIndex = (currentPage - 1) * itemsPerPage;

                    if (totalPages <= 1) return null;

                    return (
                      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                        <div>
                          Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, embeds.length)} of{' '}
                          {embeds.length} embeds
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="w-8"
                            >
                              {page}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!embedToDelete}
        onOpenChange={(open) => !open && setEmbedToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Embed</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this embed? This action cannot be
              undone and any websites using this embed will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmbed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Faucet Dialog */}
      <FaucetDialog
        open={showFaucetDialog}
        onOpenChange={setShowFaucetDialog}
        userId={user?.id || ''}
      />

      {/* Embed Generator Dialog */}
      <EmbedGeneratorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onEmbedCreated={handleEmbedCreated}
      />
    </>
  );
}
