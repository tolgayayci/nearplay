import { useState, useEffect } from 'react';
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
import { requestFaucet } from '@/lib/api';
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
import type { FaucetStatusResponse, FaucetHistoryItem } from '@/lib/types';

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
  const [history, setHistory] = useState<FaucetHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    explorerUrl?: string;
  } | null>(null);
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
      setIsLoading(true);
      fetchStatus();
    }
  }, [open, userId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setResult(null);
      setStatus(null);
      setIsLoading(true);
      form.reset();
    }
  }, [open]);

  const fetchStatus = async () => {
    try {
      // Query Supabase directly for faucet history (bypass backend)
      const { data: faucetHistory, error } = await supabase
        .from('faucet_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setHistory(faucetHistory || []);

      // Compute rate limit from history - check both success AND pending requests
      // to prevent bypass by spamming while previous request is pending
      const lastRequest = faucetHistory?.find((r: any) =>
        r.status === 'success' || r.status === 'pending'
      );
      if (lastRequest) {
        const lastRequestTime = new Date(lastRequest.created_at).getTime();
        const nextAvailable = lastRequestTime + 24 * 60 * 60 * 1000;
        const canRequestNow = Date.now() >= nextAvailable;

        setStatus({
          can_request: canRequestNow,
          last_request_at: lastRequest.created_at,
          next_available_at: canRequestNow ? undefined : new Date(nextAvailable).toISOString()
        });
      } else {
        // No previous requests, allow
        setStatus({ can_request: true });
      }
    } catch (error) {
      console.error('Failed to fetch faucet data:', error);
      // On error, allow request (backend will validate)
      setStatus({ can_request: true });
    } finally {
      setIsLoading(false);
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

  // Compute next available time from history if not in status
  const lastSuccessfulRequest = history.find(h => h.status === 'success');
  const lastActiveRequest = history.find(h => h.status === 'success' || h.status === 'pending');
  const nextAvailableTime = status?.next_available_at
    ? new Date(status.next_available_at)
    : lastActiveRequest
      ? new Date(new Date(lastActiveRequest.created_at).getTime() + 24 * 60 * 60 * 1000)
      : null;

  const isRateLimited = nextAvailableTime && nextAvailableTime.getTime() > Date.now();
  const canRequest = !isLoading && !isRateLimited;

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    setResult(null);

    try {
      // Frontend rate limit check - verify 24 hours have passed since last request (success or pending)
      const { data: lastRequest } = await supabase
        .from('faucet_requests')
        .select('created_at, status')
        .eq('user_id', userId)
        .in('status', ['success', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastRequest) {
        const lastRequestTime = new Date(lastRequest.created_at).getTime();
        const nextAvailable = lastRequestTime + 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now < nextAvailable) {
          const nextAvailableDate = new Date(nextAvailable);
          setStatus(prev => prev ? {
            ...prev,
            can_request: false,
            next_available_at: nextAvailableDate.toISOString(),
          } : {
            can_request: false,
            last_request_at: lastRequest.created_at,
            next_available_at: nextAvailableDate.toISOString(),
          });
          setResult({
            success: false,
            message: `You can request again at ${nextAvailableDate.toLocaleTimeString()}`,
          });
          setIsSubmitting(false);
          return;
        }
      }

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

      const response = await requestFaucet(userId, data.recipientAccount);

      if (response.success) {
        const { error: updateError } = await supabase
          .from('faucet_requests')
          .update({
            status: 'success',
            transaction_hash: response.transaction_hash,
            explorer_url: response.explorer_url,
          })
          .eq('id', faucetRequest.id);

        if (updateError) {
          console.error('Failed to update faucet request status:', updateError);
        }

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
        const { error: updateError } = await supabase
          .from('faucet_requests')
          .update({
            status: 'failed',
            error_message: response.error,
          })
          .eq('id', faucetRequest.id);

        if (updateError) {
          console.error('Failed to update faucet request status:', updateError);
        }

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

            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking availability...</span>
              </div>
            )}

            {!isLoading && isRateLimited && nextAvailableTime && (
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>You have already requested tokens</span>
                </div>
                <p className="ml-6">
                  You can request again at{' '}
                  <strong>
                    {nextAvailableTime.toLocaleDateString()}{' '}
                    {nextAvailableTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                  {countdown && <span className="text-amber-500"> ({countdown})</span>}
                </p>
              </div>
            )}

            {!isLoading && lastSuccessfulRequest?.transaction_hash && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                <span className="text-muted-foreground">Latest transaction:</span>
                <a
                  href={lastSuccessfulRequest.explorer_url || `https://testnet.nearblocks.io/txns/${lastSuccessfulRequest.transaction_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 font-mono text-xs"
                >
                  {lastSuccessfulRequest.transaction_hash.slice(0, 8)}...{lastSuccessfulRequest.transaction_hash.slice(-6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
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
                disabled={!canRequest || isSubmitting}
                className="w-full gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
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
