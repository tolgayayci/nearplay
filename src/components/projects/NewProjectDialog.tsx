import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Code2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  FileCode,
  Terminal,
  Braces,
  Plus,
  FileCode2,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PROJECT_TEMPLATES } from '@/lib/templates';
import { getTemplates } from '@/lib/templates-api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import type { Template } from '@/lib/types';

const formSchema = z.object({
  name: z.string()
    .min(1, "Project name is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens are allowed"),
  description: z.string().max(200).optional(),
});

// Combined template type for both local and database templates
export interface CombinedTemplate {
  id?: string;
  name: string;
  description: string;
  icon: any;
  code?: string;  // Only for local templates
  category: string;
  difficulty: string;
  isOfficial?: boolean;
  isOpenZeppelin?: boolean;
  isCommunity?: boolean;
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (data: {
    name: string;
    description: string;
    template?: CombinedTemplate;
    officialTemplateId?: string;
  }) => void;
}

// Icon map for database templates
const iconMap: Record<string, any> = {
  Code2,
  MessageCircle: Code2, // Fallback
  Coins: Code2,
  Image: Code2,
  Link2: Code2,
};

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
}: NewProjectDialogProps) {
  const [activeTab, setActiveTab] = useState<'blank' | 'template'>('blank');
  const [selectedTemplate, setSelectedTemplate] = useState<CombinedTemplate | null>(null);
  const [officialTemplates, setOfficialTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Fetch official templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchOfficialTemplates();
    }
  }, [open]);

  const fetchOfficialTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const templates = await getTemplates({ official: true });
      // Sort by display_order if available, otherwise by name
      templates.sort((a, b) => {
        // Official templates have specific IDs that determine order
        const orderA = getTemplateOrder(a.id);
        const orderB = getTemplateOrder(b.id);
        return orderA - orderB;
      });
      setOfficialTemplates(templates);
    } catch (error) {
      console.error('Error fetching official templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Get order for official templates based on their UUID
  const getTemplateOrder = (id: string) => {
    const orderMap: Record<string, number> = {
      '00000000-0000-0000-0000-000000000001': 1, // Counter
      '00000000-0000-0000-0000-000000000002': 2, // Hello World
      '00000000-0000-0000-0000-000000000003': 3, // Fungible Token
      '00000000-0000-0000-0000-000000000004': 4, // NFT
      '00000000-0000-0000-0000-000000000005': 5, // Cross Contract
    };
    return orderMap[id] || 999;
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedTemplate(null);
      setActiveTab('blank');
    }
  }, [open, form]);

  // Auto-fill form when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      form.setValue('name', selectedTemplate.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      form.setValue('description', selectedTemplate.description);
    }
  }, [selectedTemplate, form]);

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    // Don't allow creating project from OpenZeppelin templates
    if (selectedTemplate?.isOpenZeppelin) {
      toast({
        title: "Coming Soon",
        description: "OpenZeppelin templates will be available soon!",
      });
      return;
    }

    onCreateProject({
      name: data.name.trim(),
      description: data.description?.trim() || '',
      template: selectedTemplate || undefined,
      officialTemplateId: selectedTemplate?.isOfficial ? selectedTemplate.id : undefined,
    });
    onOpenChange(false);
  };

  // Convert official database template to combined template
  const convertOfficialTemplate = (template: Template): CombinedTemplate => ({
    id: template.id,
    name: template.name,
    description: template.description || '',
    icon: iconMap[template.icon] || Code2,
    category: template.category,
    difficulty: template.difficulty,
    isOfficial: true,
  });

  // Convert local template to combined template
  const convertLocalTemplate = (template: typeof PROJECT_TEMPLATES[0]): CombinedTemplate => ({
    name: template.name,
    description: template.description,
    icon: template.icon,
    code: template.code,
    category: template.category,
    difficulty: template.difficulty,
    isOpenZeppelin: (template as any).isOpenZeppelin,
    isCommunity: (template as any).isCommunity,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Create a New Project</DialogTitle>
              <DialogDescription className="mt-1.5">
                Get started by choosing a template or create from scratch
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'blank' | 'template')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="blank" className="gap-2">
              <FileCode className="h-4 w-4" />
              Blank Project
            </TabsTrigger>
            <TabsTrigger value="template" className="gap-2">
              <Braces className="h-4 w-4" />
              Use Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blank">
            <div className="space-y-6">
              {/* Project Info Card */}
              <div className="p-6 border rounded-lg bg-muted/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-md bg-primary/10">
                    <FileCode2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Blank Project</div>
                    <div className="text-sm text-muted-foreground">
                      Create a new NEAR smart contract from scratch
                    </div>
                  </div>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Terminal className="h-4 w-4" />
                              Project Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="my-awesome-project"
                                {...field}
                                className="font-mono"
                              />
                            </FormControl>
                            <FormDescription>
                              Only lowercase letters, numbers, and hyphens are allowed
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Code2 className="h-4 w-4" />
                              Description (Optional)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="A brief description of your project"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Project
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>

              {/* Quick Tips */}
              <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-2 text-sm text-blue-500 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Quick Tips</span>
                </div>
                <ul className="space-y-1 text-sm text-blue-500/80">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Use descriptive names for better organization
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Add a clear description to help others understand your project
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="template">
            <div className="space-y-6">
              {/* Template Selection */}
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="h-[400px]">
                  {isLoadingTemplates ? (
                    <div className="flex items-center justify-center h-full py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="divide-y">
                      {/* Official Templates from Database */}
                      {officialTemplates.map((template) => {
                        const combined = convertOfficialTemplate(template);
                        return (
                          <div
                            key={template.id}
                            onClick={() => setSelectedTemplate(combined)}
                            className={cn(
                              "p-4 flex items-center gap-4 transition-colors cursor-pointer hover:bg-accent",
                              selectedTemplate?.id === template.id && "bg-accent"
                            )}
                          >
                            <div className="flex-none p-3 rounded-lg bg-primary/10">
                              <combined.icon className="h-5 w-5 text-primary" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium">{template.name}</h3>
                                <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800">
                                  NEAR Playground
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                            </div>

                            <ArrowRight className={cn(
                              "flex-none h-4 w-4 text-muted-foreground transition-opacity",
                              selectedTemplate?.id === template.id ? "opacity-100" : "opacity-0"
                            )} />
                          </div>
                        );
                      })}

                      {/* Separator if both official and local templates exist */}
                      {officialTemplates.length > 0 && PROJECT_TEMPLATES.length > 0 && (
                        <div className="py-2 px-4 bg-muted/50 text-xs font-medium text-muted-foreground">
                          Community Templates
                        </div>
                      )}

                      {/* Local/Legacy Templates */}
                      {PROJECT_TEMPLATES.map((template, index) => {
                        const combined = convertLocalTemplate(template);
                        return (
                          <div
                            key={`local-${index}`}
                            onClick={() => !template.isOpenZeppelin && setSelectedTemplate(combined)}
                            className={cn(
                              "p-4 flex items-center gap-4 transition-colors",
                              !template.isOpenZeppelin && "cursor-pointer hover:bg-accent",
                              selectedTemplate?.name === template.name && !selectedTemplate?.isOfficial && "bg-accent",
                              template.isOpenZeppelin && "opacity-75"
                            )}
                          >
                            <div className="flex-none p-3 rounded-lg bg-primary/10">
                              <template.icon className="h-5 w-5 text-primary" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium">{template.name}</h3>
                                {template.isOpenZeppelin && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                                      OpenZeppelin
                                    </Badge>
                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                                      Coming Soon
                                    </Badge>
                                  </div>
                                )}
                                {(template as any).isCommunity && (
                                  <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                                    Community
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                            </div>

                            <ArrowRight className={cn(
                              "flex-none h-4 w-4 text-muted-foreground transition-opacity",
                              selectedTemplate?.name === template.name && !selectedTemplate?.isOfficial ? "opacity-100" : "opacity-0",
                              template.isOpenZeppelin && "opacity-0"
                            )} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Project Details */}
              {selectedTemplate && (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
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
                                className="font-mono"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Code2 className="h-4 w-4" />
                              Description (Optional)
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="gap-2"
                        disabled={selectedTemplate.isOpenZeppelin}
                      >
                        <Sparkles className="h-4 w-4" />
                        Create from Template
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {/* Template Selection Prompt */}
              {!selectedTemplate && (
                <div className="flex items-center gap-2 p-4 text-sm bg-muted/50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Select a template to continue</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
