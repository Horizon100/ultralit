// src/routes/api/pdf/test/+server.ts - Test endpoint to verify PDF tools
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';

export const GET: RequestHandler = async () => {
	const results = {
		pdfinfo: false,
		pdftotext: false,
		gs: false,
		system: process.platform,
		timestamp: new Date().toISOString()
	};

	// Test pdfinfo
	try {
		await testCommand('pdfinfo', ['-v']);
		results.pdfinfo = true;
	} catch (error) {
		console.log('pdfinfo not available:', error);
	}

	// Test pdftotext
	try {
		await testCommand('pdftotext', ['-v']);
		results.pdftotext = true;
	} catch (error) {
		console.log('pdftotext not available:', error);
	}

	// Test ghostscript
	try {
		await testCommand('gs', ['--version']);
		results.gs = true;
	} catch (error) {
		console.log('ghostscript not available:', error);
	}

	return json(results);
};

function testCommand(command: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const process = spawn(command, args);

		process.on('close', (code) => {
			if (code === 0 || code === 1) {
				// Some tools return 1 for version info
				resolve();
			} else {
				reject(new Error(`Command failed with code ${code}`));
			}
		});

		process.on('error', (error) => {
			reject(error);
		});
	});
}
