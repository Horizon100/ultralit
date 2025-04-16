import { writable } from 'svelte/store';
import {  } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';

export const currentUser = writable<User | null>(pb.authStore.model as User | null);

pb.authStore.onChange((auth) => {
  currentUser.set(pb.authStore.model as User | null);
});