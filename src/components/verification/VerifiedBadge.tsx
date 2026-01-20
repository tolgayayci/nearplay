import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Shield, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  verified?: boolean;
  verifiedAt?: string;
  wasmHash?: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function VerifiedBadge({
  verified = false,
  verifiedAt,
  wasmHash,
  className,
  showLabel = true,
  size = 'md',
}: VerifiedBadgeProps) {
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

  if (verified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="default"
              className={cn(
                'gap-1 bg-green-600',
                className
              )}
            >
              <CheckCircle2 className={iconSize[size]} />
              {showLabel && <span className={textSize[size]}>Verified</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                Verified by NEAR Playground
              </p>
              {verifiedAt && (
                <p className="text-xs text-muted-foreground">
                  Verified on {new Date(verifiedAt).toLocaleDateString()}
                </p>
              )}
              {wasmHash && (
                <p className="text-xs text-muted-foreground font-mono truncate max-w-[250px]">
                  {wasmHash}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Bytecode matches the deployed contract
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
            Click "Verify Source" to verify your contract
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Inline icon version for compact display
export function VerifiedIcon({
  verified = false,
  className,
}: {
  verified?: boolean;
  className?: string;
}) {
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
          {verified ? 'Source code verified by NEAR Playground' : 'Source code not verified'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
