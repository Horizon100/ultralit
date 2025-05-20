// export const textareaElement: HTMLTextAreaElement | null = null;
export const defaultTextareaHeight = '60px';

export function adjustFontSize(element: HTMLTextAreaElement) {
	const maxFontSize = 30;
	const minFontSize = 20;
	const maxLength = 50;

	const contentLength = element.value.length;

	if (contentLength <= maxLength) {
		element.style.fontSize = `${maxFontSize}px`;
	} else {
		const fontSize = Math.max(minFontSize, maxFontSize - (contentLength - maxLength) / 2);
		element.style.fontSize = `${fontSize}px`;
	}
}

export function resetTextareaHeight(element?: HTMLTextAreaElement | null) {
	if (!element) return;
	
	element.style.height = 'auto';
	element.style.height = defaultTextareaHeight;
  }

export function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function processWordMinimize(str: string): string {
    if (!str) return '';
    
    // Split the string into words while preserving spaces and punctuation
    const parts = str.split(/(\s+|[.,!?;:()])/);
    
    // Words that trigger styling for the next content word
    const triggerWords = ['to', 'the', 'a', 'an', 'for', 'from', 'in'];
    
    // Style mappings for specific words
    const replacements = {
        'and': '<span class="minimized-symbol">&</span>',
        'with': '<span class="minimized-symbol">w/</span>',
        'delete': '<span class="minimized-symbol">🗑</span>',
        'remove': '<span class="minimized-symbol">🗑</span>',
        'add': '<span class="minimized-symbol">+</span>',
        'create': '<span class="minimized-symbol">+</span>',
        'edit': '<span class="minimized-symbol">✏</span>',
        'modify': '<span class="minimized-symbol">✏</span>',
        'update': '<span class="minimized-symbol">⬆</span>',
        'download': '<span class="minimized-symbol">⬇</span>',
        'upload': '<span class="minimized-symbol">⬆</span>',
        'save': '<span class="minimized-symbol">💾</span>',
        'search': '<span class="minimized-symbol">🔍</span>',
        'find': '<span class="minimized-symbol">🔍</span>',
        'settings': '<span class="minimized-symbol">⚙</span>',
        'config': '<span class="minimized-symbol">⚙</span>',
        'configure': '<span class="minimized-symbol">⚙</span>',
        'help': '<span class="minimized-symbol">❓</span>',
        'support': '<span class="minimized-symbol">❓</span>',
        'info': '<span class="minimized-symbol">ℹ</span>',
        'information': '<span class="minimized-symbol">ℹ</span>',
        'warning': '<span class="minimized-symbol">⚠</span>',
        'error': '<span class="minimized-symbol">❌</span>',
        'success': '<span class="minimized-symbol">✅</span>',
        'complete': '<span class="minimized-symbol">✅</span>',
        'finish': '<span class="minimized-symbol">✅</span>',
        'versus': '<span class="minimized-symbol">vs</span>',
        'against': '<span class="minimized-symbol">vs</span>',
        'through': '<span class="minimized-symbol">thru</span>',
        'from': '<span class="minimized-symbol">←</span>',
        'into': '<span class="minimized-symbol">→</span>'
    };
    
    let result = [];
    let applyStyleToNext = false;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const lowerPart = part.toLowerCase();
        
        // Check if it's a spacing/punctuation part
        if (part.trim() === '') {
            result.push(part);
            continue;
        }
        
        // If we need to style this word (from previous trigger)
        if (applyStyleToNext && part.trim() !== '') {
            result.push(`<span class="styled-word">${part}</span>`);
            applyStyleToNext = false;
            continue;
        }
        
        // Check if this is a trigger word
        if (triggerWords.includes(lowerPart)) {
            result.push(part);
            applyStyleToNext = true;
            continue;
        }
        
        // Apply regular replacements
        if (replacements[lowerPart]) {
            result.push(replacements[lowerPart]);
        } else {
            result.push(part);
        }
    }
    
    return result.join('');
}
	

	   export function processWordCrop(str: string, maxLength: number = 50): string {
        if (!str) return '';
        
        // First process the words
        let processed = str
            .replace(/\band\b/gi, '&')
            .replace(/\bto\b/gi, '→')
            .replace(/\bwith\b/gi, 'w/');
        
        // Then crop if needed
        if (processed.length > maxLength) {
            processed = processed.substring(0, maxLength) + '...';
        }
        
        return processed;
    }


