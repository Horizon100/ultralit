// src/lib/utils/errorUtils.ts

import { json } from '@sveltejs/kit';

interface RequestInit {
	method?: string;
	headers?: Record<string, string> | Headers;
	body?: string | FormData | URLSearchParams | ReadableStream | null;
	credentials?: 'omit' | 'same-origin' | 'include';
	signal?: AbortSignal;
}
// Types for the result object with discriminated union
export type Success<T> = { data: T; error: null; success: true };
export type Failure<E> = { data: null; error: E; success: false };
export type Result<T, E = Error> = Success<T> | Failure<E>;

// Main wrapper function for async operations
export async function tryCatch<T, E = Error>(
	promise: Promise<T>
): Promise<Result<T, E>> {
	try {
		const data = await promise;
		return { data, error: null, success: true };
	} catch (error) {
		return { data: null, error: error as E, success: false };
	}
}

// Synchronous version for regular functions
export function tryCatchSync<T, E = Error>(callback: () => T): Result<T, E> {
	try {
		const data = callback();
		return { data, error: null, success: true };
	} catch (error) {
		return { data: null, error: error as E, success: false };
	}
}

// API-specific error handler that returns JSON responses
export async function apiTryCatch<T>(
	promiseOrFn: Promise<T> | (() => Promise<T>),
	errorMessage: string = 'An error occurred',
	errorStatus: number = 500
): Promise<Response> {
	try {
		const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
		const data = await promise;
		return json({
			success: true,
			data
		});
	} catch (error) {
		console.error(`API Error: ${errorMessage}`, error);
		
		// Handle different error types
		let status = errorStatus;
		let message = errorMessage;
		
		if (error instanceof Error) {
			// Check for common PocketBase errors
			if (error.message.includes('not found') || error.message.includes('404')) {
				status = 404;
				message = 'Resource not found';
			} else if (error.message.includes('unauthorized') || error.message.includes('401')) {
				status = 401;
				message = 'Unauthorized';
			} else if (error.message.includes('forbidden') || error.message.includes('403')) {
				status = 403;
				message = 'Forbidden';
			}
		}
		
		return json(
			{
				success: false,
				error: message
			},
			{ status }
		);
	}
}

// Specialized handler for user-related operations
export async function userApiTryCatch<T>(
	promiseOrFn: Promise<T> | (() => Promise<T>),
	operation: string = 'user operation'
): Promise<Response> {
	return apiTryCatch(
		promiseOrFn,
		`Failed to perform ${operation}`,
		404
	);
}

// Client-side error handler with optional logging
export async function clientTryCatch<T>(
	promise: Promise<T>,
	logMessage?: string
): Promise<Result<T, string>> {
	try {
		const data = await promise;
		return { data, error: null, success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		
		if (logMessage) {
			console.error(`${logMessage}:`, error);
		}
		
		return { data: null, error: errorMessage, success: false };
	}
}

// Storage operation wrapper (localStorage, etc.)
export function storageTryCatch<T>(
	operation: () => T,
	fallback: T,
	logMessage?: string
): T {
	try {
		return operation();
	} catch (error) {
		if (logMessage) {
			console.error(`${logMessage}:`, error);
		}
		return fallback;
	}
}

// Network/fetch operation wrapper
export async function fetchTryCatch<T>(
	url: string,
	options?: RequestInit,
	timeout: number = 10000
): Promise<Result<T, string>> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const contentType = response.headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			throw new Error(`Unexpected content type: ${contentType}`);
		}
		
		const data = await response.json();
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'Network request failed';
		
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				errorMessage = 'Request timed out';
			} else {
				errorMessage = error.message;
			}
		}
		
		return { data: null, error: errorMessage, success: false };
	}
}

// PocketBase specific error handler
export async function pbTryCatch<T>(
	promise: Promise<T>,
	operation: string = 'database operation'
): Promise<Result<T, string>> {
	try {
		const data = await promise;
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = `Failed to perform ${operation}`;
		
		if (error instanceof Error) {
			// Handle specific PocketBase errors
			if (error.message.includes('not found')) {
				errorMessage = 'Record not found';
			} else if (error.message.includes('unauthorized')) {
				errorMessage = 'Authentication required';
			} else if (error.message.includes('forbidden')) {
				errorMessage = 'Access denied';
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`PocketBase Error (${operation}):`, error);
		return { data: null, error: errorMessage, success: false };
	}
}

// Utility to check if result is success
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
	return result.success;
}

// Utility to check if result is failure
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
	return !result.success;
}

// Unwrap result or throw error
export function unwrap<T, E>(result: Result<T, E>): T {
	if (isSuccess(result)) {
		return result.data;
	}
	throw new Error(result.error instanceof Error ? result.error.message : String(result.error));
}

// Unwrap result or return default value
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
	return isSuccess(result) ? result.data : defaultValue;
}

