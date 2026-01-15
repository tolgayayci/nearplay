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
  Blocks,
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

// Group tests by type
interface GroupedTests {
  unitTests: TestFile[];
  integrationTests: TestFile[];
  unitTestCount: number;
  integrationTestCount: number;
}

export function TestsModal({
  open,
  onOpenChange,
  userId,
  projectId,
}: TestsModalProps) {
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['unit', 'integration']));
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
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

  // Group tests by type
  const groupedTests = useCallback((): GroupedTests => {
    const unitTests: TestFile[] = [];
    const integrationTests: TestFile[] = [];
    let unitTestCount = 0;
    let integrationTestCount = 0;

    testFiles.forEach(file => {
      const unitFileTests = file.tests.filter(t => !t.isIntegration);
      const integrationFileTests = file.tests.filter(t => t.isIntegration);

      if (unitFileTests.length > 0) {
        unitTests.push({ path: file.path, tests: unitFileTests });
        unitTestCount += unitFileTests.length;
      }
      if (integrationFileTests.length > 0) {
        integrationTests.push({ path: file.path, tests: integrationFileTests });
        integrationTestCount += integrationFileTests.length;
      }
    });

    return { unitTests, integrationTests, unitTestCount, integrationTestCount };
  }, [testFiles]);

  // Find all .rs files in tests/ directory from file tree
  const findTestFiles = useCallback((node: FileNode, basePath: string = ''): string[] => {
    const results: string[] = [];
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

    if (node.is_directory) {
      if (node.name === 'tests' || currentPath === 'tests') {
        node.children?.forEach(child => {
          if (!child.is_directory && child.name.endsWith('.rs')) {
            results.push(child.path);
          } else if (child.is_directory) {
            results.push(...findTestFiles(child, child.path));
          }
        });
      } else {
        node.children?.forEach(child => {
          results.push(...findTestFiles(child, currentPath));
        });
      }
    }

    return results;
  }, []);

  // Discover tests in the project
  const discoverTests = useCallback(async () => {
    if (!userId || !projectId) return;

    setIsDiscovering(true);
    try {
      const tree = await getFileTree(userId, projectId);
      const testsInTestsDir = findTestFiles(tree);
      const testPaths = ['src/lib.rs', 'src/main.rs', ...testsInTestsDir];
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
  }, [userId, projectId, findTestFiles]);

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
    setSelectedTest(null);
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

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Get test status (with fuzzy matching)
  const getTestStatus = (testName: string): TestStatus => {
    // Try exact match first
    const result = suiteResult.tests.get(testName);
    if (result) return result.status;

    // Try partial match
    const shortName = testName.split('::').pop() || testName;
    for (const [key, value] of suiteResult.tests.entries()) {
      if (key.endsWith(shortName) || key.includes(testName) || testName.includes(key)) {
        return value.status;
      }
    }

    return 'pending';
  };

  // Get test result (with fuzzy matching)
  const getTestResult = (testName: string): TestResult | undefined => {
    // Try exact match first
    const result = suiteResult.tests.get(testName);
    if (result) return result;

    // Try partial match
    const shortName = testName.split('::').pop() || testName;
    for (const [key, value] of suiteResult.tests.entries()) {
      if (key.endsWith(shortName) || key.includes(testName) || testName.includes(key)) {
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

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Toggle test expansion (accordion)
  const toggleTest = (testName: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testName)) {
        next.delete(testName);
      } else {
        next.add(testName);
      }
      return next;
    });
  };

  // Get output for a specific test
  const getTestOutput = (testName: string): string => {
    // Try exact match first
    if (perTestOutput.has(testName)) {
      return perTestOutput.get(testName)!;
    }

    // Try to find by partial match (test name without full module path)
    const shortName = testName.split('::').pop() || testName;
    for (const [key, value] of perTestOutput.entries()) {
      if (key.endsWith(shortName) || key.includes(testName) || testName.includes(key)) {
        return value;
      }
    }

    // Try to extract from full output if we have it
    if (output && testName) {
      const lines = output.split('\n');
      const testOutput: string[] = [];
      let capturing = false;

      for (const line of lines) {
        const cleanLine = stripAnsi(line);
        // Start capturing when we see this test starting
        if (cleanLine.includes(`test ${testName}`) || cleanLine.includes(`test ${shortName}`)) {
          capturing = true;
        }
        if (capturing) {
          testOutput.push(line);
          // Stop when we see the test result
          if (cleanLine.match(/^test\s+[\w:]+\s+\.{3}\s*(ok|FAILED|ignored)/i)) {
            break;
          }
        }
      }

      if (testOutput.length > 0) {
        return testOutput.join('\n');
      }
    }

    return suiteResult.tests.get(testName)?.stdout || '';
  };

  // Get status icon
  const StatusIcon = ({ status }: { status: TestStatus }) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'ignored':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const { unitTests, integrationTests, unitTestCount, integrationTestCount } = groupedTests();
  const totalTests = unitTestCount + integrationTestCount;

  // Render test file section
  const renderTestFile = (file: TestFile, isIntegration: boolean) => (
    <Collapsible
      key={file.path}
      open={expandedFiles.has(file.path)}
      onOpenChange={() => toggleFile(file.path)}
    >
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent rounded-md text-sm">
        {expandedFiles.has(file.path) ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <FileCode className={cn("h-4 w-4 shrink-0", isIntegration ? "text-purple-500" : "text-blue-500")} />
        <span className="truncate text-left flex-1">{file.path}</span>
        <Badge variant="outline" className="text-xs shrink-0">
          {file.tests.length}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-6 space-y-1">
          {file.tests.map((test) => {
            const fullName = getFullTestName(test);
            const status = getTestStatus(fullName);
            const result = getTestResult(fullName);
            const isExpanded = expandedTests.has(fullName);
            const testOutput = getTestOutput(fullName);
            const hasOutput = testOutput.length > 0 || status === 'failed';

            return (
              <div key={fullName} className="space-y-0">
                {/* Test Row */}
                <div
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer group',
                    'hover:bg-accent transition-colors',
                    selectedTest === fullName && 'bg-accent ring-1 ring-primary',
                    status === 'failed' && 'bg-red-500/10',
                    isExpanded && 'rounded-b-none'
                  )}
                  onClick={() => {
                    if (hasOutput) {
                      toggleTest(fullName);
                    }
                    setSelectedTest(fullName);
                  }}
                >
                  {/* Expand/collapse indicator */}
                  {hasOutput ? (
                    isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )
                  ) : (
                    <span className="w-3" />
                  )}
                  <StatusIcon status={status} />
                  <span className="truncate flex-1 font-mono text-xs">{test.name}</span>
                  {result?.duration && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTestDuration(result.duration)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      runTests(fullName);
                    }}
                    disabled={isRunning}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </div>

                {/* Accordion Content - Test Output */}
                {isExpanded && hasOutput && (
                  <div className={cn(
                    'ml-6 mb-2 rounded-b-md border border-t-0 overflow-hidden',
                    status === 'failed' ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/30'
                  )}>
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/50">
                      <span className="text-xs text-muted-foreground">Test Output</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(testOutput || '', `test-${fullName}`);
                        }}
                      >
                        {copiedId === `test-${fullName}` ? (
                          <>
                            <Check className="h-3 w-3 mr-1 text-green-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto text-muted-foreground">
                      {testOutput || (status === 'failed' ? 'Test failed - run again to see output' : 'No output captured')}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5" />
                Tests
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TestTube className="h-3.5 w-3.5 text-blue-500" />
                  {unitTestCount} unit
                </span>
                <span className="flex items-center gap-1">
                  <Blocks className="h-3.5 w-3.5 text-purple-500" />
                  {integrationTestCount} integration
                </span>
              </div>
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
                    Run All Tests
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Summary bar (when running or completed) */}
        {(isRunning || suiteResult.status === 'completed') && (
          <div className="flex items-center gap-4 px-6 py-2 border-b bg-muted/30 text-sm">
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
            {isRunning && (
              <span className="flex items-center gap-1.5 text-yellow-600 ml-auto">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running tests...
              </span>
            )}
          </div>
        )}

        {/* Main content - two panel layout */}
        <div className="flex-1 flex min-h-0">
          {/* Left Panel - Test List */}
          <div className="w-3/5 flex flex-col border-r">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {isDiscovering ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-3" />
                    Discovering tests...
                  </div>
                ) : totalTests === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">No tests found</p>
                    <p className="text-xs mt-1">Add #[test] or #[tokio::test] functions to your code</p>
                  </div>
                ) : (
                  <>
                    {/* Unit Tests Section */}
                    {unitTestCount > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          className="flex items-center gap-2 w-full p-3 bg-blue-500/10 hover:bg-blue-500/15 transition-colors"
                          onClick={() => toggleSection('unit')}
                        >
                          {expandedSections.has('unit') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <TestTube className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">UNIT TESTS</span>
                          <Badge className="ml-auto bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20">
                            {unitTestCount}
                          </Badge>
                        </button>
                        {expandedSections.has('unit') && (
                          <div className="p-2 space-y-1">
                            {unitTests.map((file) => renderTestFile(file, false))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Integration Tests Section */}
                    {integrationTestCount > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          className="flex items-center gap-2 w-full p-3 bg-purple-500/10 hover:bg-purple-500/15 transition-colors"
                          onClick={() => toggleSection('integration')}
                        >
                          {expandedSections.has('integration') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Blocks className="h-4 w-4 text-purple-500" />
                          <span className="font-medium text-sm">INTEGRATION TESTS</span>
                          <Badge className="ml-auto bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20">
                            {integrationTestCount}
                          </Badge>
                        </button>
                        {expandedSections.has('integration') && (
                          <div className="p-2 space-y-1">
                            {integrationTests.map((file) => renderTestFile(file, true))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Output Viewer */}
          <div className="w-2/5 flex flex-col bg-muted/20 max-h-[500px]">
            {/* Output Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {isRunning ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Running tests...
                    </span>
                  ) : selectedTest ? (
                    <span className="font-mono text-xs truncate">{selectedTest}</span>
                  ) : (
                    'Output'
                  )}
                </span>
              </div>
              {/* Copy All button */}
              {output && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
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
            <div className="flex-1 overflow-y-auto min-h-0">
              {isRunning && output ? (
                <pre
                  ref={outputRef}
                  className="p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed"
                >
                  {output}
                </pre>
              ) : selectedTest && (suiteResult.tests.has(selectedTest) || perTestOutput.has(selectedTest)) ? (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <StatusIcon status={getTestStatus(selectedTest)} />
                    <span className="text-sm font-medium">
                      {getTestStatus(selectedTest) === 'passed' ? 'Test Passed' :
                       getTestStatus(selectedTest) === 'failed' ? 'Test Failed' :
                       getTestStatus(selectedTest) === 'running' ? 'Running...' : 'Pending'}
                    </span>
                    {getTestResult(selectedTest)?.duration && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTestDuration(getTestResult(selectedTest)?.duration)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-2"
                      onClick={() => copyToClipboard(getTestOutput(selectedTest) || '', `panel-${selectedTest}`)}
                    >
                      {copiedId === `panel-${selectedTest}` ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap bg-background rounded-md p-3 border max-h-[350px] overflow-y-auto">
                    {getTestOutput(selectedTest) || 'No output captured'}
                  </pre>
                </div>
              ) : output ? (
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {output}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                  <Terminal className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Select a test to view its output</p>
                  <p className="text-xs mt-1">or run tests to see live output</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
