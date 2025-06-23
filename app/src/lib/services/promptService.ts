import { get } from 'svelte/store';
import { t } from '$lib/stores/translationStore';
import { currentUser } from '$lib/pocketbase';
import { clientTryCatch, fetchTryCatch, isFailure, isSuccess } from '$lib/utils/errorUtils';

// Define proper types
interface PromptData {
  id: string;
  name?: string;
  description?: string;
  content?: string;
  prompt?: string;
  category?: string;
  type?: string;
  data?: {
    prompt?: string;
  };
}

interface PromptStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  lines: number;
  estimatedTokens: number;
}

interface PromptValidation {
  isValid: boolean;
  errors: string[];
}

export class PromptService {
  static async fetchPromptFromAPI(promptId: string | null): Promise<PromptData | null> {
    if (!promptId) return null;

    const result = await clientTryCatch((async () => {
      const fetchResult = await fetchTryCatch<PromptData>(
        `/api/prompts/${promptId}`,
        {
          method: 'GET'
        }
      );

      if (isFailure(fetchResult)) {
        throw new Error(`Failed to fetch prompt: ${fetchResult.error}`);
      }

      return fetchResult.data;
    })(), `Fetching prompt ${promptId}`);

    if (isFailure(result)) {
      console.error('Error fetching prompt from API:', result.error);
      return null;
    }

    return result.data;
  }

  static async loadUserPrompt(): Promise<PromptData | null> {
    const result = await clientTryCatch((async () => {
      const user = get(currentUser);
      if (!user?.prompt_preference) return null;

      let promptId: string | null = null;
      if (Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
        promptId = user.prompt_preference[0];
      } else if (typeof user.prompt_preference === 'string') {
        promptId = user.prompt_preference;
      }

      if (promptId) {
        return await this.fetchPromptFromAPI(promptId);
      }

      return null;
    })(), 'Loading user prompt');

    if (isFailure(result)) {
      console.error('Error loading user prompt:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Gets random start prompts for suggestions
   */
  static getRandomPrompts(count: number = 3): string[] {
    const $t = get(t);
    const prompts = $t('startPrompts');

    if (Array.isArray(prompts)) {
      const shuffled = [...prompts].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }

    return [];
  }

  /**
   * Refreshes prompt suggestions with new random prompts
   */
  static refreshPromptSuggestions(count: number = 3): string[] {
    return this.getRandomPrompts(count);
  }

  /**
   * Gets a random greeting
   */
  static getRandomGreeting(): string {
    const $t = get(t);
    const greetings = $t('extras.greetings');

    if (Array.isArray(greetings) && greetings.every((item) => typeof item === 'string')) {
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    return 'Hello';
  }

  /**
   * Gets a random question
   */
  static getRandomQuestion(): string {
    const $t = get(t);
    const questions = $t('extras.questions');

    if (Array.isArray(questions) && questions.every((item) => typeof item === 'string')) {
      return questions[Math.floor(Math.random() * questions.length)];
    }

    return "What's on your mind?";
  }

  /**
   * Gets a random quote
   */
  static getRandomQuote(): string {
    const $t = get(t);
    const quotes = $t('extras.quotes');

    if (Array.isArray(quotes) && quotes.every((item) => typeof item === 'string')) {
      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    return 'The question of whether a computer can think is no more interesting than the question of whether a submarine can swim. - Edsger W. Dijkstra';
  }

  /**
   * Gets current prompt input for a user's preferred prompt
   */
  static async getUserPromptInput(): Promise<string | null> {
    const result = await clientTryCatch((async () => {
      const user = get(currentUser);
      if (!user?.prompt_preference) return null;

      let promptId: string | null = null;

      if (Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
        promptId = user.prompt_preference[0];
      } else if (typeof user.prompt_preference === 'string') {
        promptId = user.prompt_preference;
      }

      if (promptId) {
        const fetchResult = await fetchTryCatch<PromptData>(
          `/api/prompts/${promptId}`,
          {
            method: 'GET'
          }
        );

        if (isFailure(fetchResult)) {
          throw new Error(`Failed to fetch user prompt input: ${fetchResult.error}`);
        }

        const promptData = fetchResult.data;
        return promptData.data?.prompt || promptData.prompt || null;
      }

      return null;
    })(), 'Getting user prompt input');

    if (isFailure(result)) {
      console.error('Error fetching user prompt input:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Validates prompt text
   */
  static validatePrompt(prompt: string): PromptValidation {
    const errors: string[] = [];

    if (!prompt || prompt.trim().length === 0) {
      errors.push('Prompt cannot be empty');
    }

    if (prompt.length > 5000) {
      errors.push('Prompt is too long (maximum 5000 characters)');
    }

    if (prompt.length < 10) {
      errors.push('Prompt is too short (minimum 10 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Formats prompt for display
   */
  static formatPromptForDisplay(prompt: string, maxLength: number = 100): string {
    if (prompt.length <= maxLength) return prompt;
    return prompt.slice(0, maxLength) + '...';
  }

  /**
   * Gets prompt type label
   */
  static getPromptTypeLabel(type: string): string {
    const $t = get(t);
    const typeLabels: Record<string, string> = {
      NORMAL: ($t('prompts.types.normal') as string) || 'Normal',
      CONCISE: ($t('prompts.types.concise') as string) || 'Concise',
      CRITICAL: ($t('prompts.types.critical') as string) || 'Critical',
      INTERVIEW: ($t('prompts.types.interview') as string) || 'Interview',
      CUSTOM: ($t('prompts.types.custom') as string) || 'Custom'
    };

    return typeLabels[type] || type;
  }

  /**
   * Gets system prompt preferences
   */
  static getSystemPromptPreferences(): string[] {
    return ['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'];
  }

  /**
   * Checks if system prompt is built-in
   */
  static isBuiltInSystemPrompt(prompt: string): boolean {
    return this.getSystemPromptPreferences().includes(prompt);
  }

  /**
   * Gets prompt statistics
   */
  static getPromptStats(prompt: string): PromptStats {
    const words = prompt.trim().split(/\s+/).length;
    const characters = prompt.length;
    const charactersNoSpaces = prompt.replace(/\s/g, '').length;
    const lines = prompt.split('\n').length;

    return {
      words,
      characters,
      charactersNoSpaces,
      lines,
      estimatedTokens: Math.ceil(words * 1.3) // Rough estimate
    };
  }

  /**
   * Searches prompts by keyword
   */
  static searchPrompts(prompts: PromptData[], query: string): PromptData[] {
    if (!query.trim()) return prompts;

    const searchQuery = query.toLowerCase();
    return prompts.filter(
      (prompt) =>
        prompt.name?.toLowerCase().includes(searchQuery) ||
        prompt.description?.toLowerCase().includes(searchQuery) ||
        prompt.content?.toLowerCase().includes(searchQuery)
    );
  }

  /**
   * Gets prompt categories
   */
  static getPromptCategories(): string[] {
    const $t = get(t);
    return [
      ($t('prompts.categories.general') as string) || 'General',
      ($t('prompts.categories.creative') as string) || 'Creative',
      ($t('prompts.categories.technical') as string) || 'Technical',
      ($t('prompts.categories.business') as string) || 'Business',
      ($t('prompts.categories.educational') as string) || 'Educational',
      ($t('prompts.categories.personal') as string) || 'Personal'
    ];
  }

  /**
   * Filters prompts by category
   */
  static filterPromptsByCategory(prompts: PromptData[], category: string): PromptData[] {
    if (!category) return prompts;
    return prompts.filter((prompt) => prompt.category === category);
  }
}