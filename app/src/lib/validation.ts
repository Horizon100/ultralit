import { z } from 'zod';

// Enhanced user schema with better validation
export const userSchema = z.object({
	email: z.string().email().max(254).toLowerCase(),
	password: z
		.string()
		.min(8)
		.max(128)
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
			'Password must contain at least one uppercase letter, lowercase letter, and number'
		),
	username: z
		.string()
		.min(3)
		.max(30)
		.regex(/^[a-zA-Z0-9_-]+$/)
		.optional(),
	name: z.string().min(1).max(100).optional()
});

// Post validation
export const postSchema = z.object({
	title: z.string().min(1).max(200).trim(),
	content: z.string().min(1).max(10000).trim(),
	tags: z.array(z.string().max(50)).max(10).optional(),
	isPublic: z.boolean().default(true)
});

// Comment validation
export const commentSchema = z.object({
	content: z.string().min(1).max(2000).trim(),
	parentId: z.string().uuid()
});

// File upload validation
export const fileUploadSchema = z.object({
	file: z.instanceof(File),
	description: z.string().max(500).optional()
});

// Sanitization function
export function sanitizeInput(input: string): string {
	return input
		.replace(/[<>'"]/g, '') // Remove potentially dangerous characters
		.trim()
		.substring(0, 5000); // Limit length
}

// Rate limiting tracking (in-memory for development)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
	ip: string,
	endpoint: string,
	maxRequests = 10,
	windowMs = 60000
): boolean {
	const key = `${ip}:${endpoint}`;
	const now = Date.now();

	const current = rateLimitMap.get(key);

	if (!current || now > current.resetTime) {
		rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
		return true;
	}

	if (current.count >= maxRequests) {
		return false;
	}

	current.count++;
	return true;
}
