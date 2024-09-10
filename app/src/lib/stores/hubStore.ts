// hubStore.ts

import { writable } from 'svelte/store';
import type { InternalChatMessage, Role, Agent } from '$lib/types';

interface HubState {
  chatMessages: InternalChatMessage[];
  isLoading: boolean;
  currentStage: string;
  roles: Role[];
  agents: Agent[];
}

export const hubStore = writable<HubState>({
  chatMessages: [],
  isLoading: false,
  currentStage: 'initial',
  roles: [],
  agents: [],
});