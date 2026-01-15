import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Github,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { signInWithMagicLink, signInWithGitHub, signInWithGoogle } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { WelcomeDialog } from './WelcomeDialog';

export function SignInDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { data, error, status } = await signInWithMagicLink(email);
      
      if (error) {
        throw error;
      }

      setMagicLinkSent(true);
      toast({
        title: "Magic link sent!",
        description: "Check your email for the login link",
      });
    } catch (error) {
      console.error('Magic link error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to send magic link. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setIsGitHubLoading(true);
    try {
      const { error } = await signInWithGitHub();
      if (error) {
        throw error;
      }
      // OAuth will redirect, so we don't need to handle success here
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      toast({
        title: "Error",
        description: "Failed to sign in with GitHub. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGitHubLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        throw error;
      }
      // OAuth will redirect, so we don't need to handle success here
    } catch (error) {
      console.error('Google OAuth error:', error);
      toast({
        title: "Error",
        description: "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button data-signin-trigger size="lg" className="hidden" onClick={() => setIsOpen(true)}>
            Get Started
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[420px] p-0 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Sign in to NEAR Playground</DialogTitle>
          </DialogHeader>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                NEAR Playground
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sign in to start building on NEAR
            </p>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {magicLinkSent ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Check your email
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We sent a magic link to <span className="font-medium text-gray-900 dark:text-white">{email}</span>
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMagicLinkSent(false);
                    setEmail('');
                  }}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Try a different email
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email address
                    </label>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      className="h-10 border-gray-300 dark:border-gray-700 focus:border-emerald-500 focus:ring-emerald-500"
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button 
                    type="submit"
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Continue with Email'
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-gray-950 px-2 text-gray-500">
                      OR
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGitHubSignIn}
                  disabled={isGitHubLoading}
                  className="w-full h-10 border-gray-300 dark:border-gray-700"
                >
                  {isGitHubLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Github className="mr-2 h-4 w-4" />
                      Continue with GitHub
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  className="w-full h-10 border-gray-300 dark:border-gray-700"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
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
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By continuing, you agree to our{' '}
              <a href="#" className="text-emerald-600 hover:text-emerald-700 underline underline-offset-4">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="text-emerald-600 hover:text-emerald-700 underline underline-offset-4">
                Privacy Policy
              </a>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <WelcomeDialog 
        open={showWelcome} 
        onOpenChange={setShowWelcome}
      />
    </>
  );
}