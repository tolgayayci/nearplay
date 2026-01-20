// Convert ANSI escape codes to CSS styles
export function parseAnsiOutput(text: string): { text: string; className: string }[] {
  const result: { text: string; className: string }[] = [];
  const parts = text.split(/(\x1b\[[0-9;]*m)/);
  let currentClasses: string[] = [];

  for (const part of parts) {
    if (part.startsWith('\x1b[')) {
      // Parse ANSI codes
      const codes = part.slice(2, -1).split(';').map(Number);
      for (const code of codes) {
        switch (code) {
          case 0: // Reset
            currentClasses = [];
            break;
          case 1: // Bold
            currentClasses.push('font-bold');
            break;
          case 2: // Dim
            currentClasses.push('opacity-70');
            break;
          case 3: // Italic
            currentClasses.push('italic');
            break;
          case 4: // Underline
            currentClasses.push('underline');
            break;
          // Foreground colors (theme-aware)
          case 30: // Black - use foreground color for visibility
            currentClasses.push('text-foreground');
            break;
          case 31: // Red
            currentClasses.push('text-red-600 dark:text-red-400');
            break;
          case 32: // Green
            currentClasses.push('text-green-600 dark:text-green-400');
            break;
          case 33: // Yellow
            currentClasses.push('text-yellow-600 dark:text-yellow-400');
            break;
          case 34: // Blue
            currentClasses.push('text-blue-600 dark:text-blue-400');
            break;
          case 35: // Magenta
            currentClasses.push('text-purple-600 dark:text-purple-400');
            break;
          case 36: // Cyan
            currentClasses.push('text-cyan-600 dark:text-cyan-400');
            break;
          case 37: // White - use foreground color for visibility
            currentClasses.push('text-foreground');
            break;
          // Bright colors (theme-aware)
          case 90: // Bright black (gray)
            currentClasses.push('text-muted-foreground');
            break;
          case 91: // Bright red
            currentClasses.push('text-red-500 dark:text-red-300');
            break;
          case 92: // Bright green
            currentClasses.push('text-green-500 dark:text-green-300');
            break;
          case 93: // Bright yellow
            currentClasses.push('text-yellow-500 dark:text-yellow-300');
            break;
          case 94: // Bright blue
            currentClasses.push('text-blue-500 dark:text-blue-300');
            break;
          case 95: // Bright magenta
            currentClasses.push('text-purple-500 dark:text-purple-300');
            break;
          case 96: // Bright cyan
            currentClasses.push('text-cyan-500 dark:text-cyan-300');
            break;
          case 97: // Bright white
            currentClasses.push('text-foreground');
            break;
          // Background colors (40-47, 100-107)
          case 41: // Red background
            currentClasses.push('bg-red-500/20');
            break;
          case 42: // Green background
            currentClasses.push('bg-green-500/20');
            break;
          case 43: // Yellow background
            currentClasses.push('bg-yellow-500/20');
            break;
          case 38: // 256 color or RGB (simplified to green for now)
            currentClasses.push('text-green-500');
            break;
        }
      }
    } else if (part) {
      // Add text with current styling
      result.push({
        text: part,
        className: currentClasses.join(' ') || 'text-muted-foreground'
      });
    }
  }

  return result;
}

// Parse and categorize console output lines
export interface ParsedLine {
  type: 'info' | 'warning' | 'error' | 'success' | 'normal';
  content: string;
  raw: string;
}

export function categorizeOutputLine(line: string): ParsedLine {
  const lowerLine = line.toLowerCase();

  // Error patterns
  if (lowerLine.includes('error') || lowerLine.includes('failed') ||
      lowerLine.includes('fatal') || lowerLine.includes('panic')) {
    return { type: 'error', content: line, raw: line };
  }

  // Warning patterns
  if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
    return { type: 'warning', content: line, raw: line };
  }

  // Success patterns
  if (lowerLine.includes('success') || lowerLine.includes('finished') ||
      lowerLine.includes('completed') || line.includes('✓')) {
    return { type: 'success', content: line, raw: line };
  }

  // Info patterns
  if (lowerLine.includes('compiling') || lowerLine.includes('building') ||
      lowerLine.includes('info') || line.startsWith('   ')) {
    return { type: 'info', content: line, raw: line };
  }

  return { type: 'normal', content: line, raw: line };
}

// Merge stdout and stderr into a unified output
export function mergeOutputStreams(stdout: string, stderr: string): string {
  // For now, we'll show stderr first (errors/warnings) then stdout
  // In a real implementation, we'd need timestamps to properly interleave
  const lines: string[] = [];

  if (stderr && stderr.trim()) {
    lines.push(...stderr.split('\n'));
  }

  if (stdout && stdout.trim()) {
    if (lines.length > 0) {
      lines.push(''); // Add separator
    }
    lines.push(...stdout.split('\n'));
  }

  return lines.join('\n');
}