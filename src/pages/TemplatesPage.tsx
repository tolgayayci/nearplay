import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { TemplateGallery } from '@/components/templates/TemplateGallery';
import { PublishTemplateDialog } from '@/components/templates/PublishTemplateDialog';
import { UseTemplateDialog } from '@/components/templates/UseTemplateDialog';
import { TemplateDetailDialog } from '@/components/templates/TemplateDetailDialog';
import { FaucetDialog } from '@/components/faucet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';
import { SEO } from '@/components/seo/SEO';
import { useAuth } from '@/App';
import { useToast } from '@/hooks/use-toast';
import {
  getTemplates,
  getTemplateCategories,
  getTemplateTags,
  incrementTemplateViews,
  deleteTemplate,
} from '@/lib/templates-api';
import {
  toggleLikeTemplate,
  getUserLikedItems,
} from '@/lib/likes-api';
import type { Template } from '@/lib/types';
import { Plus, Sparkles, Layout, Link2, Code2, Droplets } from 'lucide-react';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [likingTemplateId, setLikingTemplateId] = useState<string | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showFaucetDialog, setShowFaucetDialog] = useState(false);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch templates, categories, and tags on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Open detail dialog if template ID is in URL
  useEffect(() => {
    const templateId = searchParams.get('t');
    if (templateId && templates.length > 0) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setSelectedTemplate(template);
        setShowDetailDialog(true);
        // Note: View count is incremented in handleTemplateClick, not here
      }
      // Clear the query param
      setSearchParams({});
    }
  }, [searchParams, templates]);

  // Fetch user's liked templates when logged in
  useEffect(() => {
    if (user) {
      fetchLikedTemplates();
    } else {
      setLikedTemplateIds(new Set());
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [templatesData, categoriesData, tagsData] = await Promise.all([
        getTemplates(),
        getTemplateCategories(),
        getTemplateTags(),
      ]);
      setTemplates(templatesData);
      setCategories(categoriesData);
      setTags(tagsData);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLikedTemplates = async () => {
    try {
      const likedIds = await getUserLikedItems('template');
      setLikedTemplateIds(new Set(likedIds));
    } catch (error) {
      console.error('Error fetching liked templates:', error);
    }
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowDetailDialog(true);
    // Increment view count
    incrementTemplateViews(template.id).catch(console.error);
  };

  const handleUseTemplate = (template: Template) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to use templates',
      });
      navigate('/auth');
      return;
    }
    setSelectedTemplate(template);
    setShowUseDialog(true);
  };

  const handleLikeTemplate = async (template: Template) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like templates',
      });
      return;
    }

    try {
      setLikingTemplateId(template.id);
      const isNowLiked = await toggleLikeTemplate(template.id);

      // Update local state
      setLikedTemplateIds((prev) => {
        const newSet = new Set(prev);
        if (isNowLiked) {
          newSet.add(template.id);
        } else {
          newSet.delete(template.id);
        }
        return newSet;
      });

      // Update template likes count in local state
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? { ...t, likes_count: t.likes_count + (isNowLiked ? 1 : -1) }
            : t
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    } finally {
      setLikingTemplateId(null);
    }
  };

  const handlePublishTemplate = () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to publish templates',
      });
      navigate('/auth');
      return;
    }
    setShowPublishDialog(true);
  };

  const handleDeleteTemplate = (template: Template) => {
    if (template.is_official) {
      toast({
        title: 'Cannot delete',
        description: 'Official templates cannot be deleted',
        variant: 'destructive',
      });
      return;
    }
    if (!user || template.user_id !== user.id) {
      toast({
        title: 'Unauthorized',
        description: 'You can only delete your own templates',
        variant: 'destructive',
      });
      return;
    }
    setTemplateToDelete(template);
    setShowDeleteDialog(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      setIsDeleting(true);
      await deleteTemplate(templateToDelete.id);
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      toast({
        title: 'Template removed',
        description: 'Your template has been removed successfully',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove template',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setTemplateToDelete(null);
    }
  };

  return (
    <>
      <SEO
        title="Template Marketplace | NearPlay"
        description="Browse and use community templates for NEAR smart contracts. Find fungible tokens, NFTs, games, and more."
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
                <Button variant="ghost" className="bg-muted gap-2">
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
        <main className="container mx-auto px-0 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 via-blue-500/10 to-purple-500/10">
                <Layout className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Template Marketplace</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse community templates and start building faster
                </p>
              </div>
            </div>
            {user && (
              <Button onClick={handlePublishTemplate} className="gap-2">
                <Plus className="h-4 w-4" />
                Publish Template
              </Button>
            )}
          </div>

          {/* Gallery */}
          <TemplateGallery
            templates={templates}
            categories={categories}
            tags={tags}
            isLoading={isLoading}
            likedTemplateIds={likedTemplateIds}
            currentUserId={user?.id}
            onTemplateClick={handleTemplateClick}
            onUseTemplate={handleUseTemplate}
            onLikeTemplate={handleLikeTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            likingTemplateId={likingTemplateId}
            onPublishTemplate={user ? handlePublishTemplate : undefined}
          />
        </main>
      </div>

      {/* Publish Template Dialog */}
      <PublishTemplateDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        onSuccess={(template) => {
          // Add to templates list and show detail dialog
          setTemplates((prev) => [template, ...prev]);
          setSelectedTemplate(template);
          setShowDetailDialog(true);
        }}
      />

      {/* Template Detail Dialog */}
      <TemplateDetailDialog
        open={showDetailDialog}
        onOpenChange={(open) => {
          setShowDetailDialog(open);
          if (!open) setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        userId={user?.id}
      />

      {/* Use Template Dialog (for direct use from table) */}
      {selectedTemplate && !showDetailDialog && (
        <UseTemplateDialog
          open={showUseDialog}
          onOpenChange={(open) => {
            setShowUseDialog(open);
            if (!open) setSelectedTemplate(null);
          }}
          template={selectedTemplate}
        />
      )}

      {/* Faucet Dialog */}
      <FaucetDialog
        open={showFaucetDialog}
        onOpenChange={setShowFaucetDialog}
        userId={user?.id || ''}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{templateToDelete?.name}" from the marketplace.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
