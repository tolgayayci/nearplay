import { useRef, useState, useCallback, useEffect } from 'react';

interface TerminalMessage {
  type: 'command' | 'output' | 'exit' | 'error' | 'ready';
  command?: string;
  session_id?: string;
  rpc_url?: string;
  data?: string;
  stream?: string;
  code?: number;
  message?: string;
}

interface UseTerminalOptions {
  userId: string;
  projectId: string;
  autoConnect?: boolean;  // Auto-connect on mount, defaults to true
  onOutput?: (data: string, stream: 'stdout' | 'stderr') => void;
  onReady?: () => void;
  onExit?: (code: number) => void;
  onError?: (message: string) => void;
}

interface UseTerminalReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  sendCommand: (command: string, rpcUrl?: string) => void;
  error: string | null;
}

export function useTerminal({
  userId,
  projectId,
  autoConnect = true,
  onOutput,
  onReady,
  onExit,
  onError,
}: UseTerminalOptions): UseTerminalReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;

  // Store callbacks in refs to avoid dependency issues
  const onOutputRef = useRef(onOutput);
  const onReadyRef = useRef(onReady);
  const onExitRef = useRef(onExit);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onOutputRef.current = onOutput;
    onReadyRef.current = onReady;
    onExitRef.current = onExit;
    onErrorRef.current = onError;
  }, [onOutput, onReady, onExit, onError]);

  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    // Get WebSocket URL from environment or construct it
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    const url = `${wsUrl}/ws/terminal?user_id=${encodeURIComponent(userId)}&project_id=${encodeURIComponent(projectId)}`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        retryCountRef.current = 0; // Reset retry count on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message: TerminalMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'ready':
              onReadyRef.current?.();
              break;
            case 'output':
              if (message.data) {
                onOutputRef.current?.(message.data, (message.stream as 'stdout' | 'stderr') || 'stdout');
              }
              break;
            case 'exit':
              if (message.code !== undefined) {
                onExitRef.current?.(message.code);
              }
              break;
            case 'error':
              if (message.message) {
                onErrorRef.current?.(message.message);
                setError(message.message);
              }
              break;
          }
        } catch (e) {
          console.error('Failed to parse terminal message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        console.error('WebSocket connection error');
        setIsConnecting(false);
        wsRef.current = null;

        // Retry logic
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
          setError(`Connection failed. Retrying (${retryCountRef.current}/${maxRetries})...`);

          retryTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Connection failed. Click to retry.');
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setIsConnecting(false);
      setError('Failed to connect');
    }
  }, [userId, projectId]);

  const disconnect = useCallback(() => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendCommand = useCallback((command: string, rpcUrl?: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }

    const message: TerminalMessage = {
      type: 'command',
      command,
      session_id: `${userId}-${projectId}`,
      rpc_url: rpcUrl,
    };

    wsRef.current.send(JSON.stringify(message));
  }, [userId, projectId]);

  // Auto-connect when userId and projectId are available
  useEffect(() => {
    if (autoConnect && userId && projectId) {
      // Small delay to ensure component is fully mounted
      const timeout = setTimeout(() => {
        connect();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [autoConnect, userId, projectId, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendCommand,
    error,
  };
}
