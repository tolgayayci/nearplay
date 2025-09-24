import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Terminal,
  Copy,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseAnsiOutput, categorizeOutputLine } from '@/lib/ansi';
import { useToast } from '@/hooks/use-toast';
import { CompilationResult } from '@/lib/types';

interface CompilerOutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: CompilationResult | null;
}

interface ParsedMessage {
  line: number;
  type: 'error' | 'warning' | 'success' | 'info' | 'normal';
  content: string;
  raw: string;
}

export function CompilerOutputDialog({
  open,
  onOpenChange,
  result,
}: CompilerOutputDialogProps) {
  const [copied, setCopied] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [errorIndex, setErrorIndex] = useState(0);
  const [warningIndex, setWarningIndex] = useState(0);
  const [successIndex, setSuccessIndex] = useState(0);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Reset indices when dialog opens or result changes
  useEffect(() => {
    if (open) {
      setErrorIndex(0);
      setWarningIndex(0);
      setSuccessIndex(0);
    }
  }, [open, result]);

  // Parse output into structured messages
  const parsedMessages: ParsedMessage[] = [];
  if (result) {
    const mergedOutput = [
      ...(result.stderr ? result.stderr.split('\n') : []),
      ...(result.stdout ? result.stdout.split('\n') : []),
    ];

    mergedOutput.forEach((line, index) => {
      if (line.trim()) {
        const categorized = categorizeOutputLine(line);
        parsedMessages.push({
          line: index + 1,
          type: categorized.type,
          content: categorized.content,
          raw: categorized.raw,
        });
      }
    });
  }

  // Get counts and indices for different message types
  const errorMessages = parsedMessages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.type === 'error');
  const warningMessages = parsedMessages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.type === 'warning');
  const successMessages = parsedMessages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.type === 'success');
  const infoMessages = parsedMessages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.type === 'info');

  const messageCounts = {
    error: errorMessages.length,
    warning: warningMessages.length,
    success: successMessages.length,
    info: infoMessages.length,
  };

  const scrollToLine = (lineIndex: number) => {
    const element = lineRefs.current.get(lineIndex);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-yellow-500/20');
      setTimeout(() => {
        element.classList.remove('bg-yellow-500/20');
      }, 2000);
    }
  };

  const jumpToMessageType = (type: 'error' | 'warning' | 'success' | 'info') => {
    let targetIndex = -1;

    switch(type) {
      case 'error':
        if (errorMessages.length > 0) {
          const nextIndex = (errorIndex + 1) % errorMessages.length;
          setErrorIndex(nextIndex);
          targetIndex = errorMessages[nextIndex].index;
        }
        break;
      case 'warning':
        if (warningMessages.length > 0) {
          const nextIndex = (warningIndex + 1) % warningMessages.length;
          setWarningIndex(nextIndex);
          targetIndex = warningMessages[nextIndex].index;
        }
        break;
      case 'success':
        if (successMessages.length > 0) {
          const nextIndex = (successIndex + 1) % successMessages.length;
          setSuccessIndex(nextIndex);
          targetIndex = successMessages[nextIndex].index;
        }
        break;
      case 'info':
        // Just go to first info message, no cycling
        const firstInfo = parsedMessages.findIndex(m => m.type === 'info');
        if (firstInfo !== -1) {
          targetIndex = firstInfo;
        }
        break;
    }

    if (targetIndex !== -1) {
      scrollToLine(targetIndex);
    }
  };

  const handleCopy = async (content?: string) => {
    const textToCopy = content || parsedMessages.map(m => m.raw).join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: content ? "Selected content copied" : "Full output copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    const content = parsedMessages.map(m => m.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compilation-output-${new Date().toISOString()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Output exported as log file",
    });
  };

  const getIcon = (type: string) => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-6xl w-[90vw] h-[85vh]">
        <DialogHeader className="flex-none pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Detailed Compilation Output
          </DialogTitle>
        </DialogHeader>

        {/* Quick Stats Bar */}
        <div className="flex-none flex items-center gap-2 px-3 py-1.5 border-y bg-muted/20">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer hover:bg-red-500/20",
              messageCounts.error > 0 && "bg-red-500/10 text-red-500"
            )}
            onClick={() => jumpToMessageType('error')}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            {messageCounts.error > 0 ? `${errorIndex + 1}/${messageCounts.error}` : '0'} Errors
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer hover:bg-yellow-500/20",
              messageCounts.warning > 0 && "bg-yellow-500/10 text-yellow-500"
            )}
            onClick={() => jumpToMessageType('warning')}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            {messageCounts.warning > 0 ? `${warningIndex + 1}/${messageCounts.warning}` : '0'} Warnings
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer hover:bg-green-500/20",
              messageCounts.success > 0 && "bg-green-500/10 text-green-500"
            )}
            onClick={() => jumpToMessageType('success')}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {messageCounts.success > 0 ? `${successIndex + 1}/${messageCounts.success}` : '0'} Success
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer hover:bg-blue-500/20",
              messageCounts.info > 0 && "bg-blue-500/10 text-blue-500"
            )}
            onClick={() => jumpToMessageType('info')}
          >
            <Info className="h-3 w-3 mr-1" />
            {messageCounts.info} Info
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy()}
              className="h-8 gap-1.5"
            >
              {copied ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied!' : 'Copy All'}
            </Button>
          </div>
        </div>


        {/* Output Content */}
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="p-3 font-mono text-xs">
            {parsedMessages.map((message, index) => {
              const icon = getIcon(message.type);
              const parsedParts = parseAnsiOutput(message.content);

              return (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) lineRefs.current.set(index, el);
                  }}
                  className={cn(
                    "flex items-start gap-2 py-0.5 pl-1 pr-2 rounded transition-all",
                    message.type === 'error' && "bg-red-500/5",
                    message.type === 'warning' && "bg-yellow-500/5",
                    message.type === 'success' && "bg-green-500/5",
                    message.type === 'info' && "bg-blue-500/5",
                    selectedLines.has(index) && "bg-primary/10"
                  )}
                  onClick={() => {
                    const newSelected = new Set(selectedLines);
                    if (newSelected.has(index)) {
                      newSelected.delete(index);
                    } else {
                      newSelected.add(index);
                    }
                    setSelectedLines(newSelected);
                  }}
                >
                  <span className="flex-none text-muted-foreground/50 select-none w-10 text-right">
                    {message.line}
                  </span>
                  {icon && (
                    <span className="flex-none mt-0.5">
                      {icon}
                    </span>
                  )}
                  <pre className={cn(
                    "flex-1 whitespace-pre-wrap break-all",
                    message.type === 'error' && "text-red-500/90",
                    message.type === 'warning' && "text-yellow-500/90",
                    message.type === 'success' && "text-green-500/90",
                    message.type === 'normal' && "text-foreground/80"
                  )}>
                    {parsedParts.map((part, i) => (
                      <span key={i} className={part.className}>
                        {part.text}
                      </span>
                    ))}
                  </pre>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        {selectedLines.size > 0 && (
          <div className="flex-none flex items-center justify-between px-3 py-2 border-t bg-muted/20">
            <span className="text-sm text-muted-foreground">
              {selectedLines.size} lines selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedText = Array.from(selectedLines)
                    .sort((a, b) => a - b)
                    .map(i => parsedMessages[i].raw)
                    .join('\n');
                  handleCopy(selectedText);
                }}
                className="h-8"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLines(new Set())}
                className="h-8"
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}