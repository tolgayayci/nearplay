import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { SEO } from '@/components/seo/SEO';
import { useAuth } from '@/App';
import { useToast } from '@/hooks/use-toast';
import {
  getEmbed,
  recordEmbedClick,
  incrementEmbedViews,
} from '@/lib/embeds-api';
import { useTemplate } from '@/lib/templates-api';
import { supabase } from '@/lib/supabase';
import type { Embed } from '@/lib/types';
import {
  Code2,
  Loader2,
  FolderOpen,
  ArrowRight,
  Github,
  Sparkles,
  Layout,
  User,
  Calendar,
} from 'lucide-react';

export function EmbedPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [embed, setEmbed] = useState<Embed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [sourceNotFound, setSourceNotFound] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch embed data on mount
  useEffect(() => {
    if (id) {
      fetchEmbed();
    }
  }, [id]);

  const fetchEmbed = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const embedData = await getEmbed(id);

      console.log('Fetched embed data:', embedData);

      if (!embedData) {
        console.log('No embed data returned');
        setNotFound(true);
        return;
      }

      // Check if template source is missing (deleted or unpublished) and no snapshot data
      if (embedData.source_type === 'template' && !embedData.template && !embedData.snapshot_name) {
        console.log('Template source not found for embed (no template or snapshot data)');
        setSourceNotFound(true);
        setEmbed(embedData); // Still set embed to show partial info
        return;
      }

      // For project embeds, check if we have snapshot data (new) or project join (legacy)
      if (embedData.source_type === 'project' && !embedData.snapshot_name && !embedData.project) {
        console.log('Project source not found for embed (no snapshot or project data)');
        setSourceNotFound(true);
        setEmbed(embedData);
        return;
      }

      setEmbed(embedData);

      // Track view
      incrementEmbedViews(id).catch(console.error);
    } catch (error) {
      console.error('Error fetching embed:', error);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create a project',
      });
      navigate(`/auth?redirect=/embed/${id}`);
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleCreateProject = async () => {
    if (!embed) return;

    // Record click
    if (id) {
      recordEmbedClick(id, document.referrer, navigator.userAgent).catch(
        console.error
      );
    }

    try {
      setIsCreating(true);

      // Generate project ID
      const newProjectId = crypto.randomUUID();

      // Create project based on source type
      if (embed.source_type === 'template' && (embed.template || embed.template_id)) {
        const templateId = embed.template?.id || embed.template_id;
        const templateName = embed.template?.name || 'template';
        const templateDescription = embed.template?.description || null;

        if (!templateId) {
          throw new Error('Template not found');
        }

        // Create project record
        const { error: dbError } = await supabase.from('projects').insert({
          id: newProjectId,
          user_id: user.id,
          name: templateName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: templateDescription,
          code: '',
          metadata: {
            created_from_embed: true,
            embed_id: embed.id,
            embed_source_type: embed.source_type,
            embed_source_name: templateName,
          },
        });

        if (dbError) throw new Error(dbError.message);

        // Use the template
        await useTemplate(templateId, user.id, newProjectId);

        toast({
          title: 'Project created',
          description: `Created from "${templateName}" template`,
        });

        navigate(`/projects/${newProjectId}`);
      } else if (embed.source_type === 'project' && (embed.code || embed.project || embed.snapshot_name)) {
        // Create project from snapshot data
        const projectName = embed.snapshot_name || embed.project?.name || 'Unnamed Project';
        const projectDescription = embed.snapshot_description || embed.project?.description;
        const projectCode = embed.code || embed.project?.code || '';

        const { error: dbError } = await supabase.from('projects').insert({
          id: newProjectId,
          user_id: user.id,
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: projectDescription || null,
          code: projectCode,
          metadata: {
            created_from_embed: true,
            embed_id: embed.id,
            embed_source_type: embed.source_type,
            embed_source_name: projectName,
          },
        });

        if (dbError) throw new Error(dbError.message);

        toast({
          title: 'Project created',
          description: `Created from "${projectName}" project`,
        });

        navigate(`/projects/${newProjectId}`);
      } else if (embed.source_type === 'github' && embed.github_url) {
        // Handle GitHub import
        navigate(`/projects?import=${encodeURIComponent(embed.github_url)}`);
      } else {
        throw new Error('Unable to create project: embed source data is missing');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create project',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SEO title="Loading... | NearPlay" />
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found state
  if (notFound || sourceNotFound) {
    return (
      <>
        <SEO
          title="Embed Not Found | NearPlay"
          description="This embed no longer exists"
        />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="p-4 rounded-xl bg-destructive/10 w-fit mx-auto mb-6">
              <Code2 className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {sourceNotFound ? 'Source Not Available' : 'Embed Not Found'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {sourceNotFound
                ? 'The template or project for this embed is not accessible. It may have been removed or unpublished.'
                : 'This embed no longer exists.'}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/templates')} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Explore Templates
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Get source name and description
  // Prefer snapshot data (new), fall back to joined data (legacy)
  const sourceName =
    embed?.source_type === 'template'
      ? embed.snapshot_name || embed.template?.name
      : embed?.source_type === 'project'
      ? embed.snapshot_name || embed.project?.name
      : 'GitHub Repository';

  const sourceDescription =
    embed?.source_type === 'template'
      ? embed.snapshot_description || embed.template?.description
      : embed?.source_type === 'project'
      ? embed.snapshot_description || embed.project?.description
      : embed?.github_url;

  const getSourceIcon = () => {
    if (embed?.source_type === 'template') return <Layout className="h-5 w-5" />;
    if (embed?.source_type === 'project') return <FolderOpen className="h-5 w-5" />;
    return <Github className="h-5 w-5" />;
  };

  const getSourceLabel = () => {
    if (embed?.source_type === 'template') return 'Template';
    if (embed?.source_type === 'project') return 'Project';
    return 'GitHub';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAuthorName = () => {
    if (!embed?.author) return 'Unknown';
    return embed.author.name || embed.author.email.split('@')[0];
  };

  return (
    <>
      <SEO
        title={`${sourceName || 'Open in NearPlay'} | NearPlay`}
        description={sourceDescription || 'Create a NEAR smart contract project'}
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-3 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950">
                <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">NEAR Playground</span>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-card border rounded-xl overflow-hidden">
            {/* Card Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 dark:bg-teal-950 rounded-full text-sm font-medium text-teal-600 dark:text-teal-400">
                  {getSourceIcon()}
                  {getSourceLabel()}
                </div>
              </div>
              <h1 className="text-2xl font-bold text-center mb-2">{sourceName}</h1>
              {sourceDescription && (
                <p className="text-center text-muted-foreground text-sm">
                  {sourceDescription}
                </p>
              )}
            </div>

            {/* Card Body */}
            <div className="p-6">
              {/* Publisher info */}
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span>By {getAuthorName()}</span>
                </div>
                {embed?.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(embed.created_at)}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground text-center mb-6">
                Create a new project from this {getSourceLabel().toLowerCase()} and start building on NEAR.
              </p>

              {/* Action Button */}
              {!user ? (
                <div className="space-y-4">
                  <Button
                    onClick={() => navigate(`/auth?redirect=/embed/${id}`)}
                    className="w-full gap-2"
                    size="lg"
                  >
                    Sign in to Create Project
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Free account required to create projects
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleButtonClick}
                  disabled={isCreating}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Project...
                    </>
                  ) : (
                    <>
                      Create Project
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-xs text-muted-foreground">
              Powered by{' '}
              <a
                href="https://nearplay.app"
                className="text-teal-600 dark:text-teal-400 hover:underline"
              >
                NEAR Playground
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Project</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You're about to create a new project from "{sourceName}".
              </span>
              <span className="block text-muted-foreground">
                This will create a private copy in your account that only you can see and edit.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateProject}>
              Create Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
