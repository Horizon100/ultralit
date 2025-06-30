// src/routes/api/users/public/batch/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch } from '$lib/utils/errorUtils';
import type {
	User,
	PublicUserProfile,
	CacheData,
	BatchRequestBody,
	BatchResponse
} from '$lib/types/types';

// Module-level constants are fine
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per user
const CACHE_TTL = 60 * 1000; // 1 minute cache

// Module-level Maps are fine (they're declarations, not executable code)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const requestCache = new Map<string, CacheData<BatchResponse>>();

// Helper function to convert User to PublicUserProfile
function toPublicUserProfile(user: User): PublicUserProfile {
	return {
		id: user.id,
		username: user.username,
		name: user.name || '',
		email: user.email,
		avatar: user.avatar,
		avatarUrl: user.avatar
			? `${pb.baseUrl}/api/files/${user.collectionId}/${user.id}/${user.avatar}`
			: null,
		verified: user.verified,
		description: user.description,
		role: user.role,
		last_login: user.last_login,
		perks: user.activated_features || [],
		taskAssignments: user.taskAssignments || [],
		followers: user.followers || [],
		following: user.following || [],
		userTaskStatus: user.userTaskStatus || {
			backlog: 0,
			todo: 0,
			focus: 0,
			inprogress: 0,
			done: 0,
			hold: 0,
			postpone: 0,
			cancel: 0,
			review: 0,
			delegate: 0,
			archive: 0
		},
		userProjects: user.projects || [],
		hero: user.hero || '',
		location: user.location || '',
		website: user.website || '',
		created: user.created
	};
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) =>
	apiTryCatch(async () => {
		const startTime = Date.now();
		const requestId = Math.random().toString(36).substr(2, 9);

		// Helper functions inside handler, throwing errors on failure
		function checkRateLimit(identifier: string): void {
			const now = Date.now();
			const userLimit = rateLimits.get(identifier);

			if (!userLimit || now > userLimit.resetTime) {
				rateLimits.set(identifier, {
					count: 1,
					resetTime: now + RATE_LIMIT_WINDOW
				});
				return;
			}

			if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
				throw new Error('Rate limit exceeded');
			}

			userLimit.count++;
		}

		function getCachedResult(cacheKey: string): BatchResponse | null {
			const cached = requestCache.get(cacheKey);
			if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
				return cached.data;
			}
			if (cached) {
				requestCache.delete(cacheKey);
			}
			return null;
		}

		function setCachedResult(cacheKey: string, data: BatchResponse): void {
			requestCache.set(cacheKey, {
				data,
				timestamp: Date.now()
			});
		}

		// Determine the identifier for rate limiting: user ID or IP or anonymous
		const identifier = locals.user?.id || getClientAddress?.() || 'anonymous';

		console.log(`[${requestId}] Batch user request from: ${identifier}`);

		// Check rate limit, will throw if exceeded
		checkRateLimit(identifier);

		// Parse request JSON body
		let requestData: BatchRequestBody;
		try {
			requestData = (await request.json()) as BatchRequestBody;
		} catch {
			throw new Error('Invalid JSON');
		}

		const { userIds } = requestData;

		if (!Array.isArray(userIds)) {
			throw new Error('userIds must be an array');
		}

		if (userIds.length === 0) {
			return {
				success: true,
				users: [],
				meta: { requested: 0, found: 0, cached: false }
			};
		}

		// Clean, deduplicate, and limit userIds
		const MAX_BATCH_SIZE = 20;
		const cleanUserIds = [...new Set(userIds)]
			.filter((id) => id && typeof id === 'string' && id.trim().length > 0)
			.slice(0, MAX_BATCH_SIZE);

		if (cleanUserIds.length === 0) {
			return {
				success: true,
				users: [],
				meta: { requested: userIds.length, found: 0, cached: false }
			};
		}

		// Check cache first
		const cacheKey = `batch_${cleanUserIds.sort().join(',')}`;
		const cachedResult = getCachedResult(cacheKey);
		if (cachedResult) {
			console.log(`[${requestId}] Returning cached result for ${cleanUserIds.length} users`);
			return {
				...cachedResult,
				meta: {
					...cachedResult.meta,
					cached: true,
					requestId,
					responseTime: Date.now() - startTime
				}
			};
		}

		// Construct PocketBase filter query
		const filter = cleanUserIds.map((id) => `id = "${id}"`).join(' || ');

		console.log(`[${requestId}] Querying database with filter: ${filter}`);

		// Retry logic for PocketBase requests
		let users: User[] | undefined;
		const maxRetries = 2;
		for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
			const result = await pbTryCatch(
				pb.collection('users').getList(1, MAX_BATCH_SIZE, {
					filter,
					fields:
						'id,username,name,email,avatar,verified,description,role,status,last_login,followers,following,created,activated_features,taskAssignments,projects,hero,userTaskStatus,location,website,collectionId',
					requestKey: null
				}),
				'fetch users'
			);

			if (result.success) {
				// Convert RecordModel[] to User[]
				users = result.data.items as User[];
				break;
			}

			if (result.error.includes('rate limit') || result.error.includes('429')) {
				if (retryCount < maxRetries) {
					const delay = 1000 * (retryCount + 1);
					console.log(
						`[${requestId}] Rate limited, retrying after ${delay}ms (attempt ${retryCount + 1})`
					);
					await new Promise((res) => setTimeout(res, delay));
					continue;
				} else {
					throw new Error('Database temporarily unavailable due to rate limiting');
				}
			} else {
				throw new Error(result.error);
			}
		}

		if (!users) {
			throw new Error('Failed to fetch users after retries');
		}

		// Convert to PublicUserProfile and order results according to requested IDs
		const orderedResults: (PublicUserProfile | null)[] = cleanUserIds.map((requestedId) => {
			const user = users?.find((u) => u.id === requestedId);
			return user ? toPublicUserProfile(user) : null;
		});

		// Build response
		const response: BatchResponse = {
			success: true,
			users: orderedResults,
			meta: {
				requested: cleanUserIds.length,
				found: users.length,
				cached: false,
				requestId,
				responseTime: Date.now() - startTime
			}
		};

		// Cache response
		setCachedResult(cacheKey, response);

		console.log(
			`[${requestId}] Successfully returned ${users.length}/${cleanUserIds.length} users`
		);

		return response;
	}, 'Failed to process batch user request');

export const GET: RequestHandler = async () => {
	return json({
		success: true,
		service: 'User batch API',
		timestamp: new Date().toISOString(),
		rateLimit: {
			window: RATE_LIMIT_WINDOW,
			maxRequests: RATE_LIMIT_MAX_REQUESTS
		},
		cache: {
			ttl: CACHE_TTL,
			currentSize: requestCache.size
		}
	});
};
