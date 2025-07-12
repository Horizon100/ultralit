// src/lib/features/email/utils/clientEmailUtils.ts

import type { EmailAddress } from '$lib/types/types.email';

export class ClientEmailUtils {
	/**
	 * Validate email address
	 */
	static isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	/**
	 * Format file size
	 */
	static formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	/**
	 * Parse single email address
	 */
	static parseEmailAddress(addressString: string): EmailAddress {
		const match = addressString.match(/^(.+)\s+<(.+)>$|^(.+)$/);
		if (match) {
			if (match[2]) {
				return { name: match[1].trim(), email: match[2].trim() };
			} else {
				return { email: match[3].trim() };
			}
		}
		return { email: addressString };
	}

	/**
	 * Parse multiple email addresses
	 */
	static parseEmailAddresses(addressString: string): EmailAddress[] {
		if (!addressString) return [];

		return addressString.split(',').map((addr) => this.parseEmailAddress(addr.trim()));
	}

	/**
	 * Format date for display
	 */
	static formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Truncate text
	 */
	static truncateText(text: string, length: number): string {
		return text.length > length ? text.substring(0, length) + '...' : text;
	}

	/**
	 * Get file extension from mime type
	 */
	static getFileExtension(mimeType: string): string {
		const mimeMap: { [key: string]: string } = {
			'application/pdf': 'pdf',
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/gif': 'gif',
			'text/plain': 'txt',
			'application/zip': 'zip',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
		};
		return mimeMap[mimeType] || 'bin';
	}
}
