import React, { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Shield, ShieldOff, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkVerificationStatus, type VerificationStatus } from '@/lib/verification';

interface VerifiedBadgeProps {
  contractId: string;
  network?: 'testnet' | 'mainnet';
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function VerifiedBadge({
  contractId,
  network = 'testnet',
  className,
  showLabel = true,
  size = 'md',
}: VerifiedBadgeProps) {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      if (!contractId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await checkVerificationStatus(contractId, network);
        setStatus(result);
      } catch {
        setStatus({ verified: false });
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [contractId, network]);

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (isLoading) {
    return (
      <Badge variant="secondary" className={cn('gap-1', className)}>
        <Loader2 className={cn(iconSize[size], 'animate-spin')} />
        {showLabel && <span className={textSize[size]}>Checking...</span>}
      </Badge>
    );
  }

  if (!status) {
    return null;
  }

  if (status.verified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={status.verification_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Badge
                variant="default"
                className={cn(
                  'gap-1 bg-green-600 hover:bg-green-700 cursor-pointer',
                  className
                )}
              >
                <CheckCircle2 className={iconSize[size]} />
                {showLabel && <span className={textSize[size]}>Verified</span>}
              </Badge>
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                Source Code Verified
              </p>
              {status.verification_date && (
                <p className="text-xs text-muted-foreground">
                  Verified on {new Date(status.verification_date).toLocaleDateString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Click to view on SourceScan <ExternalLink className="h-3 w-3" />
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('gap-1 text-muted-foreground', className)}
          >
            <ShieldOff className={iconSize[size]} />
            {showLabel && <span className={textSize[size]}>Unverified</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">Source code not verified</p>
          <p className="text-xs text-muted-foreground">
            Verify your contract to show source code on-chain
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Inline badge version for compact display
export function VerifiedIcon({
  contractId,
  network = 'testnet',
  className,
}: {
  contractId: string;
  network?: 'testnet' | 'mainnet';
  className?: string;
}) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!contractId) return;
      try {
        const status = await checkVerificationStatus(contractId, network);
        setVerified(status.verified);
      } catch {
        setVerified(false);
      }
    };
    check();
  }, [contractId, network]);

  if (verified === null) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>
            {verified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {verified ? 'Source code verified' : 'Source code not verified'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
