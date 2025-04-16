// src/lib/stores/agents.ts
import { writable } from 'svelte/store';
import { get } from 'svelte/store';
// import { currentUser } from './authStore';

async function fetchAgents() {
  const user = get(currentUser);
  if (!user) return [];
  
  const res = await fetch('/api/agents');
  return await res.json();
}

export const agents = writable([]);

export async function refreshAgents() {
  agents.set(await fetchAgents());
}