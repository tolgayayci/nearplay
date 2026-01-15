import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Github,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import {
  checkVerificationStatus,
  publishSource,
  PublishResult,
} from '@/lib/verification';

interface VerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  projectId: string;
  contractId?: string;
  network?: 'testnet' | 'mainnet';
  onVerificationComplete?: () => void;
}

type VerificationStep = 'idle' | 'publishing' | 'published' | 'checking' | 'verified' | 'error';

export function VerificationModal({
  open,
  onOpenChange,
  userId,
  projectId,
  contractId: initialContractId,
  network = 'testnet',
  onVerificationComplete,
}: VerificationModalProps) {
  const [contractId] = useState(initialContractId || '');
  const [step, setStep] = useState<VerificationStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'unknown' | 'verified' | 'pending'>('unknown');
  const [pollCount, setPollCount] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('idle');
      setError(null);
      setPublishResult(null);
      setVerificationStatus('unknown');
      setPollCount(0);
    }
  }, [open]);

  // Poll for verification status
  const checkStatus = useCallback(async () => {
    if (!contractId) return;

    try {
      const status = await checkVerificationStatus(contractId, network);
      if (status.verified) {
        setVerificationStatus('verified');
        setStep('verified');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [contractId, network]);

  // Poll verification status after publishing
  useEffect(() => {
    if (step !== 'checking') return;
    if (pollCount >= 30) {
      // After 30 attempts (about 1 minute), stop polling
      setVerificationStatus('pending');
      return;
    }

    const timer = setTimeout(async () => {
      const verified = await checkStatus();
      if (!verified) {
        setPollCount(prev => prev + 1);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [step, pollCount, checkStatus]);

  const handleVerify = async () => {
    if (!contractId) return;

    setError(null);
    setStep('publishing');

    try {
      // Step 1: Publish source to GitHub
      const result = await publishSource(userId, projectId, contractId);
      setPublishResult(result);

      // Step 2: Show published state - user needs to complete on Nearblocks
      setStep('published');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish source');
      setStep('error');
    }
  };

  const handleCheckStatus = async () => {
    setStep('checking');
    setPollCount(0);

    // Check immediately once
    const verified = await checkStatus();
    if (verified) {
      setStep('verified');
    }
  };

  const handleOpenNearblocks = () => {
    const verifier = network === 'mainnet'
      ? 'v2-verifier.sourcescan.near'
      : 'v2-verifier.sourcescan.testnet';
    const base = network === 'mainnet'
      ? 'https://nearblocks.io'
      : 'https://testnet.nearblocks.io';
    const url = `${base}/verify-contract?accountId=${contractId}&selectedVerifier=${verifier}`;
    window.open(url, '_blank');
  };

  const handleClose = () => {
    onOpenChange(false);
    if (step === 'verified' && onVerificationComplete) {
      onVerificationComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Verify Contract Source
          </DialogTitle>
          <DialogDescription>
            Verify your contract for NEP-330 compliance
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Contract Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Contract</div>
            <div className="font-mono text-sm break-all">{contractId}</div>
          </div>

          {/* Idle State - Explain what will happen */}
          {step === 'idle' && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium text-sm">What happens when you verify:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-4">
                  <li>Your source code will be published to a public GitHub repository</li>
                  <li>SourceScan will verify your contract matches the deployed bytecode</li>
                  <li>Your contract will receive a verified badge on block explorers</li>
                </ol>
              </div>

              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    Your source code will become publicly visible. Do not verify if your code contains sensitive information.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Publishing State */}
          {step === 'publishing' && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Publishing source code...</p>
                <p className="text-sm text-muted-foreground">Creating GitHub repository</p>
              </div>
            </div>
          )}

          {/* Published State - Source published, needs manual verification */}
          {step === 'published' && publishResult && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Source Code Published
                    </p>
                    <a
                      href={publishResult.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-600/80 dark:text-green-400/80 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Github className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{publishResult.repo_url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium text-sm">Next Step: Complete Verification</h4>
                <p className="text-sm text-muted-foreground">
                  Your source code is now publicly available. To complete verification, you need to verify on Nearblocks.
                  This confirms your deployed bytecode matches your source code.
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleOpenNearblocks} className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Nearblocks
                  </Button>
                  <Button variant="outline" onClick={handleCheckStatus}>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Check Status
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Checking State */}
          {step === 'checking' && (
            <div className="space-y-4">
              {publishResult && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Source code published
                      </p>
                      <a
                        href={publishResult.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600/80 dark:text-green-400/80 hover:underline flex items-center gap-1 truncate"
                      >
                        <Github className="h-3 w-3 shrink-0" />
                        <span className="truncate">{publishResult.repo_url}</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center py-6 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Verifying contract...</p>
                  <p className="text-sm text-muted-foreground">
                    Waiting for SourceScan verification ({pollCount}/30)
                  </p>
                </div>
              </div>

              {verificationStatus === 'pending' && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex gap-2">
                    <ShieldAlert className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        Verification in progress
                      </p>
                      <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                        SourceScan is processing your contract. This may take a few minutes.
                        You can close this dialog and check back later.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verified State */}
          {step === 'verified' && (
            <div className="space-y-4">
              {publishResult && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <Github className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Source Repository</p>
                      <a
                        href={publishResult.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{publishResult.repo_url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex gap-3">
                  <ShieldCheck className="h-6 w-6 text-green-500 shrink-0" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Contract Verified!
                    </p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      Your contract source code has been verified and matches the deployed bytecode.
                      It will now show as verified on block explorers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex gap-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      Verification Failed
                    </p>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleVerify} disabled={!contractId}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify Contract
              </Button>
            </>
          )}

          {step === 'publishing' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}

          {step === 'published' && (
            <Button variant="outline" onClick={handleClose}>
              Done
            </Button>
          )}

          {step === 'checking' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}

          {step === 'verified' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}

          {step === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleVerify}>
                Try Again
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
