import { CompilationResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Terminal, Loader2, Clock, History, Blocks, Copy, CheckCircle, AlertCircle, Info, AlertTriangle, Expand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseAnsiOutput, mergeOutputStreams, categorizeOutputLine } from '@/lib/ansi';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CompilerOutputDialog } from './CompilerOutputDialog';

interface CompilerViewProps {
  result?: CompilationResult | null;
  isCompiling?: boolean;
  projectId?: string;
  isSharedView?: boolean;
}

export function CompilerView({
  result,
  isCompiling,
  projectId,
  isSharedView = false,
}: CompilerViewProps) {
  const [copied, setCopied] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollContentRef.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [result, isCompiling]);

  if (!result && !isCompiling) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/40">
        <div className="text-center">
          <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
            <Blocks className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <h3 className="font-medium mb-3">
            {isSharedView ? "No Compilation Data" : "Ready to Compile"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isSharedView 
              ? "This project has no compilation history"
              : "Click the Compile button to build your NEAR smart contract"
            }
          </p>
        </div>
      </div>
    );
  }

  const displayResult = result;
  const compilationTime = displayResult?.details?.compilation_time 
    ? new Date(displayResult.details.compilation_time * 1000).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Console output copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getLineIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case 'info':
        return <Info className="h-3.5 w-3.5 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      {/* Status Header */}
      <div className="flex-none flex items-center justify-between px-3 py-1.5 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          {isCompiling ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              <span className="text-xs font-medium text-yellow-500">
                Compiling...
              </span>
            </>
          ) : displayResult && (
            <>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                displayResult.success ? "bg-green-500" : "bg-red-500"
              )} />
              <span className={cn(
                "text-xs font-medium",
                displayResult.success ? "text-green-500" : "text-red-500"
              )}>
                {displayResult.success ? "Build succeeded" : "Build failed"}
              </span>
              {!result && !isSharedView && (
                <Badge variant="outline" className="ml-2 bg-blue-500/10 text-blue-500 text-[10px]">
                  <History className="h-3 w-3 mr-1" />
                  Last Build
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCompiling && displayResult && (
            <>
              <Badge variant="outline" className={cn(
                "text-[10px] font-medium px-1.5 h-5",
                displayResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
              )}>
                Exit: {displayResult.exit_code}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {compilationTime}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Unified Console Output */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-none flex items-center justify-between px-4 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-medium">Console Output</h3>
          </div>
          {displayResult && (displayResult.stdout || displayResult.stderr) && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => setShowDetailDialog(true)}
              >
                <Expand className="h-3.5 w-3.5" />
                <span className="text-xs">See in Detail</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => {
                  const mergedOutput = mergeOutputStreams(
                    displayResult.stdout || '',
                    displayResult.stderr || ''
                  );
                  handleCopy(mergedOutput);
                }}
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">
                  {copied ? 'Copied!' : 'Copy'}
                </span>
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 h-full" ref={scrollAreaRef}>
          <div className="p-4 bg-muted/5" ref={scrollContentRef}>
            {isCompiling ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Compiling project...</span>
              </div>
            ) : displayResult ? (
              <div className="space-y-1 font-mono text-xs">
                {(() => {
                  const mergedOutput = mergeOutputStreams(
                    displayResult.stdout || '',
                    displayResult.stderr || ''
                  );
                  const lines = mergedOutput.split('\n').filter(line => line.trim());

                  return lines.map((line, lineIndex) => {
                    const categorized = categorizeOutputLine(line);
                    const icon = getLineIcon(categorized.type);
                    const parsedParts = parseAnsiOutput(line);

                    return (
                      <div
                        key={lineIndex}
                        className={cn(
                          "flex items-start gap-2 py-0.5 px-1 rounded",
                          categorized.type === 'error' && "bg-red-500/5",
                          categorized.type === 'warning' && "bg-yellow-500/5",
                          categorized.type === 'success' && "bg-green-500/5",
                          categorized.type === 'info' && "bg-blue-500/5"
                        )}
                      >
                        {icon && (
                          <span className="flex-none mt-0.5">
                            {icon}
                          </span>
                        )}
                        <pre className={cn(
                          "flex-1 whitespace-pre-wrap break-all",
                          categorized.type === 'error' && "text-red-500/90",
                          categorized.type === 'warning' && "text-yellow-500/90",
                          categorized.type === 'success' && "text-green-500/90",
                          categorized.type === 'normal' && "text-foreground/80"
                        )}>
                          {parsedParts.map((part, i) => (
                            <span key={i} className={cn(
                              part.className,
                              "dark:[&.text-muted-foreground]:text-foreground/70"
                            )}>
                              {part.text}
                            </span>
                          ))}
                        </pre>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-muted-foreground text-xs">
                No output available
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Dialog */}
      <CompilerOutputDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        result={displayResult}
      />
    </div>
  );
}