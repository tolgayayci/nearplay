import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  EmbedButtonSize,
  EmbedTheme,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Github,
  FolderOpen,
  Layout,
  Copy,
  Check,
  ExternalLink,
  Code2,
} from 'lucide-react';

interface EmbedGeneratorProps {
  preSelectedTemplateId?: string;
  preSelectedProjectId?: string;
  onEmbedCreated?: (embedId: string) => void;
}

const BUTTON_STYLES: { value: EmbedButtonStyle; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
];

const BUTTON_SIZES: { value: EmbedButtonSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'lg', label: 'Large' },
];

const THEMES: { value: EmbedTheme; label: string }[] = [
  { value: 'auto', label: 'Auto (System)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function EmbedGenerator({
  preSelectedTemplateId,
  preSelectedProjectId,
  onEmbedCreated,
}: EmbedGeneratorProps) {
  const [sourceType, setSourceType] = useState<EmbedSourceType>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    preSelectedTemplateId || ''
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    preSelectedProjectId || ''
  );
  const [githubUrl, setGithubUrl] = useState('');
  const [embedName, setEmbedName] = useState('');

  const [buttonText, setButtonText] = useState('Open in NearPlay');
  const [buttonStyle, setButtonStyle] = useState<EmbedButtonStyle>('primary');
  const [buttonSize, setButtonSize] = useState<EmbedButtonSize>('default');
  const [theme, setTheme] = useState<EmbedTheme>('auto');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch templates and projects
  useEffect(() => {
    fetchData();
  }, [user]);

  // Set pre-selected values
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

  // Generate preview embed code
  const previewEmbed = useMemo(() => {
    return {
      id: 'preview',
      user_id: user?.id || '',
      source_type: sourceType,
      button_text: buttonText,
      button_style: buttonStyle,
      button_size: buttonSize,
      theme: theme,
      click_count: 0,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [sourceType, buttonText, buttonStyle, buttonSize, theme, user]);

  const embedCodes = useMemo(() => {
    return {
      ...generateEmbedCode(previewEmbed as any),
      inline: generateInlineButtonCode(previewEmbed as any),
    };
  }, [previewEmbed]);

  const handleCreate = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create an embed',
      });
      return;
    }

    // Validation
    if (sourceType === 'template' && !selectedTemplateId) {
      toast({
        title: 'Template required',
        description: 'Please select a template',
        variant: 'destructive',
      });
      return;
    }
    if (sourceType === 'project' && !selectedProjectId) {
      toast({
        title: 'Project required',
        description: 'Please select a project',
        variant: 'destructive',
      });
      return;
    }
    if (sourceType === 'github' && !githubUrl) {
      toast({
        title: 'GitHub URL required',
        description: 'Please enter a GitHub repository URL',
        variant: 'destructive',
      });
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
        button_size: buttonSize,
        theme: theme,
        name: embedName || undefined,
      });

      toast({
        title: 'Embed created',
        description: 'Your embed has been created successfully',
      });

      if (onEmbedCreated) {
        onEmbedCreated(embed.id);
      } else {
        navigate(`/embeds`);
      }
    } catch (error) {
      console.error('Error creating embed:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create embed',
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
      toast({
        title: 'Copied',
        description: 'Code copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Source Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Source</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setSourceType('template')}
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              sourceType === 'template'
                ? 'border-primary bg-primary/5'
                : 'hover:border-muted-foreground/50'
            )}
          >
            <Layout className="h-5 w-5 mb-2" />
            <div className="font-medium">From Template</div>
            <div className="text-sm text-muted-foreground">
              Use a marketplace template
            </div>
          </button>
          <button
            onClick={() => setSourceType('project')}
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              sourceType === 'project'
                ? 'border-primary bg-primary/5'
                : 'hover:border-muted-foreground/50'
            )}
          >
            <FolderOpen className="h-5 w-5 mb-2" />
            <div className="font-medium">From Project</div>
            <div className="text-sm text-muted-foreground">
              Use one of your projects
            </div>
          </button>
          <button
            onClick={() => setSourceType('github')}
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              sourceType === 'github'
                ? 'border-primary bg-primary/5'
                : 'hover:border-muted-foreground/50'
            )}
          >
            <Github className="h-5 w-5 mb-2" />
            <div className="font-medium">From GitHub</div>
            <div className="text-sm text-muted-foreground">
              Link to a GitHub repository
            </div>
          </button>
        </div>

        {/* Source Selector */}
        <div className="mt-4">
          {sourceType === 'template' && (
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
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
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
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

      {/* Button Customization */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Button Customization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Open in NearPlay"
            />
          </div>
          <div className="space-y-2">
            <Label>Embed Name (optional)</Label>
            <Input
              value={embedName}
              onChange={(e) => setEmbedName(e.target.value)}
              placeholder="My Embed"
            />
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              value={buttonStyle}
              onValueChange={(v) => setButtonStyle(v as EmbedButtonStyle)}
            >
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label>Size</Label>
            <Select
              value={buttonSize}
              onValueChange={(v) => setButtonSize(v as EmbedButtonSize)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUTTON_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={theme}
              onValueChange={(v) => setTheme(v as EmbedTheme)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Preview</h3>
        <div className="p-8 rounded-lg border bg-muted/20 flex items-center justify-center">
          <div
            dangerouslySetInnerHTML={{ __html: embedCodes.inline }}
            className="[&_a]:cursor-default"
          />
        </div>
      </div>

      {/* Embed Code */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Embed Code</h3>
        <Tabs defaultValue="html" className="w-full">
          <TabsList>
            <TabsTrigger value="html">HTML (Image)</TabsTrigger>
            <TabsTrigger value="inline">HTML (Button)</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>
          <TabsContent value="html" className="mt-4">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm">
                {embedCodes.html}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(embedCodes.html, 'html')}
                className="absolute top-2 right-2"
              >
                {copiedTab === 'html' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="inline" className="mt-4">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm">
                {embedCodes.inline}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(embedCodes.inline, 'inline')}
                className="absolute top-2 right-2"
              >
                {copiedTab === 'inline' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="markdown" className="mt-4">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm">
                {embedCodes.markdown}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(embedCodes.markdown, 'markdown')}
                className="absolute top-2 right-2"
              >
                {copiedTab === 'markdown' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Embed'
          )}
        </Button>
      </div>
    </div>
  );
}
