import { writable } from 'svelte/store';
import { threadListVisibility } from '$lib/clients/threadsClient';

// Focus state management
export const isTextareaFocused = writable(false);

// Configuration constants
export const defaultTextareaHeight = '60px';
export const maxFontSize = 30;
export const minFontSize = 20;
export const maxLength = 50;

// Timeout reference
let hideTimeout: any;

// Cache for performance
let lastContentLength = -1;
let lastCalculatedFontSize = maxFontSize;

// Store reference for closing expanded sections
let uiStoreRef: any = null;

// Function to set UI store reference (call this from your component)
export function setUIStoreReference(uiStore: any) {
    uiStoreRef = uiStore;
}

export function handleTextareaFocus() {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = 0;
    }
    isTextareaFocused.set(true);
    threadListVisibility.set(false);
}

export function handleTextareaBlur() {
    hideTimeout = setTimeout(() => {
        isTextareaFocused.set(false);
    }, 500);
}

export function handleImmediateTextareaBlur() {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = 0;
    }
    isTextareaFocused.set(false);
}

// New function to handle clicking outside with section closing
export function handleClickOutsideWithSections(
    event: MouseEvent, 
    textareaElement: HTMLTextAreaElement | null,
    localIsFocused: boolean,
    uiStore: any
): boolean {
    const target = event.target as Element;
    const inputContainer = textareaElement?.closest('.input-container');
    
    // Check if click is outside the input container
    const isOutsideInput = inputContainer && !inputContainer.contains(target);
    
    // Check if click is outside expanded sections
    const isOutsideExpandedContent = !target.closest('.section-content') && 
                                   !target.closest('.section-content-sysprompts') &&
                                   !target.closest('.section-content-bookmark');
    
    // Check if click is not on section control buttons
    const isNotSectionButton = !target.closest('button[class*="btn model"]') &&
                              !target.closest('.btn-row') &&
                              !target.closest('.ai-selector');
    
    if (isOutsideInput && isOutsideExpandedContent && isNotSectionButton) {
        // Close expanded sections
        uiStore.closeAllSections();
        
        // Return true if textarea should also lose focus
        return localIsFocused;
    }
    
    return false;
}

// Optimized with caching and reduced DOM manipulation
export function adjustFontSize(element: HTMLTextAreaElement | null) {
    if (!element) return;

    const contentLength = element.value.length;
    
    // Skip if content length hasn't changed
    if (contentLength === lastContentLength) return;
    
    let fontSize: number;
    if (contentLength <= maxLength) {
        fontSize = maxFontSize;
    } else {
        fontSize = Math.max(minFontSize, maxFontSize - (contentLength - maxLength) / 2);
    }
    
    // Only update DOM if fontSize actually changed
    if (fontSize !== lastCalculatedFontSize) {
        element.style.fontSize = `${fontSize}px`;
        lastCalculatedFontSize = fontSize;
    }
    
    lastContentLength = contentLength;
}

// Optimized with single reflow
export function resetTextareaHeight(element: HTMLTextAreaElement | null) {
    if (!element) return;

    // Batch DOM operations to avoid multiple reflows
    element.style.height = 'auto';
    // Force single reflow
    void element.offsetHeight;
    element.style.height = defaultTextareaHeight;
}

// Optimized with single measurement
export function adjustTextareaHeight(element: HTMLTextAreaElement | null) {
    if (!element) return;

    // Single DOM operation
    const currentHeight = element.style.height;
    element.style.height = 'auto';
    const newHeight = `${element.scrollHeight}px`;
    
    // Only update if height actually changed
    if (newHeight !== currentHeight) {
        element.style.height = newHeight;
    }
}