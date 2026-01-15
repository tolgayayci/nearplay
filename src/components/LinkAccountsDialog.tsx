import { useState, useEffect } from 'react';
import { Github, Loader2, Link2, Unlink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getUserIdentities,
  linkGitHubIdentity,
  linkGoogleIdentity,
  unlinkIdentity,
} from '@/lib/auth';

interface Identity {
  id: string;
  provider: string;
  identity_data?: {
    email?: string;
    full_name?: string;
    name?: string;
  };
}

interface LinkAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkAccountsDialog({ open, onOpenChange }: LinkAccountsDialogProps) {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchIdentities = async () => {
    setIsLoading(true);
    try {
      const data = await getUserIdentities();
      setIdentities(data);
    } catch (error) {
      console.error('Failed to fetch identities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load linked accounts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchIdentities();
    }
  }, [open]);

  const hasProvider = (provider: string) => {
    return identities.some((i) => i.provider === provider);
  };

  const handleLinkGitHub = async () => {
    setLinkingProvider('github');
    try {
      await linkGitHubIdentity();
      // Will redirect to GitHub OAuth
    } catch (error: any) {
      console.error('Failed to link GitHub:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to link GitHub account',
        variant: 'destructive',
      });
      setLinkingProvider(null);
    }
  };

  const handleLinkGoogle = async () => {
    setLinkingProvider('google');
    try {
      await linkGoogleIdentity();
      // Will redirect to Google OAuth
    } catch (error: any) {
      console.error('Failed to link Google:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to link Google account',
        variant: 'destructive',
      });
      setLinkingProvider(null);
    }
  };

  const handleUnlink = async (identity: Identity) => {
    if (identities.length <= 1) {
      toast({
        title: 'Cannot unlink',
        description: 'You must have at least one linked account',
        variant: 'destructive',
      });
      return;
    }

    setUnlinkingId(identity.id);
    try {
      await unlinkIdentity(identity.id);
      toast({
        title: 'Account unlinked',
        description: `${getProviderName(identity.provider)} account has been unlinked`,
      });
      await fetchIdentities();
    } catch (error: any) {
      console.error('Failed to unlink:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to unlink account',
        variant: 'destructive',
      });
    } finally {
      setUnlinkingId(null);
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'github':
        return 'GitHub';
      case 'google':
        return 'Google';
      case 'email':
        return 'Email';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'github':
        return <Github className="h-4 w-4" />;
      case 'google':
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        );
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <Link2 className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Linked Accounts
          </DialogTitle>
          <DialogDescription>
            Link multiple sign-in methods to your account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Linked Accounts */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {identities.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Connected accounts
                  </p>
                  <div className="space-y-2">
                    {identities.map((identity) => (
                      <div
                        key={identity.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          {getProviderIcon(identity.provider)}
                          <div>
                            <p className="text-sm font-medium">
                              {getProviderName(identity.provider)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {identity.identity_data?.email ||
                                identity.identity_data?.full_name ||
                                identity.identity_data?.name ||
                                'Connected'}
                            </p>
                          </div>
                        </div>
                        {identities.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlink(identity)}
                            disabled={unlinkingId === identity.id}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {unlinkingId === identity.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link New Accounts */}
              {(!hasProvider('github') || !hasProvider('google')) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Add another account
                  </p>
                  <div className="space-y-2">
                    {!hasProvider('github') && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleLinkGitHub}
                        disabled={linkingProvider !== null}
                      >
                        {linkingProvider === 'github' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Github className="mr-2 h-4 w-4" />
                        )}
                        Link GitHub Account
                      </Button>
                    )}
                    {!hasProvider('google') && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleLinkGoogle}
                        disabled={linkingProvider !== null}
                      >
                        {linkingProvider === 'google' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="currentColor"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="currentColor"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="currentColor"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                        )}
                        Link Google Account
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {hasProvider('github') && hasProvider('google') && (
                <p className="text-sm text-center text-muted-foreground py-2">
                  All available accounts are linked
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
