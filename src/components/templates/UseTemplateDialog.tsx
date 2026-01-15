import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/App';
import { useTemplate, incrementTemplateUses } from '@/lib/templates-api';
import { supabase } from '@/lib/supabase';
import type { Template } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Loader2,
  FolderOpen,
  FileCode,
  Settings,
  FileText,
  File,
} from 'lucide-react';

interface UseTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
  onSuccess?: () => void;
}

export function UseTemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: UseTemplateDialogProps) {
  const [projectName, setProjectName] = useState(
    template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  );
  const [projectDescription, setProjectDescription] = useState(
    template.description || ''
  );
  const [isCreating, setIsCreating] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleCreate = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create a project',
      });
      return;
    }

    if (!projectName.trim()) {
      toast({
        title: 'Project name required',
        description: 'Please enter a name for your project',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Generate a new project ID
      const newProjectId = crypto.randomUUID();

      // Create project record in Supabase first
      const { error: dbError } = await supabase.from('projects').insert({
        id: newProjectId,
        user_id: user.id,
        name: projectName.trim(),
        description: projectDescription.trim() || null,
        code: '', // Will be populated by backend
      });

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Use the template (copies files to project directory)
      await useTemplate(template.id, user.id, newProjectId);

      // Increment uses count
      await incrementTemplateUses(template.id);

      toast({
        title: 'Project created',
        description: `"${projectName}" has been created from the template`,
      });

      // Close dialog and call success callback
      onOpenChange(false);
      onSuccess?.();

      // Navigate to the new project
      navigate(`/projects/${newProjectId}`);
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

  // Format project name on change
  const handleNameChange = (value: string) => {
    // Convert to lowercase and replace invalid characters
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setProjectName(formatted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Use "{template.name}" Template</DialogTitle>
          <DialogDescription>
            Create a new project from this template. All files will be copied to
            your new project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Info */}
          <div className="p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="outline"
                className={cn(
                  template.difficulty === 'Beginner' &&
                    'bg-green-500/10 text-green-600 border-green-500/20',
                  template.difficulty === 'Intermediate' &&
                    'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
                  template.difficulty === 'Advanced' &&
                    'bg-red-500/10 text-red-600 border-red-500/20'
                )}
              >
                {template.difficulty}
              </Badge>
              <Badge variant="outline" className="bg-muted/50">
                {template.category}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="flex items-center gap-2 mb-1">
                <FolderOpen className="h-4 w-4" />
                Project Structure:
              </p>
              <ul className="ml-6 space-y-1 text-xs">
                <li className="flex items-center gap-2">
                  <Settings className="h-3 w-3 text-purple-500" />
                  Cargo.toml (dependencies configured)
                </li>
                <li className="flex items-center gap-2">
                  <FileCode className="h-3 w-3 text-orange-500" />
                  src/lib.rs (main contract code)
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-blue-500" />
                  rust-toolchain.toml (toolchain config)
                </li>
                <li className="flex items-center gap-2">
                  <File className="h-3 w-3 text-gray-400" />
                  tests/ (test files)
                </li>
              </ul>
            </div>
          </div>

          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my-project"
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="projectDescription">Description (optional)</Label>
            <Textarea
              id="projectDescription"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="A brief description of your project..."
              disabled={isCreating}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
