// copyCodeAction.ts - Svelte action to add copy buttons to code blocks
import { MarkupFormatter } from './MarkupFormatter';

/**
 * Svelte action to add copy buttons to code blocks
 * @param node The element to attach the action to (should be a container with code blocks)
 */
export function addCopyCodeButtons(node: HTMLElement) {
  function initCopyButtons() {
    const codeBlocks = node.querySelectorAll('pre:not(.copy-enabled)');
    
    codeBlocks.forEach(pre => {
      pre.classList.add('copy-enabled');
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-button';
      copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      copyButton.title = 'Copy to clipboard';
      
      pre.appendChild(copyButton);
      
      copyButton.style.position = 'absolute';
      copyButton.style.top = '0.5rem';
      copyButton.style.right = '0.5rem';
      copyButton.style.opacity = '0';
      copyButton.style.transition = 'opacity 0.2s';
      
      if (getComputedStyle(pre).position === 'static') {
        pre.style.position = 'relative';
      }
      
      pre.addEventListener('mouseenter', () => {
        copyButton.style.opacity = '1';
      });
      
      pre.addEventListener('mouseleave', () => {
        copyButton.style.opacity = '0';
      });
      
      copyButton.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        
        try {
          const code = pre.querySelector('code');
          if (!code) return;
          
          const rawCode = pre.getAttribute('data-raw-code');
          let textToCopy = '';
          
          if (rawCode) {
            textToCopy = decodeURIComponent(rawCode);
          } else {
            textToCopy = code.innerText;
          }
          
          await navigator.clipboard.writeText(textToCopy);
          
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          copyButton.style.backgroundColor = 'var(--success-color, #4caf50)';
          
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.style.backgroundColor = '';
          }, 1500);
          
        } catch (error) {
          console.error('Failed to copy code:', error);
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
          copyButton.style.backgroundColor = 'var(--error-color, #f44336)';
          
          setTimeout(() => {
            copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            copyButton.style.backgroundColor = '';
          }, 1500);
        }
      });
    });
  }
  
  initCopyButtons();
  
  const observer = new MutationObserver((mutations) => {
    let shouldInit = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.tagName === 'PRE' || element.querySelector('pre')) {
              shouldInit = true;
              break;
            }
          }
        }
      }
      
      if (shouldInit) break;
    }
    
    if (shouldInit) {
      initCopyButtons();
    }
  });
  
  observer.observe(node, { childList: true, subtree: true });
  
  return {
    destroy() {
      observer.disconnect();
      
      const copyButtons = node.querySelectorAll('.copy-code-button');
      copyButtons.forEach(button => {
        button.remove();
      });
    }
  };
}