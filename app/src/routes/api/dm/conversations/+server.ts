import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { DMMessage, DMConversation, User } from '$lib/types/types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all messages where current user is sender or receiver
		const messages = await pb.collection('dm_messages').getFullList<DMMessage>({
			filter: `senderId = "${locals.user.id}" || receiverId = "${locals.user.id}"`,
			sort: '-created',
			expand: 'senderId,receiverId'
		});

		// Group messages by conversation partner
		const conversationMap = new Map<string, {
			partnerId: string;
			partnerUser: User;
			messages: DMMessage[];
			lastMessage: DMMessage;
			unreadCount: number;
		}>();

		for (const message of messages) {
			// Determine the conversation partner
			const partnerId = message.senderId === locals.user.id ? message.receiverId : message.senderId;
			const partnerUser = message.senderId === locals.user.id 
				? (message.expand?.receiverId as User)
				: (message.expand?.senderId as User);

			if (!conversationMap.has(partnerId)) {
				conversationMap.set(partnerId, {
					partnerId,
					partnerUser,
					messages: [],
					lastMessage: message,
					unreadCount: 0
				});
			}

			const conversation = conversationMap.get(partnerId)!;
			conversation.messages.push(message);

			// Update last message if this one is newer
			if (new Date(message.created) > new Date(conversation.lastMessage.created)) {
				conversation.lastMessage = message;
			}

			// Count unread messages (messages sent by partner)
			if (message.senderId === partnerId) {
				conversation.unreadCount++;
			}
		}

		// Convert to DMConversation format
		const conversations: DMConversation[] = Array.from(conversationMap.values()).map(conv => ({
			id: `${locals.user.id}-${conv.partnerId}`,
			content: conv.messages.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()),
			user: {
				id: conv.partnerUser.id,
				name: conv.partnerUser.name || conv.partnerUser.username,
				avatar: conv.partnerUser.avatarUrl || conv.partnerUser.avatar,
				status: conv.partnerUser.status
			},
			lastMessage: {
				content: conv.lastMessage.content,
				timestamp: new Date(conv.lastMessage.created),
				senderId: conv.lastMessage.senderId
			},
			unreadCount: conv.unreadCount,
			isActive: false
		}));

		// Sort by last message timestamp
		conversations.sort((a, b) => 
			new Date(b.lastMessage!.timestamp).getTime() - new Date(a.lastMessage!.timestamp).getTime()
		);

		return json({ conversations });

	} catch (error) {
		console.error('Error fetching DM conversations:', error);
		return json({ error: 'Failed to fetch conversations' }, { status: 500 });
	}
};