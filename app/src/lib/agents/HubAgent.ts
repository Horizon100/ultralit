// HubAgent.ts

import type { AIModel, Role, Agent, ChatMessage, InternalChatMessage } from '$lib/types';
import { createAgent, updateAIAgent } from '$lib/pocketbase';
import { fetchAIResponse, generateRoles } from './hubClient';

export class HubAgent {
  private roles: Role[] = [];
  private selectedRole: Role | null = null;
  private agents: Agent[] = [];
  private chatMessages: InternalChatMessage[] = [];
  private isLoading: boolean = false;
  private currentStage: 'initial' | 'role_suggestion' | 'role_selection' | 'CODER' | 'chat' = 'initial';

  constructor(private aiModel: AIModel, private userId: string) {}

  async init(seedPrompt: string) {
    this.addMessage('user', seedPrompt);
    await this.generateRoles(seedPrompt);
  }

  private addMessage(role: 'user' | 'assistant' | 'thinking' | 'options', content: string): InternalChatMessage {
    // Implementation of addMessage (keep your existing logic)
  }

  async generateRoles(input: string): Promise<Role[]> {
    this.isLoading = true;
    this.addMessage('thinking', 'Generating roles...');
    try {
      this.roles = await generateRoles(input, this.aiModel, this.userId);
      this.currentStage = 'role_suggestion';
      this.addMessage('options', JSON.stringify(this.roles));
      return this.roles;
    } catch (error) {
      console.error('Error generating roles:', error);
      this.addMessage('assistant', 'Error generating roles. Please try again.');
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  async selectRole(role: Role): Promise<void> {
    this.selectedRole = role;
    this.currentStage = 'CODER';
    await this.createAgents(role);
  }

  async createAgents(role: Role): Promise<void> {
    this.isLoading = true;
    this.addMessage('thinking', 'Creating agents...');
    try {
      const newAgents = await Promise.all(
        Array(4).fill(null).map(() => createAgent(role, this.aiModel, this.userId))
      );
      this.agents = newAgents;
      this.currentStage = 'chat';
      this.addMessage('assistant', 'Agents created successfully. You can now start chatting.');
    } catch (error) {
      console.error('Error creating agents:', error);
      this.addMessage('assistant', 'Error creating agents. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async processUserInput(input: string): Promise<string> {
    this.addMessage('user', input);
    this.isLoading = true;
    try {
      const response = await fetchAIResponse(this.chatMessages, this.aiModel, this.userId);
      this.addMessage('assistant', response);
      return response;
    } catch (error) {
      console.error('Error processing user input:', error);
      this.addMessage('assistant', 'Error processing your request. Please try again.');
      return 'Error processing your request. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  getChatMessages(): InternalChatMessage[] {
    return this.chatMessages;
  }

  getCurrentStage(): string {
    return this.currentStage;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getRoles(): Role[] {
    return this.roles;
  }

  getAgents(): Agent[] {
    return this.agents;
  }
}