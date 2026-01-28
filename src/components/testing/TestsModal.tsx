import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Play,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  FileCode,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  Loader2,
  AlertCircle,
  FlaskConical,
  TestTube,
  Terminal,
  Square,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  TestFunction,
  TestFile,
  parseTestsFromFile,
  getFullTestName,
} from '@/lib/testParser';
import {
  TestSuiteResult,
  TestResult,
  TestStatus,
  createTestSuiteResult,
  parseTestOutputLine,
  formatTestDuration,
} from '@/lib/testOutputParser';
import { readFile, getFileTree } from '@/lib/api';
import { FileNode } from '@/lib/types';

interface TestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  projectId: string;
}

export function TestsModal({
  open,
  onOpenChange,
  userId,
  projectId,
}: TestsModalProps) {
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [suiteResult, setSuiteResult] = useState<TestSuiteResult>(createTestSuiteResult());
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [perTestOutput, setPerTestOutput] = useState<Map<string, string>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const currentTestRef = useRef<string | null>(null);
  const currentTestOutputRef = useRef<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy text to clipboard
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Get unit tests only
  const getUnitTests = useCallback((): { files: TestFile[]; count: number } => {
    const files: TestFile[] = [];
    let count = 0;

    testFiles.forEach(file => {
      const unitFileTests = file.tests.filter(t => !t.isIntegration);
      if (unitFileTests.length > 0) {
        files.push({ path: file.path, tests: unitFileTests });
        count += unitFileTests.length;
      }
    });

    return { files, count };
  }, [testFiles]);

  // Discover tests in the project
  const discoverTests = useCallback(async () => {
    if (!userId || !projectId) return;

    setIsDiscovering(true);
    try {
      const tree = await getFileTree(userId, projectId);
      const testPaths = ['src/lib.rs', 'src/main.rs'];
      const uniquePaths = [...new Set(testPaths)];

      const files: TestFile[] = [];

      for (const path of uniquePaths) {
        try {
          const file = await readFile(userId, projectId, path);
          const tests = parseTestsFromFile(path, file.content);
          if (tests.length > 0) {
            files.push({ path, tests });
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      setTestFiles(files);
      setExpandedFiles(new Set(files.map((f) => f.path)));
    } catch (error) {
      console.error('Failed to discover tests:', error);
    } finally {
      setIsDiscovering(false);
    }
  }, [userId, projectId]);

  // Stop running tests
  const stopTests = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Strip ANSI escape codes
  const stripAnsi = (str: string): string => {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  };

  // Run all tests or a specific test
  const runTests = useCallback(async (testName?: string) => {
    if (!userId || !projectId) return;

    setIsRunning(true);
    setSuiteResult(createTestSuiteResult());
    setOutput('');
    // If running a specific test, select it; otherwise clear selection to show all output
    setSelectedTest(testName || null);
    setPerTestOutput(new Map());
    currentTestRef.current = null;
    currentTestOutputRef.current = '';

    const cmd = testName
      ? `cargo test ${testName} -- --nocapture`
      : 'cargo test -- --nocapture';

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    const url = `${wsUrl}/ws/terminal?user_id=${encodeURIComponent(userId)}&project_id=${encodeURIComponent(projectId)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'ready') {
          ws.send(JSON.stringify({
            type: 'command',
            command: cmd,
            session_id: `${userId}-${projectId}`,
          }));
        } else if (msg.type === 'output') {
          setOutput((prev) => prev + msg.data);
          const lines = msg.data.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const cleanLine = stripAnsi(line);

              // Check if a test is starting
              const testStartMatch = cleanLine.match(/^test\s+([\w:]+)\s+\.\.\./);
              if (testStartMatch) {
                // Save previous test output if any
                if (currentTestRef.current && currentTestOutputRef.current) {
                  setPerTestOutput(prev => {
                    const next = new Map(prev);
                    next.set(currentTestRef.current!, currentTestOutputRef.current);
                    return next;
                  });
                }
                // Start tracking new test
                currentTestRef.current = testStartMatch[1];
                currentTestOutputRef.current = line + '\n';
              } else if (currentTestRef.current) {
                // Add to current test output
                currentTestOutputRef.current += line + '\n';

                // Check if test completed
                const testResultMatch = cleanLine.match(/^test\s+([\w:]+)\s+\.{3}\s*(ok|FAILED|ignored)/i);
                if (testResultMatch) {
                  // Save this test's output
                  setPerTestOutput(prev => {
                    const next = new Map(prev);
                    next.set(currentTestRef.current!, currentTestOutputRef.current);
                    return next;
                  });
                  currentTestRef.current = null;
                  currentTestOutputRef.current = '';
                }
              }

              setSuiteResult((prev) => parseTestOutputLine(line, prev));
            }
          }
        } else if (msg.type === 'exit') {
          // Save any remaining test output
          if (currentTestRef.current && currentTestOutputRef.current) {
            setPerTestOutput(prev => {
              const next = new Map(prev);
              next.set(currentTestRef.current!, currentTestOutputRef.current);
              return next;
            });
          }
          setSuiteResult((prev) => ({ ...prev, status: 'completed' }));
          setIsRunning(false);
          ws.close();
        } else if (msg.type === 'error') {
          console.error('Test error:', msg.message);
          setIsRunning(false);
          ws.close();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      setIsRunning(false);
    };

    ws.onclose = () => {
      setIsRunning(false);
      wsRef.current = null;
    };
  }, [userId, projectId]);

  // Discover tests when modal opens
  useEffect(() => {
    if (open) {
      discoverTests();
    }
  }, [open, discoverTests]);

  // Auto-stop running when tests complete (detected from output)
  useEffect(() => {
    if (suiteResult.status === 'completed' && isRunning) {
      // Give a small delay to allow final output to be captured
      const timer = setTimeout(() => {
        setIsRunning(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [suiteResult.status, isRunning]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Get test status - improved matching logic
  const getTestStatus = (test: TestFunction): TestStatus => {
    const fullName = getFullTestName(test);
    const shortName = test.name;

    // Try exact match with full name first
    if (suiteResult.tests.has(fullName)) {
      return suiteResult.tests.get(fullName)!.status;
    }

    // Try matching by short name (last part after ::)
    for (const [key, value] of suiteResult.tests.entries()) {
      const keyShort = key.split('::').pop() || key;
      if (keyShort === shortName) {
        return value.status;
      }
    }

    // Try partial match
    for (const [key, value] of suiteResult.tests.entries()) {
      if (key.includes(shortName) || shortName.includes(key.split('::').pop() || '')) {
        return value.status;
      }
    }

    return 'pending';
  };

  // Get test result - improved matching logic
  const getTestResult = (test: TestFunction): TestResult | undefined => {
    const fullName = getFullTestName(test);
    const shortName = test.name;

    if (suiteResult.tests.has(fullName)) {
      return suiteResult.tests.get(fullName);
    }

    for (const [key, value] of suiteResult.tests.entries()) {
      const keyShort = key.split('::').pop() || key;
      if (keyShort === shortName) {
        return value;
      }
    }

    for (const [key, value] of suiteResult.tests.entries()) {
      if (key.includes(shortName) || shortName.includes(key.split('::').pop() || '')) {
        return value;
      }
    }

    return undefined;
  };

  // Toggle file expansion
  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Get output for a specific test
  const getTestOutput = (test: TestFunction): string => {
    const fullName = getFullTestName(test);
    const shortName = test.name;

    // Try exact match first
    if (perTestOutput.has(fullName)) {
      return perTestOutput.get(fullName)!;
    }

    // Try short name match
    for (const [key, value] of perTestOutput.entries()) {
      const keyShort = key.split('::').pop() || key;
      if (keyShort === shortName) {
        return value;
      }
    }

    // Try partial match
    for (const [key, value] of perTestOutput.entries()) {
      if (key.includes(shortName) || shortName.includes(key.split('::').pop() || '')) {
        return value;
      }
    }

    return '';
  };

  // Get status icon component
  const StatusIcon = ({ status, className }: { status: TestStatus; className?: string }) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className={cn("h-4 w-4 text-green-500", className)} />;
      case 'failed':
        return <XCircle className={cn("h-4 w-4 text-red-500", className)} />;
      case 'running':
        return <Loader2 className={cn("h-4 w-4 text-blue-500 animate-spin", className)} />;
      case 'ignored':
        return <Circle className={cn("h-4 w-4 text-yellow-500", className)} />;
      default:
        return <Circle className={cn("h-4 w-4 text-muted-foreground/50", className)} />;
    }
  };

  // Get status text
  const getStatusText = (status: TestStatus): string => {
    switch (status) {
      case 'passed': return 'Passed';
      case 'failed': return 'Failed';
      case 'running': return 'Running';
      case 'ignored': return 'Ignored';
      default: return 'Pending';
    }
  };

  const { files: unitTests, count: totalTests } = getUnitTests();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5" />
                Tests
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalTests} test{totalTests !== 1 ? 's' : ''} found in src/lib.rs
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopTests}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => discoverTests()}
                    disabled={isDiscovering}
                  >
                    <RotateCcw className={cn('h-4 w-4 mr-2', isDiscovering && 'animate-spin')} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => runTests()}
                    disabled={totalTests === 0}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run All
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Summary bar - always visible */}
        <div className="flex items-center gap-4 px-6 py-2 border-b bg-muted/30 text-sm shrink-0">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="font-medium">{suiteResult.passed}</span> passed
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="font-medium">{suiteResult.failed}</span> failed
          </span>
          <span className="flex items-center gap-1.5">
            <Circle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{suiteResult.ignored}</span> ignored
          </span>
          {suiteResult.duration && (
            <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <Clock className="h-4 w-4" />
              {formatTestDuration(suiteResult.duration)}
            </span>
          )}
          {isRunning && suiteResult.status !== 'completed' && (
            <span className="flex items-center gap-1.5 text-blue-600 ml-auto">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </span>
          )}
          {suiteResult.status === 'completed' && !isRunning && (
            <span className="flex items-center gap-1.5 text-green-600 ml-auto">
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </span>
          )}
        </div>

        {/* Main content - two panel layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel - Test List */}
          <div className="w-1/2 flex flex-col border-r overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4">
                {isDiscovering ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-3" />
                    Discovering tests...
                  </div>
                ) : totalTests === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">No tests found</p>
                    <p className="text-xs mt-1">Add #[test] functions to your code</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {unitTests.map((file) => (
                      <div key={file.path} className="space-y-1">
                        {file.tests.map((test) => {
                          const status = getTestStatus(test);
                          const result = getTestResult(test);
                          const isSelected = selectedTest === test.name;

                          return (
                            <div
                              key={test.name}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                                'hover:bg-accent',
                                isSelected && 'bg-accent ring-1 ring-primary',
                                status === 'failed' && 'bg-red-500/5 hover:bg-red-500/10',
                                status === 'passed' && 'bg-green-500/5 hover:bg-green-500/10'
                              )}
                              onClick={() => setSelectedTest(test.name)}
                            >
                              <StatusIcon status={status} />
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-sm truncate">{test.name}</p>
                              </div>
                              {result?.duration && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatTestDuration(result.duration)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runTests(test.name);
                                }}
                                disabled={isRunning}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Output Viewer */}
          <div className="w-1/2 flex flex-col bg-muted/10 overflow-hidden">
            {/* Output Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Terminal className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium truncate">
                  {selectedTest ? (
                    <span className="font-mono">{selectedTest}</span>
                  ) : (
                    'Output'
                  )}
                </span>
              </div>
              {output && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => copyToClipboard(output, 'all-output')}
                >
                  {copiedId === 'all-output' ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy All
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Output Content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedTest ? (
                  <div>
                    {/* Selected test info */}
                    {unitTests.flatMap(f => f.tests).find(t => t.name === selectedTest) && (
                      <div className="mb-4 p-3 rounded-lg bg-background border">
                        <div className="flex items-center gap-2">
                          <StatusIcon
                            status={getTestStatus(unitTests.flatMap(f => f.tests).find(t => t.name === selectedTest)!)}
                          />
                          <span className="font-medium text-sm">
                            {getStatusText(getTestStatus(unitTests.flatMap(f => f.tests).find(t => t.name === selectedTest)!))}
                          </span>
                          {getTestResult(unitTests.flatMap(f => f.tests).find(t => t.name === selectedTest)!)?.duration && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatTestDuration(getTestResult(unitTests.flatMap(f => f.tests).find(t => t.name === selectedTest)!)?.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Test output */}
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {(() => {
                        const test = unitTests.flatMap(f => f.tests).find(t => t.name === selectedTest);
                        if (test) {
                          const testOutput = getTestOutput(test);
                          if (testOutput) return testOutput;
                        }
                        return output || 'Run tests to see output';
                      })()}
                    </pre>
                  </div>
                ) : output ? (
                  <pre
                    ref={outputRef}
                    className="text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed"
                  >
                    {output}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Terminal className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Select a test to view details</p>
                    <p className="text-xs mt-1">or run tests to see output</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
