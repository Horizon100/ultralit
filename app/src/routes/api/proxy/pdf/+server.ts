// src/routes/api/proxy/pdf/+server.ts - Proxy endpoint to fix CORS issues
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { pdfUrl, attachmentId } = await request.json();

		if (!pdfUrl) {
			return json({ error: 'PDF URL is required' }, { status: 400 });
		}

		console.log('🔄 Proxying PDF fetch:', { attachmentId, pdfUrl });

		// Fetch the PDF file from PocketBase
		const response = await fetch(pdfUrl, {
			headers: {
				'User-Agent': 'SvelteKit-PDF-Proxy/1.0'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
		}

		const pdfBuffer = await response.arrayBuffer();

		// Return the PDF as a blob
		return new Response(pdfBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Length': pdfBuffer.byteLength.toString(),
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type'
			}
		});
	} catch (error) {
		console.error('PDF proxy error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to proxy PDF'
			},
			{ status: 500 }
		);
	}
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};
