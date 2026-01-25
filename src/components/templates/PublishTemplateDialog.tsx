import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/App';
import { supabase } from '@/lib/supabase';
import {
  createTemplateFromGitHub,
  createTemplateFromProject,
} from '@/lib/templates-api';
import { parseGitHubUrl } from '@/lib/github';
import type { Project, Template, TemplateDifficulty, TemplateSourceType } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Github,
  FolderOpen,
  X,
  Plus,
  Code2,
  Coins,
  Image,
  Dices,
  Target,
  MessageCircle,
  FileCode,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PublishTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedProjectId?: string;
  onSuccess?: (template: Template) => void;
}

const CATEGORIES = [
  'Basic',
  'Token',
  'NFT',
  'DeFi',
  'Game',
  'Utility',
  'Challenge',
  'Other',
];

const DIFFICULTIES: TemplateDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

const ICONS = [
  { value: 'Code2', icon: Code2, label: 'Code' },
  { value: 'Coins', icon: Coins, label: 'Coins' },
  { value: 'Image', icon: Image, label: 'Image' },
  { value: 'Dices', icon: Dices, label: 'Dice' },
  { value: 'Target', icon: Target, label: 'Target' },
  { value: 'MessageCircle', icon: MessageCircle, label: 'Message' },
  { value: 'FileCode', icon: FileCode, label: 'File' },
];

export function PublishTemplateDialog({
  open,
  onOpenChange,
  preSelectedProjectId,
  onSuccess,
}: PublishTemplateDialogProps) {
  const [sourceType, setSourceType] = useState<TemplateSourceType>('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    preSelectedProjectId || ''
  );
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubPath, setGithubPath] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Basic');
  const [difficulty, setDifficulty] = useState<TemplateDifficulty>('Beginner');
  const [selectedIcon, setSelectedIcon] = useState('Code2');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user's projects on mount
  useEffect(() => {
    if (open && user) {
      fetchUserProjects();
    }
  }, [open, user]);

  // Set pre-selected project
  useEffect(() => {
    if (preSelectedProjectId) {
      setSelectedProjectId(preSelectedProjectId);
      setSourceType('project');
    }
  }, [preSelectedProjectId]);

  // Auto-parse GitHub URL to extract branch and path
  useEffect(() => {
    if (sourceType === 'github' && githubUrl) {
      const parsed = parseGitHubUrl(githubUrl);
      if (parsed) {
        if (parsed.branch) {
          setGithubBranch(parsed.branch);
        }
        if (parsed.path) {
          setGithubPath(parsed.path);
        }
      }
    }
  }, [githubUrl, sourceType]);

  const fetchUserProjects = async () => {
    if (!user) return;

    try {
      setIsLoadingProjects(true);
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUserProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your projects',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your template',
        variant: 'destructive',
      });
      return false;
    }

    if (sourceType === 'project' && !selectedProjectId) {
      toast({
        title: 'Project required',
        description: 'Please select a project to publish as a template',
        variant: 'destructive',
      });
      return false;
    }

    if (sourceType === 'github' && !githubUrl) {
      toast({
        title: 'GitHub URL required',
        description: 'Please enter a GitHub repository URL',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handlePublish = async () => {
    if (!user || !validateForm()) return;

    try {
      setIsPublishing(true);

      const templateData = {
        name: name.trim(),
        description: description.trim() || undefined,
        source_type: sourceType,
        category,
        difficulty,
        tags,
        icon: selectedIcon,
        is_published: true,
      };

      let template;

      if (sourceType === 'github') {
        template = await createTemplateFromGitHub({
          ...templateData,
          github_url: githubUrl,
          github_branch: githubBranch || 'main',
          github_path: githubPath || undefined,
        });
      } else {
        // Find the project to get its user_id
        const selectedProject = userProjects.find(
          (p) => p.id === selectedProjectId
        );
        if (!selectedProject) {
          throw new Error('Selected project not found');
        }

        template = await createTemplateFromProject(
          {
            ...templateData,
            source_project_id: selectedProjectId,
          },
          user.id
        );
      }

      toast({
        title: 'Template published',
        description: `"${name}" is now available in the marketplace`,
      });

      onOpenChange(false);
      if (onSuccess) {
        onSuccess(template);
      }
    } catch (error) {
      console.error('Error publishing template:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to publish template',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">Publish Template</DialogTitle>
          <DialogDescription className="text-sm">
            Share your project as a template for the community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source Selection */}
          <div className="space-y-2">
            <Tabs
              value={sourceType}
              onValueChange={(value) => setSourceType(value as TemplateSourceType)}
              className="w-full"
            >
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="project" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  My Project
                </TabsTrigger>
                <TabsTrigger value="github" className="gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Project Selector */}
            {sourceType === 'project' && (
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={isLoadingProjects}
              >
                <SelectTrigger className="h-9 mt-2">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {userProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* GitHub URL Input */}
            {sourceType === 'github' && (
              <div className="space-y-2 mt-2">
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="h-9"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Branch</Label>
                    <Input
                      value={githubBranch}
                      onChange={(e) => setGithubBranch(e.target.value)}
                      placeholder="main"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Path (optional)
                    </Label>
                    <Input
                      value={githubPath}
                      onChange={(e) => setGithubPath(e.target.value)}
                      placeholder="contracts/token"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Template Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Template"
              disabled={isPublishing}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template does and when to use it..."
              disabled={isPublishing}
              rows={2}
            />
          </div>

          {/* Category and Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as TemplateDifficulty)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((diff) => (
                    <SelectItem key={diff} value={diff}>
                      {diff}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label className="text-sm">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedIcon(value)}
                  className={cn(
                    'p-2 rounded-md border transition-colors',
                    selectedIcon === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50 hover:bg-muted'
                  )}
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-sm">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag..."
                disabled={isPublishing || tags.length >= 10}
                className="h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 10}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer text-xs hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              'Publish'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
