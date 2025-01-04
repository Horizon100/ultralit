// markdownProcessor.ts
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false
});

function highlightJSON(code: string): string {
  try {
    const tokenTypes = {
      punctuation: /[{}[\],]/g,
      key: /"([^"]+)"(?=\s*:)/g,
      string: /"([^"]+)"/g,
      number: /-?\d+\.?\d*/g,
      boolean: /\b(true|false)\b/g,
      null: /\bnull\b/g
    };

    let highlightedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight keys
    highlightedCode = highlightedCode.replace(
      tokenTypes.key,
      '<span class="json-key">$&</span>'
    );

    // Highlight string values
    highlightedCode = highlightedCode.replace(
      tokenTypes.string,
      (match) => {
        if (!match.match(/"([^"]+)"(?=\s*:)/)) {
          return '<span class="json-string">' + match + '</span>';
        }
        return match;
      }
    );

    // Highlight other tokens
    highlightedCode = highlightedCode
      .replace(tokenTypes.number, '<span class="json-number">$&</span>')
      .replace(tokenTypes.boolean, '<span class="json-boolean">$&</span>')
      .replace(tokenTypes.null, '<span class="json-null">$&</span>')
      .replace(tokenTypes.punctuation, '<span class="json-punctuation">$&</span>');

    return highlightedCode;
  } catch (error) {
    console.error('Error highlighting JSON:', error);
    return code;
  }
}

// Custom renderer for code blocks
const renderer = new marked.Renderer();
renderer.code = (code, language) => {
  if (language === 'json') {
    try {
      // Format JSON if it's valid
      const formattedJSON = JSON.stringify(JSON.parse(code), null, 2);
      const highlightedCode = highlightJSON(formattedJSON);
      return `<pre class="language-json"><code>${highlightedCode}</code></pre>`;
    } catch {
      // If JSON parsing fails, highlight as is
      return `<pre class="language-json"><code>${highlightJSON(code)}</code></pre>`;
    }
  }
  return `<pre><code class="language-${language}">${code}</code></pre>`;
};

marked.setOptions({ renderer });

export function processMarkdown(content: string): string {
  try {
    const processed = marked(content);
    
    return processed
      // Ensure proper spacing around headers
      .replace(/(<h[1-6]>)/g, '\n$1')
      .replace(/(<\/h[1-6]>)/g, '$1\n')
      // Proper list formatting
      .replace(/(<[uo]l>)/g, '\n$1')
      .replace(/(<\/[uo]l>)/g, '$1\n')
      // Proper code block formatting
      .replace(/(<pre>)/g, '\n$1')
      .replace(/(<\/pre>)/g, '$1\n')
      // Clean up excessive newlines
      .replace(/\n{3,}/g, '\n\n');
  } catch (error) {
    console.error('Error processing markdown:', error);
    return content;
  }
}
