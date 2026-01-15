/**
 * Test Parser - Parses Rust files to discover test functions
 * Supports both #[test] (unit tests) and #[tokio::test] (integration tests)
 */

export interface TestFunction {
  name: string;
  filePath: string;
  lineNumber: number;
  isAsync: boolean;
  isIntegration: boolean; // true for #[tokio::test] tests
  modulePath: string[]; // e.g., ['tests', 'unit_tests']
}

export interface TestFile {
  path: string;
  tests: TestFunction[];
}

export interface TestDiscoveryResult {
  files: TestFile[];
  totalTests: number;
}

/**
 * Parse a Rust file to find test functions
 */
export function parseTestsFromFile(filePath: string, content: string): TestFunction[] {
  const tests: TestFunction[] = [];
  const lines = content.split('\n');

  // Track current module path
  const moduleStack: string[] = [];
  let braceDepth = 0;
  const moduleStartDepths: number[] = [];

  // Regex to find #[test] or #[tokio::test] attribute followed by fn declaration
  const testAttrRegex = /#\[test\]/;
  const tokioTestAttrRegex = /#\[tokio::test\]/;
  const fnRegex = /^\s*(pub\s+)?(async\s+)?fn\s+(\w+)/;
  const modRegex = /^\s*(pub\s+)?mod\s+(\w+)\s*\{?/;
  const cfgTestRegex = /#\[cfg\(test\)\]/;

  let inTestModule = false;
  let foundTestAttr = false;
  let foundTokioTestAttr = false;
  let testAttrLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Track brace depth for module tracking
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Check for #[cfg(test)]
    if (cfgTestRegex.test(line)) {
      inTestModule = true;
    }

    // Check for module declaration
    const modMatch = line.match(modRegex);
    if (modMatch) {
      const modName = modMatch[2];
      moduleStack.push(modName);
      moduleStartDepths.push(braceDepth);

      // Check if this is a tests module
      if (modName === 'tests' || modName === 'test') {
        inTestModule = true;
      }
    }

    // Update brace depth
    braceDepth += openBraces - closeBraces;

    // Pop modules when we exit their scope
    while (moduleStartDepths.length > 0 && braceDepth <= moduleStartDepths[moduleStartDepths.length - 1]) {
      moduleStack.pop();
      moduleStartDepths.pop();
    }

    // Check for #[tokio::test] attribute (integration tests)
    if (tokioTestAttrRegex.test(line)) {
      foundTokioTestAttr = true;
      foundTestAttr = false;
      testAttrLine = lineNumber;
      continue;
    }

    // Check for #[test] attribute (unit tests)
    if (testAttrRegex.test(line)) {
      foundTestAttr = true;
      foundTokioTestAttr = false;
      testAttrLine = lineNumber;
      continue;
    }

    // If we found a test attribute, look for the fn on this or next few lines
    if (foundTestAttr || foundTokioTestAttr) {
      const fnMatch = line.match(fnRegex);
      if (fnMatch) {
        const isAsync = !!fnMatch[2];
        const fnName = fnMatch[3];

        tests.push({
          name: fnName,
          filePath,
          lineNumber: testAttrLine,
          isAsync,
          isIntegration: foundTokioTestAttr,
          modulePath: [...moduleStack],
        });

        foundTestAttr = false;
        foundTokioTestAttr = false;
      } else if (line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('//')) {
        // Reset if we hit a non-attribute, non-comment line without finding fn
        foundTestAttr = false;
        foundTokioTestAttr = false;
      }
    }
  }

  return tests;
}

/**
 * Get the full test name for cargo test (module::path::test_name)
 */
export function getFullTestName(test: TestFunction): string {
  if (test.modulePath.length > 0) {
    return `${test.modulePath.join('::')}::${test.name}`;
  }
  return test.name;
}

/**
 * Group tests by file
 */
export function groupTestsByFile(tests: TestFunction[]): TestFile[] {
  const fileMap = new Map<string, TestFunction[]>();

  for (const test of tests) {
    const existing = fileMap.get(test.filePath) || [];
    existing.push(test);
    fileMap.set(test.filePath, existing);
  }

  return Array.from(fileMap.entries()).map(([path, tests]) => ({
    path,
    tests,
  }));
}

/**
 * Parse multiple files and discover all tests
 */
export function discoverTests(files: { path: string; content: string }[]): TestDiscoveryResult {
  const allTests: TestFunction[] = [];

  for (const file of files) {
    // Only parse .rs files
    if (!file.path.endsWith('.rs')) continue;

    const tests = parseTestsFromFile(file.path, file.content);
    allTests.push(...tests);
  }

  return {
    files: groupTestsByFile(allTests),
    totalTests: allTests.length,
  };
}
