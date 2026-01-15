/**
 * Test Output Parser - Parses cargo test JSON output
 *
 * cargo test -- --format=json -Z unstable-options outputs JSON lines like:
 * {"type":"suite","event":"started","test_count":3}
 * {"type":"test","event":"started","name":"tests::test_init"}
 * {"type":"test","name":"tests::test_init","event":"ok","exec_time":0.001,"stdout":""}
 * {"type":"test","name":"tests::test_fail","event":"failed","exec_time":0.002,"stdout":"assertion failed..."}
 * {"type":"suite","event":"ok","passed":2,"failed":1,"ignored":0,"measured":0,"filtered_out":0,"exec_time":0.123}
 */

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'ignored';

export interface TestResult {
  name: string;
  status: TestStatus;
  duration?: number; // in seconds
  stdout?: string;
  message?: string;
}

export interface TestSuiteResult {
  status: 'running' | 'completed';
  totalTests: number;
  passed: number;
  failed: number;
  ignored: number;
  duration?: number;
  tests: Map<string, TestResult>;
}

// JSON message types from cargo test
interface SuiteStarted {
  type: 'suite';
  event: 'started';
  test_count: number;
}

interface SuiteCompleted {
  type: 'suite';
  event: 'ok' | 'failed';
  passed: number;
  failed: number;
  ignored: number;
  measured: number;
  filtered_out: number;
  exec_time: number;
}

interface TestStarted {
  type: 'test';
  event: 'started';
  name: string;
}

interface TestCompleted {
  type: 'test';
  event: 'ok' | 'failed' | 'ignored';
  name: string;
  exec_time?: number;
  stdout?: string;
}

type CargoTestMessage = SuiteStarted | SuiteCompleted | TestStarted | TestCompleted;

/**
 * Create an initial test suite result
 */
export function createTestSuiteResult(): TestSuiteResult {
  return {
    status: 'running',
    totalTests: 0,
    passed: 0,
    failed: 0,
    ignored: 0,
    tests: new Map(),
  };
}

/**
 * Parse a single JSON line from cargo test output
 */
export function parseTestOutputLine(line: string, suite: TestSuiteResult): TestSuiteResult {
  // Skip empty lines
  if (!line.trim()) return suite;

  try {
    const msg = JSON.parse(line) as CargoTestMessage;

    switch (msg.type) {
      case 'suite':
        if (msg.event === 'started') {
          return {
            ...suite,
            status: 'running',
            totalTests: msg.test_count,
          };
        } else {
          // Suite completed
          return {
            ...suite,
            status: 'completed',
            passed: msg.passed,
            failed: msg.failed,
            ignored: msg.ignored,
            duration: msg.exec_time,
          };
        }

      case 'test':
        if (msg.event === 'started') {
          const tests = new Map(suite.tests);
          tests.set(msg.name, {
            name: msg.name,
            status: 'running',
          });
          return { ...suite, tests };
        } else {
          const tests = new Map(suite.tests);
          const status: TestStatus =
            msg.event === 'ok' ? 'passed' :
            msg.event === 'failed' ? 'failed' : 'ignored';

          tests.set(msg.name, {
            name: msg.name,
            status,
            duration: msg.exec_time,
            stdout: msg.stdout,
            message: msg.event === 'failed' ? msg.stdout : undefined,
          });

          return {
            ...suite,
            tests,
            passed: status === 'passed' ? suite.passed + 1 : suite.passed,
            failed: status === 'failed' ? suite.failed + 1 : suite.failed,
            ignored: status === 'ignored' ? suite.ignored + 1 : suite.ignored,
          };
        }

      default:
        return suite;
    }
  } catch {
    // Not valid JSON, might be compilation output or other text
    // Try to parse as text output for fallback
    return parseTextOutputLine(line, suite);
  }
}

/**
 * Strip ANSI escape codes from a string
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

/**
 * Fallback parser for text output (when JSON parsing fails)
 */
function parseTextOutputLine(line: string, suite: TestSuiteResult): TestSuiteResult {
  // Strip ANSI escape codes for matching
  const cleanLine = stripAnsi(line);

  // Match "test module::test_name ... ok" or "... FAILED" or "... ignored"
  // Test names can contain letters, numbers, underscores, and colons (for module paths)
  // Also handle variations with extra whitespace
  const testResultMatch = cleanLine.match(/^test\s+([\w:]+)\s+\.{3}\s*(ok|FAILED|ignored)/i);
  if (testResultMatch) {
    const [, name, result] = testResultMatch;
    const tests = new Map(suite.tests);
    const normalizedResult = result.toLowerCase();
    const status: TestStatus =
      normalizedResult === 'ok' ? 'passed' :
      normalizedResult === 'failed' ? 'failed' : 'ignored';

    // Check if we already have this test to avoid double-counting
    const existingTest = suite.tests.get(name);
    const alreadyCounted = existingTest && existingTest.status !== 'running' && existingTest.status !== 'pending';

    tests.set(name, {
      name,
      status,
    });

    return {
      ...suite,
      tests,
      passed: (status === 'passed' && !alreadyCounted) ? suite.passed + 1 : suite.passed,
      failed: (status === 'failed' && !alreadyCounted) ? suite.failed + 1 : suite.failed,
      ignored: (status === 'ignored' && !alreadyCounted) ? suite.ignored + 1 : suite.ignored,
    };
  }

  // Match "running X tests" or "running X test"
  const runningMatch = cleanLine.match(/running\s+(\d+)\s+tests?/i);
  if (runningMatch) {
    return {
      ...suite,
      totalTests: suite.totalTests + parseInt(runningMatch[1], 10),
    };
  }

  // Match final result "test result: ok. X passed; Y failed; Z ignored"
  // Also handle variations in spacing and punctuation
  const resultMatch = cleanLine.match(/test result:\s*(ok|FAILED)\.?\s*(\d+)\s*passed;?\s*(\d+)\s*failed;?\s*(\d+)\s*ignored/i);
  if (resultMatch) {
    return {
      ...suite,
      status: 'completed',
      passed: parseInt(resultMatch[2], 10),
      failed: parseInt(resultMatch[3], 10),
      ignored: parseInt(resultMatch[4], 10),
    };
  }

  return suite;
}

/**
 * Parse complete test output (multiple lines)
 */
export function parseTestOutput(output: string): TestSuiteResult {
  const lines = output.split('\n');
  let suite = createTestSuiteResult();

  for (const line of lines) {
    suite = parseTestOutputLine(line, suite);
  }

  return suite;
}

/**
 * Get test status icon
 */
export function getTestStatusIcon(status: TestStatus): string {
  switch (status) {
    case 'passed': return '✓';
    case 'failed': return '✗';
    case 'running': return '⏳';
    case 'ignored': return '○';
    case 'pending': return '○';
    default: return '○';
  }
}

/**
 * Get test status color class
 */
export function getTestStatusColor(status: TestStatus): string {
  switch (status) {
    case 'passed': return 'text-green-500';
    case 'failed': return 'text-red-500';
    case 'running': return 'text-yellow-500';
    case 'ignored': return 'text-muted-foreground';
    case 'pending': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

/**
 * Format test duration
 */
export function formatTestDuration(seconds?: number): string {
  if (seconds === undefined) return '';
  if (seconds < 0.001) return '<1ms';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(2)}s`;
}
