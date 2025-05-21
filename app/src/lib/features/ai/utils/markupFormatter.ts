// MarkupFormatter.ts - Utility for handling markup formatting and text operations
import { extractPlainTextFromHtml } from "$lib/features/ai/utils/markdownProcessor";

export class MarkupFormatter {
  /**
   * Removes HTML tags from a string to create clean plain text
   * @param html - The HTML string to convert to plain text
   * @returns A clean text version with no HTML markup
   */
  static stripHtml(html: string): string {
    return extractPlainTextFromHtml(html);
  }
  
  /**
   * Copies the given text to clipboard with HTML markup removed
   * @param text - HTML string to copy as plain text
   * @returns Promise resolving to true if successfully copied
   */
  static async copyAsPlainText(text: string): Promise<boolean> {
    try {
      const plainText = this.stripHtml(text);
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error);
      return false;
    }
  }
}