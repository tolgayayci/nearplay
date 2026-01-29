import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Github,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Terminal,
  Code2,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  validateGitHubUrl,
  parseGitHubUrl,
  checkGitHubRepository,
  validateNearProject,
  suggestProjectName,
  importGitHubRepository,
  type RepoInfo,
} from '@/lib/github';

type ImportState = 'initial' | 'validating' | 'validated' | 'importing' | 'success' | 'error';

const urlFormSchema = z.object({
  url: z.string().min(1, 'GitHub URL is required').refine(validateGitHubUrl, {
    message: 'Please enter a valid GitHub repository URL',
  }),
});

const projectFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens are allowed'),
  description: z.string().max(200).optional(),
});

interface GitHubImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
  userId: string;
  initialUrl?: string;
}

export function GitHubImportDialog({ open, onClose, onSuccess, userId, initialUrl }: GitHubImportDialogProps) {
  const [importState, setImportState] = useState<ImportState>('initial');
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [parsedUrl, setParsedUrl] = useState<{ owner: string; repo: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filesCount, setFilesCount] = useState<number>(0);
  const { toast } = useToast();

  const urlForm = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: { url: '' },
  });

  const projectForm = useForm<z.infer<typeof projectFormSchema>>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: '', description: '' },
  });

  // Reset state when dialog closes, or set initial URL when opening
  useEffect(() => {
    if (!open) {
      setImportState('initial');
      setRepoInfo(null);
      setParsedUrl(null);
      setError(null);
      setFilesCount(0);
      urlForm.reset();
      projectForm.reset();
    } else if (initialUrl) {
      // Pre-fill URL and auto-validate when opening with initialUrl
      urlForm.setValue('url', initialUrl);
      // Trigger validation after a brief delay to ensure form is ready
      setTimeout(() => {
        urlForm.handleSubmit(handleValidateUrl)();
      }, 100);
    }
  }, [open, urlForm, projectForm, initialUrl]);

  // Auto-fill project form when repo is validated
  useEffect(() => {
    if (repoInfo && parsedUrl) {
      projectForm.setValue('name', suggestProjectName(parsedUrl.repo, parsedUrl.path));
      projectForm.setValue('description', repoInfo.description || '');
    }
  }, [repoInfo, parsedUrl, projectForm]);

  const handleValidateUrl = async (data: z.infer<typeof urlFormSchema>) => {
    setError(null);
    setImportState('validating');

    try {
      const parsed = parseGitHubUrl(data.url);
      if (!parsed) {
        throw new Error('Invalid GitHub URL format');
      }
      setParsedUrl(parsed);

      // Check if repo exists
      const info = await checkGitHubRepository(parsed.owner, parsed.repo);
      if (!info.exists) {
        throw new Error('Repository not found. Make sure the URL is correct and the repository is public.');
      }
      if (!info.isPublic) {
        throw new Error('Repository is private. Only public repositories can be imported.');
      }

      // Validate it's a NEAR project (check subdirectory if path is specified)
      const validation = await validateNearProject(parsed.owner, parsed.repo, parsed.branch, parsed.path);
      if (!validation.isValid) {
        throw new Error(validation.reason || 'Not a valid NEAR project');
      }

      setRepoInfo(info);
      setImportState('validated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate repository');
      setImportState('error');
    }
  };

  const handleImport = async (data: z.infer<typeof projectFormSchema>) => {
    if (!parsedUrl) return;

    setError(null);
    setImportState('importing');

    try {
      const result = await importGitHubRepository(
        parsedUrl.url,
        data.name,
        data.description || '',
        userId,
        parsedUrl.branch,
        parsedUrl.path
      );

      if (!result.success || !result.projectId) {
        throw new Error(result.error || 'Failed to import repository');
      }

      setFilesCount(result.filesCount || 0);
      setImportState('success');

      toast({
        title: 'Import Successful',
        description: `Imported ${result.filesCount || 0} files from GitHub`,
      });

      // Navigate to the new project after a short delay
      setTimeout(() => {
        onSuccess(result.projectId!);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import repository');
      setImportState('error');
    }
  };

  const handleBack = () => {
    setImportState('initial');
    setRepoInfo(null);
    setParsedUrl(null);
    setError(null);
    projectForm.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Github className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Import from GitHub</DialogTitle>
              <DialogDescription className="mt-1.5">
                Clone a NEAR smart contract repository
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Initial State - URL Input */}
        {(importState === 'initial' || importState === 'validating' || importState === 'error') && !repoInfo && (
          <Form {...urlForm}>
            <form onSubmit={urlForm.handleSubmit(handleValidateUrl)} className="space-y-6">
              <div className="p-6 border rounded-lg bg-muted/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Github className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">GitHub Repository</div>
                    <div className="text-sm text-muted-foreground">
                      Enter the URL of a public NEAR smart contract repository
                    </div>
                  </div>
                </div>

                <FormField
                  control={urlForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Repository URL
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://github.com/owner/repository"
                          {...field}
                          disabled={importState === 'validating'}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        Supports HTTPS and SSH URL formats
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-2 text-sm text-blue-500 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Requirements</span>
                </div>
                <ul className="space-y-1 text-sm text-blue-500/80">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Repository must be public
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Must contain Cargo.toml with NEAR SDK dependency
                  </li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={importState === 'validating'} className="gap-2">
                  {importState === 'validating' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Continue
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Validated State - Project Details */}
        {(importState === 'validated' || importState === 'importing' || importState === 'error') && repoInfo && (
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(handleImport)} className="space-y-6">
              {/* Repository Info */}
              <div className="p-4 border rounded-lg bg-green-500/5 border-green-500/20">
                <div className="flex items-center gap-2 text-sm text-green-600 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Valid NEAR Project</span>
                </div>
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={parsedUrl?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline font-mono"
                  >
                    {parsedUrl?.owner}/{parsedUrl?.repo}
                  </a>
                </div>
                {parsedUrl?.path && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <FileCode className="h-4 w-4" />
                    <span className="font-mono">/{parsedUrl.path}</span>
                    {parsedUrl.branch && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {parsedUrl.branch}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Project Details Form */}
              <div className="p-6 border rounded-lg bg-muted/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-md bg-primary/10">
                    <FileCode className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Project Details</div>
                    <div className="text-sm text-muted-foreground">
                      Customize your imported project
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={projectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          Project Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={importState === 'importing'}
                            className="font-mono"
                          />
                        </FormControl>
                        <FormDescription>
                          Only lowercase letters, numbers, and hyphens
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={projectForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Code2 className="h-4 w-4" />
                          Description (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input {...field} disabled={importState === 'importing'} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={importState === 'importing'}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={importState === 'importing'}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={importState === 'importing'} className="gap-2">
                    {importState === 'importing' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Github className="h-4 w-4" />
                        Import Repository
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}

        {/* Success State */}
        {importState === 'success' && (
          <div className="py-8 text-center">
            <div className="relative mx-auto w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse" />
              <div className="relative bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Import Successful!</h3>
            <p className="text-muted-foreground mb-4">
              Imported {filesCount} files from GitHub
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to your project...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
