import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Copy, 
  CheckCircle2, 
  Globe2,
  Lock,
  Eye,
  Users,
  Link2,
  Loader2,
  QrCode,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getOrCreateShareLink, ShareLink } from '@/lib/shareLinks';

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ShareProjectDialogProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const { toast } = useToast();

  // For now, use direct link until share_links table is created
  const shareUrl = `${window.location.origin}/projects/${projectId}/shared`;

  // Fetch initial sharing status, view count, and share link
  useEffect(() => {
    if (open) {
      const fetchStatus = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('is_public, view_count')
            .eq('id', projectId)
            .single();

          if (error) throw error;
          setIsPublic(data.is_public);
          setViewCount(data.view_count || 0);

          // If project is public, try to get existing share link
          if (data.is_public) {
            const link = await getOrCreateShareLink(projectId);
            setShareLink(link);
          }
        } catch (error) {
          console.error('Error fetching sharing status:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchStatus();
    }
  }, [open, projectId]);

  const handleVisibilityChange = async (newState: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          is_public: newState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;

      setIsPublic(newState);

      // Generate share link if making public
      if (newState && !shareLink) {
        setIsGeneratingLink(true);
        const link = await getOrCreateShareLink(projectId);
        setShareLink(link);
        setIsGeneratingLink(false);
      }

      toast({
        title: "Success",
        description: `Project is now ${newState ? 'public' : 'private'}`,
      });
    } catch (error) {
      console.error('Error updating project visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update project visibility",
        variant: "destructive",
      });
      // Revert the switch state on error
      setIsPublic(!newState);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Project
          </DialogTitle>
          <DialogDescription>
            Share your project with others in read-only mode
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Share2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-medium">{projectName}</div>
                <div className="text-xs text-muted-foreground">Read-only access</div>
              </div>
            </div>
            <Badge variant="outline" className={cn(
              isPublic 
                ? "bg-green-500/10 text-green-500" 
                : "bg-red-500/10 text-red-500"
            )}>
              {isPublic ? 'Public' : 'Private'}
            </Badge>
          </div>

          {/* View Count */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <div className="font-medium">{viewCount}</div>
                <div className="text-xs text-muted-foreground">Total views</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span>Unique viewers</span>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Lock className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium">Project Visibility</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isPublic 
                  ? "Anyone with the link can view this project" 
                  : "Only you can access this project"
                }
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handleVisibilityChange}
              disabled={isSaving || isLoading}
            />
          </div>

          {/* Share Link */}
          {isPublic && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Share Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-xs"
                    disabled={isGeneratingLink}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-none"
                    onClick={copyToClipboard}
                    disabled={isGeneratingLink}
                  >
                    {isGeneratingLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Share link info */}
              {shareLink && (
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <QrCode className="h-4 w-4 text-blue-500 flex-none mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs text-blue-500">
                        Share this link to give read-only access to your project
                      </p>
                      {shareLink.view_count > 0 && (
                        <p className="text-xs text-muted-foreground">
                          This link has been used {shareLink.view_count} time{shareLink.view_count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}