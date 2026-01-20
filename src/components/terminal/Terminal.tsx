import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { useTerminal } from '@/hooks/useTerminal';
import { useRPC } from '@/contexts/RPCContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import {
  TerminalIcon,
  Loader2,
  Wifi,
  WifiOff,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Expand,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { TerminalOutputModal } from './TerminalOutputModal';

interface TerminalProps {
  userId: string;
  projectId: string;
  className?: string;
  onMaximize?: () => void;
  isMaximized?: boolean;
  compilationOutput?: string;
}

export function Terminal({
  userId,
  projectId,
  className,
  onMaximize,
  isMaximized = false,
  compilationOutput = '',
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandBufferRef = useRef<string>('');
  const lastCompilationOutputRef = useRef<string>('');
  const isConnectedRef = useRef(false);  // Ref to track connection state for closure
  const sendCommandRef = useRef<((cmd: string) => void) | null>(null);  // Ref for sendCommand
  const setIsRunningCommandRef = useRef<((running: boolean) => void) | null>(null);  // Ref for setIsRunningCommand
  const [isReady, setIsReady] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outputBuffer, setOutputBuffer] = useState<string[]>([]);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const { theme, systemTheme } = useTheme();
  const { toast } = useToast();
  const { getCurrentRpcUrl } = useRPC();
  const { network } = useWallet();
  const rpcUrlRef = useRef<string>('');

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  const handleOutput = useCallback((data: string, _stream: 'stdout' | 'stderr') => {
    if (xtermRef.current) {
      // Convert \n to \r\n for proper terminal line handling
      // xterm.js needs carriage return + line feed to move to start of next line
      const formattedData = data.replace(/\r?\n/g, '\r\n');

      // Write output directly - trust the backend ANSI codes
      // Don't add any color wrapping as it interferes with cargo's colored output
      xtermRef.current.write(formattedData);

      // Add to output buffer for modal display
      const lines = data.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        setOutputBuffer(prev => {
          const newBuffer = [...prev, ...lines];
          // Limit buffer size to prevent memory issues
          if (newBuffer.length > 2000) {
            return newBuffer.slice(-1500);
          }
          return newBuffer;
        });
      }
    }
  }, []);

  const handleReady = useCallback(() => {
    setIsReady(true);
    if (xtermRef.current) {
      xtermRef.current.write('$ ');
    }
  }, []);

  const handleExit = useCallback((code: number) => {
    setIsRunningCommand(false);
    if (xtermRef.current) {
      if (code === 0) {
        xtermRef.current.writeln(`\x1b[32mProcess exited with code ${code}\x1b[0m`);
      } else {
        xtermRef.current.writeln(`\x1b[31mProcess exited with code ${code}\x1b[0m`);
      }
      xtermRef.current.write('$ ');
    }
  }, []);

  const handleError = useCallback((message: string) => {
    setIsRunningCommand(false);
    if (xtermRef.current) {
      xtermRef.current.writeln(`\x1b[31mError: ${message}\x1b[0m`);
      xtermRef.current.write('$ ');
    }
  }, []);

  const {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendCommand,
    error,
  } = useTerminal({
    userId,
    projectId,
    onOutput: handleOutput,
    onReady: handleReady,
    onExit: handleExit,
    onError: handleError,
  });

  // Keep refs in sync with state for use in closures
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  useEffect(() => {
    setIsRunningCommandRef.current = setIsRunningCommand;
  }, []);

  // Keep RPC URL ref in sync
  useEffect(() => {
    rpcUrlRef.current = getCurrentRpcUrl(network);
  }, [getCurrentRpcUrl, network]);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: effectiveTheme === 'dark' ? {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#444444',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#ffffff',
      } : {
        // Light theme - colors optimized for white background
        background: '#ffffff',
        foreground: '#1e1e1e',
        cursor: '#1e1e1e',
        cursorAccent: '#ffffff',
        selectionBackground: '#add6ff',
        black: '#1e1e1e',      // Visible black (not pure black)
        red: '#dc2626',        // Tailwind red-600
        green: '#16a34a',      // Tailwind green-600
        yellow: '#ca8a04',     // Tailwind yellow-600
        blue: '#2563eb',       // Tailwind blue-600
        magenta: '#9333ea',    // Tailwind purple-600
        cyan: '#0891b2',       // Tailwind cyan-600
        white: '#f5f5f5',      // Light gray for white text
        brightBlack: '#737373', // Tailwind neutral-500
        brightRed: '#ef4444',  // Tailwind red-500
        brightGreen: '#22c55e', // Tailwind green-500
        brightYellow: '#eab308', // Tailwind yellow-500
        brightBlue: '#3b82f6', // Tailwind blue-500
        brightMagenta: '#a855f7', // Tailwind purple-500
        brightCyan: '#06b6d4', // Tailwind cyan-500
        brightWhite: '#e5e5e5', // Tailwind neutral-200
      },
      allowTransparency: false,
      rows: 15,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);

    // Fit to container
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Handle user input
    xterm.onData((data) => {
      // Use ref to get current connection state (avoids stale closure)
      if (!isConnectedRef.current) {
        // Don't spam messages - just silently ignore input while not connected
        // The terminal already shows status via the header
        return;
      }

      // Handle special keys
      if (data === '\r') {
        // Enter key
        xterm.write('\r\n');
        const command = commandBufferRef.current.trim();
        if (command) {
          // Set running state before sending command
          setIsRunningCommandRef.current?.(true);
          // Use ref to get current sendCommand function and RPC URL
          sendCommandRef.current?.(command, rpcUrlRef.current);
        } else {
          xterm.write('$ ');
        }
        commandBufferRef.current = '';
      } else if (data === '\x7f') {
        // Backspace
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (data === '\x03') {
        // Ctrl+C
        xterm.write('^C\r\n$ ');
        commandBufferRef.current = '';
      } else if (data >= ' ') {
        // Regular printable characters
        commandBufferRef.current += data;
        xterm.write(data);
      }
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
    };
  }, []);

  // Update theme when it changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = effectiveTheme === 'dark' ? {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#444444',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#ffffff',
      } : {
        background: '#ffffff',
        foreground: '#1e1e1e',
        cursor: '#1e1e1e',
        cursorAccent: '#ffffff',
        selectionBackground: '#add6ff',
        black: '#1e1e1e',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0891b2',
        white: '#f5f5f5',
        brightBlack: '#737373',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#e5e5e5',
      };
    }
  }, [effectiveTheme]);

  // Fit terminal when container size changes
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [isMaximized]);

  // Write compilation output to terminal when it changes
  useEffect(() => {
    if (xtermRef.current && compilationOutput && compilationOutput !== lastCompilationOutputRef.current) {
      // Find the new content (diff between current and last)
      const newContent = compilationOutput.slice(lastCompilationOutputRef.current.length);
      if (newContent) {
        // Write each line, handling newlines properly for xterm
        // Preserve any ANSI codes from backend
        const lines = newContent.split('\n');
        const linesToBuffer: string[] = [];

        lines.forEach((line, index) => {
          if (line.trim()) {
            if (index > 0) {
              xtermRef.current?.write('\r\n');
            }
            // Write line directly - preserve any ANSI codes from backend
            // Only add color if line doesn't already have ANSI codes
            if (!line.includes('\x1b[')) {
              // Color compilation messages that don't have ANSI codes
              if (line.includes('Compilation successful') || line.includes('Finished')) {
                xtermRef.current?.write(`\x1b[32m${line}\x1b[0m`);
                linesToBuffer.push(`\x1b[32m${line}\x1b[0m`);
              } else if (line.includes('Compilation failed') || line.toLowerCase().includes('error')) {
                xtermRef.current?.write(`\x1b[31m${line}\x1b[0m`);
                linesToBuffer.push(`\x1b[31m${line}\x1b[0m`);
              } else if (line.toLowerCase().includes('warning')) {
                xtermRef.current?.write(`\x1b[33m${line}\x1b[0m`);
                linesToBuffer.push(`\x1b[33m${line}\x1b[0m`);
              } else if (line.includes('[INFO]')) {
                xtermRef.current?.write(`\x1b[36m${line}\x1b[0m`);
                linesToBuffer.push(`\x1b[36m${line}\x1b[0m`);
              } else {
                xtermRef.current?.write(line);
                linesToBuffer.push(line);
              }
            } else {
              // Has ANSI codes, write directly
              xtermRef.current?.write(line);
              linesToBuffer.push(line);
            }
          }
        });

        // Add to output buffer
        if (linesToBuffer.length > 0) {
          setOutputBuffer(prev => {
            const newBuffer = [...prev, ...linesToBuffer];
            if (newBuffer.length > 2000) {
              return newBuffer.slice(-1500);
            }
            return newBuffer;
          });
        }
      }
      lastCompilationOutputRef.current = compilationOutput;
    }
  }, [compilationOutput]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.write('$ ');
    }
    // Also clear the output buffer
    setOutputBuffer([]);
  };

  const handleCopy = useCallback(() => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        toast({ title: 'Copied selection' });
      } else {
        // Copy entire buffer
        const buffer = xtermRef.current.buffer.active;
        let text = '';
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            text += line.translateToString() + '\n';
          }
        }
        navigator.clipboard.writeText(text.trim());
        toast({ title: 'Copied terminal output' });
      }
    }
  }, [toast]);

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
      if (xtermRef.current) {
        xtermRef.current.writeln('\r\n\x1b[33mDisconnected\x1b[0m');
        xtermRef.current.write('$ ');
      }
    } else if (!isConnecting) {
      // Only try to connect if not already connecting
      connect();
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-background border rounded-md overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Terminal</span>
          {isConnecting && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
              <span className="text-xs text-yellow-500">Connecting...</span>
            </>
          )}
          {isConnected && !isConnecting && !isRunningCommand && (
            <span className="text-xs text-green-500">Connected</span>
          )}
          {isConnected && !isConnecting && isRunningCommand && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs text-primary">Running...</span>
            </>
          )}
          {!isConnected && !isConnecting && error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleToggleConnection}
              >
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isConnected ? 'Disconnect' : 'Connect'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleClear}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsModalOpen(true)}
              >
                <Expand className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand</TooltipContent>
          </Tooltip>
          {onMaximize && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onMaximize}
                >
                  {isMaximized ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isMaximized ? 'Restore' : 'Maximize'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="flex-1 p-2"
        style={{
          minHeight: 0,
          backgroundColor: effectiveTheme === 'dark' ? '#1a1a1a' : '#ffffff'
        }}
      />

      {/* Expanded Modal View */}
      <TerminalOutputModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        outputBuffer={outputBuffer}
        isConnected={isConnected}
      />
    </div>
  );
}
