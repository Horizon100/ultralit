// Svelte component where you add a new message
import {  } from '$lib/pocketbase'; // assuming pb is set up as your PocketBase instance

async function addMessageToThread(message: Omit<Messages, 'id' | 'created' | 'updated'>) {
	try {
		const createdMessage = await pb.collection('messages').create(message);

		// After creating the message, update the related thread
		const threadId = message.thread;

		await fetch('/api/update-thread-last-message', {
			method: 'PATCH',
			body: JSON.stringify({
				threadId,
				lastMessageId: createdMessage.id
			}),
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error adding message:', error);
	}
}
