import { useState, useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Turnstile } from '@marsidev/react-turnstile';
import { getFaucetStatus, requestFaucet } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Droplets,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Clock,
} from 'lucide-react';
import type { FaucetStatusResponse } from '@/lib/types';

const formSchema = z.object({
  recipientAccount: z
    .string()
    .min(1, 'Account is required')
    .regex(/^[a-z0-9_-]+\.testnet$/, 'Must be a valid testnet account (e.g., myaccount.testnet)'),
});

interface FaucetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function FaucetDialog({ open, onOpenChange, userId }: FaucetDialogProps) {
  const [status, setStatus] = useState<FaucetStatusResponse | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    explorerUrl?: string;
  } | null>(null);
  const turnstileRef = useRef<any>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientAccount: '',
    },
  });

  // Fetch status when dialog opens
  useEffect(() => {
    if (open && userId) {
      fetchStatus();
    }
  }, [open, userId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setResult(null);
      form.reset();
    }
  }, [open]);

  const fetchStatus = async () => {
    try {
      const faucetStatus = await getFaucetStatus(userId);
      setStatus(faucetStatus);
    } catch (error) {
      console.error('Failed to fetch faucet status:', error);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!status?.next_available_at || status.can_request) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const nextAvailable = new Date(status.next_available_at!).getTime();
      const now = Date.now();
      const diff = nextAvailable - now;

      if (diff <= 0) {
        setCountdown(null);
        setStatus(prev => prev ? { ...prev, can_request: true } : null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [status?.next_available_at, status?.can_request]);

  const canRequest = status?.can_request ?? true;
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const siteKey = isDev ? '1x00000000000000000000AA' : (import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA');

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!turnstileToken) {
      toast({
        title: 'Verification Required',
        description: 'Please complete the CAPTCHA verification',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const { data: faucetRequest, error: dbError } = await supabase
        .from('faucet_requests')
        .insert({
          user_id: userId,
          recipient_account: data.recipientAccount,
          amount: 1.0,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      const response = await requestFaucet(userId, data.recipientAccount, turnstileToken);

      if (response.success) {
        await supabase
          .from('faucet_requests')
          .update({
            status: 'success',
            transaction_hash: response.transaction_hash,
          })
          .eq('id', faucetRequest.id);

        setResult({
          success: true,
          message: `Sent 1 NEAR to ${data.recipientAccount}`,
          explorerUrl: response.explorer_url,
        });

        toast({
          title: 'Tokens Sent!',
          description: '1 NEAR has been sent to your account',
        });

        form.reset();
        await fetchStatus();
      } else {
        await supabase
          .from('faucet_requests')
          .update({
            status: 'failed',
            error_message: response.error,
          })
          .eq('id', faucetRequest.id);

        setResult({
          success: false,
          message: response.error || 'Request failed',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setIsSubmitting(false);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Testnet Faucet
          </DialogTitle>
          <DialogDescription>
            Get 1 NEAR for testing (once per 24 hours)
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="recipientAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Account</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="myaccount.testnet"
                      {...field}
                      disabled={!canRequest || isSubmitting}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {countdown && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                <Clock className="h-4 w-4" />
                <span>Next request available in <strong>{countdown}</strong></span>
              </div>
            )}

            {canRequest && !result?.success && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={siteKey}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            {result && (
              <Alert variant={result.success ? 'default' : 'destructive'} className={cn(
                result.success && "border-green-500/20 bg-green-500/5"
              )}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription className="flex flex-col gap-2">
                  <span>{result.message}</span>
                  {result.explorerUrl && (
                    <a
                      href={result.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm flex items-center gap-1"
                    >
                      View on Explorer
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!result?.success && (
              <Button
                type="submit"
                disabled={!canRequest || isSubmitting || !turnstileToken}
                className="w-full gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : !turnstileToken && canRequest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Droplets className="h-4 w-4" />
                    Request 1 NEAR
                  </>
                )}
              </Button>
            )}

            {result?.success && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
