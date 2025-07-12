// src/routes/api/email/messages/[id]/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// GET /api/email/messages/[id] - Get specific message details
export const GET: RequestHandler = async ({ params }) => {
	try {
		const messageId = params.id;

		if (!messageId) {
			return json(
				{
					success: false,
					error: 'Message ID is required'
				},
				{ status: 400 }
			);
		}

		const message = await pb.collection('email_messages').getOne(messageId, {
			expand: 'accountId,aiAnalysis'
		});

		if (!message) {
			return json(
				{
					success: false,
					error: 'Message not found'
				},
				{ status: 404 }
			);
		}

		// Helper function to safely parse JSON
		const safeJsonParse = (jsonString: any, fallback: any = []) => {
			// Handle null, undefined, or non-string values
			if (jsonString === null || jsonString === undefined) {
				return fallback;
			}

			// If it's already parsed (object/array), return it
			if (typeof jsonString === 'object') {
				return jsonString;
			}

			// Convert to string if it's not already
			const str = String(jsonString).trim();

			// Handle empty or invalid strings
			if (!str || str === '' || str === 'null' || str === 'undefined') {
				return fallback;
			}

			try {
				const parsed = JSON.parse(str);
				return parsed;
			} catch (error) {
				console.warn('Failed to parse JSON field:', str, error);
				return fallback;
			}
		};
		// Safely parse JSON fields with fallbacks
		const parsedMessage = {
			...message,
			attachments: safeJsonParse(message.attachments, []),
			to: safeJsonParse(message.to, []),
			cc: safeJsonParse(message.cc, []),
			bcc: safeJsonParse(message.bcc, []),
			replyTo: safeJsonParse(message.replyTo, []),
			labels: safeJsonParse(message.labels, []),
			from: safeJsonParse(message.from, { email: 'unknown' }),
			date: new Date(message.date),
			created: new Date(message.created),
			updated: new Date(message.updated)
		};

		return json({
			success: true,
			data: parsedMessage
		});
	} catch (error) {
		console.error('Failed to fetch message:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch message'
			},
			{ status: 500 }
		);
	}
};

// PATCH /api/email/messages/[id] - Update message
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const messageId = params.id;
		const updates = await request.json();

		if (!messageId) {
			return json(
				{
					success: false,
					error: 'Message ID is required'
				},
				{ status: 400 }
			);
		}

		const updatedMessage = await pb.collection('email_messages').update(messageId, updates);

		return json({
			success: true,
			data: updatedMessage
		});
	} catch (error) {
		console.error('Failed to update message:', error);
		return json(
			{
				success: false,
				error: 'Failed to update message'
			},
			{ status: 500 }
		);
	}
};

// DELETE /api/email/messages/[id] - Delete message
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const messageId = params.id;

		if (!messageId) {
			return json(
				{
					success: false,
					error: 'Message ID is required'
				},
				{ status: 400 }
			);
		}

		await pb.collection('email_messages').delete(messageId);

		return json({
			success: true
		});
	} catch (error) {
		console.error('Failed to delete message:', error);
		return json(
			{
				success: false,
				error: 'Failed to delete message'
			},
			{ status: 500 }
		);
	}
};
