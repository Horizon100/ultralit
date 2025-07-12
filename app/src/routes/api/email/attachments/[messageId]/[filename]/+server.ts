// src/routes/api/email/attachments/[messageId]/[filename]/+server.ts

import { error } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { pb } from '$lib/server/pocketbase';
import type {
	EmailAccount,
	EmailMessage,
	EmailApiResponse,
	EmailAccountSetup
} from '$lib/types/types.email';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { messageId, filename } = params;

		if (!messageId || !filename) {
			throw error(400, 'Message ID and filename are required');
		}

		const filePath = path.join(process.cwd(), 'storage', 'attachments', messageId, filename);

		// Check if file exists
		try {
			await fs.access(filePath);
		} catch {
			throw error(404, 'Attachment not found');
		}

		// Read file
		const fileData = await fs.readFile(filePath);
		const mimeType = mime.lookup(filename) || 'application/octet-stream';

		return new Response(fileData, {
			headers: {
				'Content-Type': mimeType,
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': fileData.length.toString()
			}
		});
	} catch (err) {
		console.error('Failed to serve attachment:', err);
		throw error(500, 'Failed to serve attachment');
	}
};