// Validation error handler (for Zod, Joi, custom validation)
export function validationTryCatch<T>(
	validationFn: () => T,
	fieldName?: string
): Result<T, string> {
	try {
		const data = validationFn();
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'Validation failed';
		
		if (error instanceof Error) {
			// Handle Zod errors
			if (error.name === 'ZodError') {
				const zodError = error as { issues?: { path?: string[]; message: string }[] };
				const firstIssue = zodError.issues?.[0];
				if (firstIssue) {
					errorMessage = `${firstIssue.path?.join('.') || fieldName || 'Field'}: ${firstIssue.message}`;
				}
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`Validation Error${fieldName ? ` (${fieldName})` : ''}:`, error);
		return { data: null, error: errorMessage, success: false };
	}
}

// File upload/processing error handler
export async function fileTryCatch<T>(
	fileOperation: Promise<T>,
	filename?: string,
	maxSizeMB?: number
): Promise<Result<T, string>> {
	try {
		const data = await fileOperation;
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'File operation failed';
		
		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			if (msg.includes('size') || msg.includes('large')) {
				errorMessage = `File too large${maxSizeMB ? ` (max ${maxSizeMB}MB)` : ''}`;
			} else if (msg.includes('type') || msg.includes('format')) {
				errorMessage = 'Unsupported file type';
			} else if (msg.includes('upload')) {
				errorMessage = 'Upload failed - please try again';
			} else if (msg.includes('corrupt') || msg.includes('invalid')) {
				errorMessage = 'File appears to be corrupted';
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`File Error${filename ? ` (${filename})` : ''}:`, error);
		return { data: null, error: errorMessage, success: false };
	}
}

// WebSocket connection error handler
export function websocketTryCatch<T>(
	wsOperation: () => T,
	connectionName?: string
): Result<T, string> {
	try {
		const data = wsOperation();
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'WebSocket operation failed';
		
		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			if (msg.includes('connection') || msg.includes('connect')) {
				errorMessage = 'Connection failed - check your internet';
			} else if (msg.includes('timeout')) {
				errorMessage = 'Connection timed out';
			} else if (msg.includes('close') || msg.includes('disconnect')) {
				errorMessage = 'Connection was closed';
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`WebSocket Error${connectionName ? ` (${connectionName})` : ''}:`, error);
		return { data: null, error: errorMessage, success: false };
	}
}

// Database constraint violation handler
export async function dbConstraintTryCatch<T>(
	dbOperation: Promise<T>,
	entityName?: string
): Promise<Result<T, string>> {
	try {
		const data = await dbOperation;
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'Database operation failed';
		
		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			if (msg.includes('unique') || msg.includes('duplicate')) {
				errorMessage = `${entityName || 'Record'} already exists`;
			} else if (msg.includes('foreign key') || msg.includes('reference')) {
				errorMessage = 'Related record not found';
			} else if (msg.includes('not null') || msg.includes('required')) {
				errorMessage = 'Required field is missing';
			} else if (msg.includes('check constraint')) {
				errorMessage = 'Invalid data format';
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`Database Constraint Error${entityName ? ` (${entityName})` : ''}:`, error);
		return { data: null, error: errorMessage, success: false };
	}
}

// Rate limiting error handler
export async function rateLimitTryCatch<T>(
	apiCall: Promise<T>,
	retryAfterSeconds?: number
): Promise<Result<T, string>> {
	try {
		const data = await apiCall;
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'Request failed';
		
		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
				errorMessage = `Rate limit exceeded${retryAfterSeconds ? ` - try again in ${retryAfterSeconds}s` : ' - please slow down'}`;
			} else if (msg.includes('quota') || msg.includes('limit exceeded')) {
				errorMessage = 'Usage quota exceeded';
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error('Rate Limit Error:', error);
		return { data: null, error: errorMessage, success: false };
	}
}

// Payment/billing error handler
export async function paymentTryCatch<T>(
	paymentOperation: Promise<T>,
	amount?: number,
	currency?: string
): Promise<Result<T, string>> {
	try {
		const data = await paymentOperation;
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = 'Payment failed';
		
		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			if (msg.includes('insufficient') || msg.includes('declined')) {
				errorMessage = 'Payment declined - check your payment method';
			} else if (msg.includes('expired') || msg.includes('invalid card')) {
				errorMessage = 'Invalid or expired payment method';
			} else if (msg.includes('fraud') || msg.includes('security')) {
				errorMessage = 'Payment blocked for security reasons';
			} else if (msg.includes('limit') || msg.includes('exceed')) {
				errorMessage = 'Payment limit exceeded';
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`Payment Error${amount ? ` (${amount} ${currency || ''})` : ''}:`, error);
		return { data: null, error: errorMessage, success: false };
	}
}

// Third-party API error handler (OpenAI, etc.)
export async function thirdPartyApiTryCatch<T>(
	apiCall: Promise<T>,
	serviceName: string,
	endpoint?: string
): Promise<Result<T, string>> {
	try {
		const data = await apiCall;
		return { data, error: null, success: true };
	} catch (error) {
		let errorMessage = `${serviceName} service error`;
		
		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
				errorMessage = `${serviceName} API key invalid`;
			} else if (msg.includes('quota') || msg.includes('limit')) {
				errorMessage = `${serviceName} usage limit reached`;
			} else if (msg.includes('timeout') || msg.includes('network')) {
				errorMessage = `${serviceName} service unavailable`;
			} else if (msg.includes('model') || msg.includes('not found')) {
				errorMessage = `${serviceName} model not available`;
			} else if (msg.includes('content') || msg.includes('policy')) {
				errorMessage = `Content violates ${serviceName} policy`;
			} else {
				errorMessage = error.message;
			}
		}
		
		console.error(`${serviceName} API Error${endpoint ? ` (${endpoint})` : ''}:`, error);
		return { data: null, error: errorMessage, success: false };
	}
}