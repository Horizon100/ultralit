import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

// Helper function to safely define tag styles
function safeTagStyle(tag, style) {
  // Check if the tag is defined before using it
  if (tag === undefined) return null;
  return { tag, ...style };
}

// Filter out null values from style definitions
function createHighlightStyle(styles) {
  return HighlightStyle.define(styles.filter(style => style !== null));
}

/**
 * Default dark theme highlighting
 */
export const darkHighlightStyle = createHighlightStyle([
  safeTagStyle(t.keyword, { color: '#c678dd' }),
  safeTagStyle(t.comment, { color: '#7f848e', fontStyle: 'italic' }),
  safeTagStyle(t.string, { color: '#98c379' }),
  safeTagStyle(t.number, { color: '#d19a66' }),
  safeTagStyle(t.boolean, { color: '#d19a66' }),
  safeTagStyle(t.regexp, { color: '#e06c75' }),
  safeTagStyle(t.operator, { color: '#56b6c2' }),
  safeTagStyle(t.variableName, { color: '#e06c75' }),
  safeTagStyle(t.definitionKeyword, { color: '#c678dd' }),
  safeTagStyle(t.className, { color: '#e5c07b' }),
  safeTagStyle(t.propertyName, { color: '#61afef' }),
  safeTagStyle(t.function && t.variableName ? t.function(t.variableName) : null, { color: '#61afef' }),
  safeTagStyle(t.typeName, { color: '#e5c07b' }),
  safeTagStyle(t.tagName, { color: '#e06c75' }),
  safeTagStyle(t.attributeName, { color: '#d19a66' }),
  safeTagStyle(t.heading, { color: '#61afef', fontWeight: 'bold' }),
  safeTagStyle(t.link, { color: '#98c379', textDecoration: 'underline' }),
  safeTagStyle(t.processingInstruction, { color: '#56b6c2' }),
  safeTagStyle(t.definition && t.name ? t.definition(t.name) : null, { color: '#e06c75' }),
]);

/**
 * Default light theme highlighting
 */
export const lightHighlightStyle = createHighlightStyle([
  safeTagStyle(t.keyword, { color: '#8959a8' }),
  safeTagStyle(t.comment, { color: '#8e908c', fontStyle: 'italic' }),
  safeTagStyle(t.string, { color: '#718c00' }),
  safeTagStyle(t.number, { color: '#f5871f' }),
  safeTagStyle(t.boolean, { color: '#f5871f' }),
  safeTagStyle(t.regexp, { color: '#c82829' }),
  safeTagStyle(t.operator, { color: '#3e999f' }),
  safeTagStyle(t.variableName, { color: '#c82829' }),
  safeTagStyle(t.definitionKeyword, { color: '#8959a8' }),
  safeTagStyle(t.className, { color: '#eab700' }),
  safeTagStyle(t.propertyName, { color: '#4271ae' }),
  safeTagStyle(t.function && t.variableName ? t.function(t.variableName) : null, { color: '#4271ae' }),
  safeTagStyle(t.typeName, { color: '#eab700' }),
  safeTagStyle(t.tagName, { color: '#c82829' }),
  safeTagStyle(t.attributeName, { color: '#f5871f' }),
  safeTagStyle(t.heading, { color: '#4271ae', fontWeight: 'bold' }),
  safeTagStyle(t.link, { color: '#718c00', textDecoration: 'underline' }),
  safeTagStyle(t.processingInstruction, { color: '#3e999f' }),
  safeTagStyle(t.definition && t.name ? t.definition(t.name) : null, { color: '#c82829' }),
]);

// Dark theme extension including syntax highlighting
export const darkThemeWithHighlighting = [
  EditorView.theme({
    '&': {
      color: '#ddd',
      backgroundColor: '#1e1e1e'
    },
    '.cm-content': {
      caretColor: '#528bff'
    },
    '.cm-cursor': {
      borderLeftColor: '#528bff'
    },
    '.cm-activeLine': {
      backgroundColor: '#2c313a'
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#7d8799',
      border: 'none'
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#2c313a'
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(120, 145, 175, 0.2)'
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: '#abb2bf !important',
      outline: '1px solid #528bff'
    },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgba(99, 123, 156, 0.25)'
    }
  }),
  syntaxHighlighting(darkHighlightStyle)
];

