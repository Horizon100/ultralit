import PocketBase from 'pocketbase';
import { writable } from 'svelte/store'

// Update the port to 80, as that's where your PocketBase instance is running
export const pb = new PocketBase('http://172.104.188.44:80');

export const currentUser = writable(pb.authStore.model);

pb.authStore.onChange((auth) => {
    console.log('authStore changed', auth);
    currentUser.set(pb.authStore.model);
});

// Add a connection check function
export async function checkPocketBaseConnection() {
    try {
        const health = await pb.health.check();
        console.log('PocketBase health check:', health);
        return true;
    } catch (error) {
        console.error('PocketBase connection error:', error);
        return false;
    }
}

// Log the base URL for debugging
console.log('PocketBase URL:', pb.baseUrl);