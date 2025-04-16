import PocketBase from 'pocketbase';

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);

export async function getAgents() {
  const res = await fetch('/api/agents');
  return await res.json();
}

export async function subscribeToCursorChanges(callback) {
  return pb.realtime.subscribe('cursors', callback);
}