// Light theme extension including syntax highlighting
export const lightThemeWithHighlighting = [
  EditorView.theme({
    '&': {
      color: '#333',
      backgroundColor: '#fff'
    },
    '.cm-content': {
      caretColor: '#000'
    },
    '.cm-cursor': {
      borderLeftColor: '#000'
    },
    '.cm-activeLine': {
      backgroundColor: '#f0f0f0'
    },
    '.cm-gutters': {
      backgroundColor: '#f5f5f5',
      color: '#999',
      border: 'none'
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#e9e9e9'
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(180, 215, 255, 0.5)'
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      color: '#333 !important',
      outline: '1px solid #4271ae'
    },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgba(180, 215, 255, 0.3)'
    }
  }),
  syntaxHighlighting(lightHighlightStyle)
];

// Basic highlighting style (fallback for incompatible versions)
export const basicHighlightStyle = createHighlightStyle([
  safeTagStyle(t.keyword, { color: '#cc99cd' }),
  safeTagStyle(t.comment, { color: '#999', fontStyle: 'italic' }),
  safeTagStyle(t.string, { color: '#7ec699' }),
  safeTagStyle(t.number, { color: '#f08d49' }),
  safeTagStyle(t.variableName, { color: '#e06c75' }),
  safeTagStyle(t.className, { color: '#e5c07b' }),
  safeTagStyle(t.propertyName, { color: '#6fb3d2' }),
]);

/**
 * Get syntax highlighting for a specific language
 */
export function getLanguageHighlighting(filename: string, isDarkMode: boolean) {
  const fileExtension = filename.split('.').pop()?.toLowerCase();
  
  try {
    // Base theme based on dark mode
    const baseTheme = isDarkMode ? darkThemeWithHighlighting : lightThemeWithHighlighting;
    
    // Basic highlighting in case of errors
    const basicTheme = [
      baseTheme[0],
      syntaxHighlighting(basicHighlightStyle)
    ];
    
    // Specialized theme extensions based on file type
    if (fileExtension === 'tsx' || fileExtension === 'jsx') {
      try {
        // Create React style only with available tags
        const reactStyle = createHighlightStyle([
          // Use basic highlighting as fallback
          ...basicHighlightStyle.specs,
          // JSX specific that we know exist
          safeTagStyle(t.tagName, { color: '#61afef' }),
          safeTagStyle(t.attributeName, { color: '#d19a66' }),
        ]);
        
        return [
          baseTheme[0],
          syntaxHighlighting(reactStyle)
        ];
      } catch (e) {
        console.warn('Error creating React highlighting, falling back to basic', e);
        return basicTheme;
      }
    } else if (fileExtension === 'ts') {
      try {
        // Create TypeScript style only with available tags
        const tsStyle = createHighlightStyle([
          // Use basic highlighting as fallback
          ...basicHighlightStyle.specs,
          // TypeScript specific
          safeTagStyle(t.typeName, { color: '#e5c07b' }),
        ]);
        
        return [
          baseTheme[0],
          syntaxHighlighting(tsStyle)
        ];
      } catch (e) {
        console.warn('Error creating TypeScript highlighting, falling back to basic', e);
        return basicTheme;
      }
    }
    
    // Default to base theme if no specialized theme
    return baseTheme;
  } catch (e) {
    console.warn('Error in syntax highlighting, falling back to basic style', e);
    // Return very basic styling that should work
    return [
      EditorView.theme({
        '&': {
          color: isDarkMode ? '#ddd' : '#333',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#fff'
        }
      }),
      syntaxHighlighting(basicHighlightStyle)
    ];
  }
}