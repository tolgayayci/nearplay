import * as monaco from 'monaco-editor';

// Language configuration for Rust
export const rustLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
  ],
  indentationRules: {
    increaseIndentPattern: /^.*\{[^}"']*$|^.*\([^)"']*$|^\s*(pub\s+)?((if|while|for|match|impl|struct|enum|mod|unsafe)\b.*?)?\s*$/,
    decreaseIndentPattern: /^(.*\*\/)?\s*[})].*$/,
  },
};

// Initialize Monaco editor with Rust and NEAR SDK support
export function initializeMonaco(monaco: typeof import('monaco-editor')) {
  // First, configure themes
  configureThemes(monaco);

  // Register Rust language if not already registered
  if (!monaco.languages.getLanguages().some(lang => lang.id === 'rust')) {
    monaco.languages.register({ id: 'rust' });
    monaco.languages.setLanguageConfiguration('rust', rustLanguageConfig);

    // Create completion items after Monaco is initialized
    const createCompletionItems = () => {
      // NEAR SDK types and completions
      const NEAR_SDK_TYPES = [
        {
          label: 'near_bindgen',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'near_sdk::near_bindgen',
          documentation: 'NEAR contract attribute macro',
          insertText: [
            '#[near_bindgen]',
            '#[derive(BorshDeserialize, BorshSerialize)]',
            'pub struct ${1:Contract} {',
            '    ${2:// State variables}',
            '}',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        },
        {
          label: 'AccountId',
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'near_sdk::AccountId',
          documentation: 'NEAR account identifier type',
          insertText: 'AccountId',
        },
        {
          label: 'Balance',
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'near_sdk::Balance',
          documentation: 'NEAR token balance type (u128)',
          insertText: 'Balance',
        },
        {
          label: 'Promise',
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'near_sdk::Promise',
          documentation: 'Cross-contract call promise',
          insertText: 'Promise',
        },
        {
          label: 'LookupMap',
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'near_sdk::collections::LookupMap',
          documentation: 'Gas-efficient key-value storage',
          insertText: 'LookupMap<${1:K}, ${2:V}>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        },
        {
          label: 'UnorderedSet',
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'near_sdk::collections::UnorderedSet',
          documentation: 'Gas-efficient set collection',
          insertText: 'UnorderedSet<${1:T}>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        },
      ];

      // NEAR SDK method snippets
      const METHOD_SNIPPETS = [
        {
          label: 'init_method',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'NEAR initialization method',
          documentation: 'Create a contract initialization method',
          insertText: [
            '#[init]',
            'pub fn new(${1:params}) -> Self {',
            '    Self {',
            '        ${2:// Initialize fields}',
            '    }',
            '}',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        },
        {
          label: 'view_method',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'View method template',
          documentation: 'Create a read-only view method',
          insertText: [
            'pub fn ${1:method_name}(&self) -> ${2:String} {',
            '    ${3:// Implementation}',
            '}',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        },
        {
          label: 'payable_method',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'Payable method template',
          documentation: 'Create a method that accepts NEAR tokens',
          insertText: [
            '#[payable]',
            'pub fn ${1:method_name}(&mut self${2:, param: Type}) {',
            '    let deposit = env::attached_deposit();',
            '    ${3:// Implementation}',
            '}',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        },
      ];

      // Register completion provider
      monaco.languages.registerCompletionItemProvider('rust', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // Get the current line content
          const lineContent = model.getLineContent(position.lineNumber);

          // Check context for appropriate suggestions
          const suggestions = [];

          // Inside impl block
          if (lineContent.includes('impl')) {
            suggestions.push(...METHOD_SNIPPETS);
          }

          // Always suggest NEAR SDK types
          suggestions.push(...NEAR_SDK_TYPES);

          return {
            suggestions: suggestions.map(item => ({
              ...item,
              range,
            })),
          };
        },
      });

      // Add hover provider for documentation
      monaco.languages.registerHoverProvider('rust', {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          // Find matching type or snippet
          const item = [...NEAR_SDK_TYPES, ...METHOD_SNIPPETS]
            .find(i => i.label === word.word);

          if (item && item.documentation) {
            return {
              contents: [
                { value: `**${item.label}**` },
                { value: item.documentation as string },
              ],
            };
          }

          return null;
        },
      });
    };

    // Create completions after Monaco is ready
    setTimeout(createCompletionItems, 100);
  }
}

// Define editor theme based on dark/light mode
export function defineEditorTheme(monaco: typeof import('monaco-editor'), isDark: boolean) {
  // Ensure themes are configured
  configureThemes(monaco);
  const themeName = isDark ? 'rust-dark' : 'rust-light';
  monaco.editor.setTheme(themeName);
}

// Default editor options
export const defaultEditorOptions = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Monaco, Consolas, "Courier New", monospace',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'on' as const,
  wrappingIndent: 'indent' as const,
  formatOnType: true,
  formatOnPaste: true,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on' as const,
  folding: true,
  foldingStrategy: 'indentation' as const,
  showFoldingControls: 'always' as const,
  matchBrackets: 'always' as const,
  renderWhitespace: 'selection' as const,
  renderLineHighlight: 'all' as const,
  scrollbar: {
    vertical: 'visible' as const,
    horizontal: 'visible' as const,
    useShadows: true,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
};

// Export editor options
export const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: 'vs-dark',
  language: 'rust',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Monaco, Consolas, "Courier New", monospace',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'on',
  wrappingIndent: 'indent',
  formatOnType: true,
  formatOnPaste: true,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  folding: true,
  foldingStrategy: 'indentation',
  showFoldingControls: 'always',
  matchBrackets: 'always',
  renderWhitespace: 'selection',
  renderLineHighlight: 'all',
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    useShadows: true,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
};

// Configure themes
export function configureThemes(monaco: typeof import('monaco-editor')) {
  // Define custom dark theme optimized for Rust
  monaco.editor.defineTheme('rust-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'FF7B72' },
      { token: 'keyword.control', foreground: 'FF7B72' },
      { token: 'keyword.other', foreground: 'FF7B72' },
      { token: 'storage.type', foreground: 'FF7B72' },
      { token: 'storage.modifier', foreground: 'FF7B72' },
      { token: 'constant', foreground: '79C0FF' },
      { token: 'constant.numeric', foreground: '79C0FF' },
      { token: 'constant.language', foreground: '79C0FF' },
      { token: 'support.type', foreground: 'FFA657' },
      { token: 'entity.name.type', foreground: 'FFA657' },
      { token: 'entity.name.function', foreground: 'D2A8FF' },
      { token: 'variable', foreground: 'FFA657' },
      { token: 'variable.parameter', foreground: 'FFA657' },
      { token: 'string', foreground: 'A5D6FF' },
      { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
      { token: 'punctuation', foreground: 'C9D1D9' },
      { token: 'operator', foreground: 'FF7B72' },
      { token: 'meta.attribute', foreground: 'D2A8FF' },
    ],
    colors: {
      'editor.background': '#0D1117',
      'editor.foreground': '#C9D1D9',
      'editor.lineHighlightBackground': '#161B22',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#264F7855',
      'editorLineNumber.foreground': '#8B949E',
      'editorLineNumber.activeForeground': '#C9D1D9',
      'editorCursor.foreground': '#58A6FF',
      'editorWhitespace.foreground': '#484F58',
    },
  });

  // Define custom light theme optimized for Rust
  monaco.editor.defineTheme('rust-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'CF222E' },
      { token: 'keyword.control', foreground: 'CF222E' },
      { token: 'keyword.other', foreground: 'CF222E' },
      { token: 'storage.type', foreground: 'CF222E' },
      { token: 'storage.modifier', foreground: 'CF222E' },
      { token: 'constant', foreground: '0550AE' },
      { token: 'constant.numeric', foreground: '0550AE' },
      { token: 'constant.language', foreground: '0550AE' },
      { token: 'support.type', foreground: '953800' },
      { token: 'entity.name.type', foreground: '953800' },
      { token: 'entity.name.function', foreground: '8250DF' },
      { token: 'variable', foreground: '953800' },
      { token: 'variable.parameter', foreground: '953800' },
      { token: 'string', foreground: '0A3069' },
      { token: 'comment', foreground: '6E7781', fontStyle: 'italic' },
      { token: 'punctuation', foreground: '24292F' },
      { token: 'operator', foreground: 'CF222E' },
      { token: 'meta.attribute', foreground: '8250DF' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#24292F',
      'editor.lineHighlightBackground': '#F6F8FA',
      'editor.selectionBackground': '#B4D7FE',
      'editor.inactiveSelectionBackground': '#B4D7FE55',
      'editorLineNumber.foreground': '#8C959F',
      'editorLineNumber.activeForeground': '#24292F',
      'editorCursor.foreground': '#0969DA',
      'editorWhitespace.foreground': '#D1D9E0',
    },
  });
}