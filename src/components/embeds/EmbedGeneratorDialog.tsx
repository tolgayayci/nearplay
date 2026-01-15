import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/App';
import { supabase } from '@/lib/supabase';
import { getTemplates } from '@/lib/templates-api';
import {
  createEmbed,
  generateEmbedCode,
  generateInlineButtonCode,
} from '@/lib/embeds-api';
import type {
  Template,
  Project,
  EmbedSourceType,
  EmbedButtonStyle,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Github,
  FolderOpen,
  Layout,
  Copy,
  Check,
} from 'lucide-react';

interface EmbedGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmbedCreated?: (embedId: string) => void;
  preSelectedTemplateId?: string;
  preSelectedProjectId?: string;
}

const BUTTON_STYLES: { value: EmbedButtonStyle; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
];

export function EmbedGeneratorDialog({
  open,
  onOpenChange,
  onEmbedCreated,
  preSelectedTemplateId,
  preSelectedProjectId,
}: EmbedGeneratorDialogProps) {
  const [sourceType, setSourceType] = useState<EmbedSourceType>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState(preSelectedTemplateId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(preSelectedProjectId || '');
  const [githubUrl, setGithubUrl] = useState('');
  const [buttonText, setButtonText] = useState('Open in NearPlay');
  const [buttonStyle, setButtonStyle] = useState<EmbedButtonStyle>('primary');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, user]);

  useEffect(() => {
    if (preSelectedTemplateId) {
      setSourceType('template');
      setSelectedTemplateId(preSelectedTemplateId);
    }
    if (preSelectedProjectId) {
      setSourceType('project');
      setSelectedProjectId(preSelectedProjectId);
    }
  }, [preSelectedTemplateId, preSelectedProjectId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const templatesData = await getTemplates();
      setTemplates(templatesData);

      if (user) {
        // Fetch all user projects (code is snapshotted at embed creation)
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, name, description')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        setProjects(projectsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const previewEmbed = useMemo(() => {
    return {
      id: 'preview',
      user_id: user?.id || '',
      source_type: sourceType,
      button_text: buttonText,
      button_style: buttonStyle,
      button_size: 'default' as const,
      theme: 'auto' as const,
      click_count: 0,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [sourceType, buttonText, buttonStyle, user]);

  const embedCodes = useMemo(() => {
    return {
      ...generateEmbedCode(previewEmbed as any),
      inline: generateInlineButtonCode(previewEmbed as any),
    };
  }, [previewEmbed]);

  // Validate source selection
  const isSourceValid =
    (sourceType === 'template' && selectedTemplateId) ||
    (sourceType === 'project' && selectedProjectId) ||
    (sourceType === 'github' && githubUrl.trim());

  const handleCreate = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create an embed',
      });
      return;
    }

    if (sourceType === 'template' && !selectedTemplateId) {
      toast({ title: 'Template required', description: 'Please select a template', variant: 'destructive' });
      return;
    }
    if (sourceType === 'project' && !selectedProjectId) {
      toast({ title: 'Project required', description: 'Please select a project', variant: 'destructive' });
      return;
    }
    if (sourceType === 'github' && !githubUrl) {
      toast({ title: 'GitHub URL required', description: 'Please enter a GitHub URL', variant: 'destructive' });
      return;
    }

    try {
      setIsCreating(true);
      const embed = await createEmbed({
        source_type: sourceType,
        template_id: sourceType === 'template' ? selectedTemplateId : undefined,
        project_id: sourceType === 'project' ? selectedProjectId : undefined,
        github_url: sourceType === 'github' ? githubUrl : undefined,
        button_text: buttonText,
        button_style: buttonStyle,
        button_size: 'default',
        theme: 'auto',
      });

      toast({ title: 'Embed created', description: 'Your embed has been created successfully' });
      onEmbedCreated?.(embed.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating embed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create embed',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string, tab: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 2000);
      toast({ title: 'Copied', description: 'Code copied to clipboard' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Embed</DialogTitle>
          <DialogDescription>
            Generate an embeddable button for your template or project
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2 overflow-hidden">
            {/* Source Type Tabs */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Source</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={sourceType === 'template' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceType('template')}
                  className="flex-1 gap-1.5"
                >
                  <Layout className="h-3.5 w-3.5" />
                  Template
                </Button>
                <Button
                  type="button"
                  variant={sourceType === 'project' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceType('project')}
                  className="flex-1 gap-1.5"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Project
                </Button>
                <Button
                  type="button"
                  variant={sourceType === 'github' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceType('github')}
                  className="flex-1 gap-1.5"
                >
                  <Github className="h-3.5 w-3.5" />
                  GitHub
                </Button>
              </div>

              {/* Source Selector */}
              <div className="mt-2">
                {sourceType === 'template' && (
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {sourceType === 'project' && (
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No projects available
                        </div>
                      ) : (
                        projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {sourceType === 'github' && (
                  <Input
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                  />
                )}
              </div>
            </div>

            {/* Customization - Compact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Button Text</Label>
                <Input
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Open in NearPlay"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Style</Label>
                <Select value={buttonStyle} onValueChange={(v) => setButtonStyle(v as EmbedButtonStyle)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview - Compact */}
            <div className="space-y-1.5">
              <Label className="text-xs">Preview</Label>
              <div className="p-4 rounded-md border bg-muted/30 flex items-center justify-center">
                <div
                  dangerouslySetInnerHTML={{ __html: embedCodes.inline }}
                  className="[&_a]:cursor-default [&_a]:pointer-events-none"
                />
              </div>
            </div>

            {/* Embed Code - Compact Tabs */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs">Embed Code</Label>
              <Tabs defaultValue="html" className="w-full min-w-0">
                <TabsList className="h-8">
                  <TabsTrigger value="html" className="text-xs px-2 h-6">HTML (Image)</TabsTrigger>
                  <TabsTrigger value="inline" className="text-xs px-2 h-6">HTML (Button)</TabsTrigger>
                  <TabsTrigger value="markdown" className="text-xs px-2 h-6">Markdown</TabsTrigger>
                </TabsList>
                <TabsContent value="html" className="mt-2">
                  <div className="relative">
                    <pre className="p-3 pr-10 rounded-md bg-muted/50 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                      {embedCodes.html}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(embedCodes.html, 'html')}
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                    >
                      {copiedTab === 'html' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="inline" className="mt-2">
                  <div className="relative">
                    <pre className="p-3 pr-10 rounded-md bg-muted/50 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                      {embedCodes.inline}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(embedCodes.inline, 'inline')}
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                    >
                      {copiedTab === 'inline' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="markdown" className="mt-2">
                  <div className="relative">
                    <pre className="p-3 pr-10 rounded-md bg-muted/50 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                      {embedCodes.markdown}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(embedCodes.markdown, 'markdown')}
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                    >
                      {copiedTab === 'markdown' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || isLoading || !isSourceValid}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Embed'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
