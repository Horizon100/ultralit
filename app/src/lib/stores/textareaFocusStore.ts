import { writable } from 'svelte/store';

export const isTextareaFocused = writable(false);

let hideTimeout: ReturnType<typeof setTimeout>;

export function handleTextareaFocus() {
  clearTimeout(hideTimeout);
  isTextareaFocused.set(true);
}

export function handleTextareaBlur(options: { 
  getRandomQuestions?: () => string,
  getRandomQuote?: () => string,
  t?: any
} = {}) {
  hideTimeout = setTimeout(() => {
    isTextareaFocused.set(false);
  }, 500);
}

export function handleImmediateTextareaBlur() {
  clearTimeout(hideTimeout);
  isTextareaFocused.set(false);
}