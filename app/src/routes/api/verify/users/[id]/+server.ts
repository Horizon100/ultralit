import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    // Define types and function inside GET
    interface PocketBaseUser {
        id: string;
        name?: string;
        username?: string;
        email?: string;
        description?: string;
        role?: string;
        created?: string;
        updated?: string;
        verified?: boolean;
        theme_preference?: string;
        wallpaper_preference?: string;
        model?: string | null;
        selected_provider?: string | null;
        prompt_preference?: string;
        sysprompt_preference?: string;
        model_preference?: string;
        avatar?: string;
        expand?: {
            verification?: {
                status?: string;
                updated?: string;
            };
        };
    }

    function sanitizeUser(user: PocketBaseUser) {
        return {
            id: user.id,
            name: user.name || '',
            username: user.username || '',
            email: user.email || '',
            description: user.description || '',
            role: user.role || '',
            created: user.created || '',
            updated: user.updated || '',
            verified: user.verified || false,
            theme_preference: user.theme_preference || '',
            wallpaper_preference: user.wallpaper_preference || '',
            model: user.model || null,
            selected_provider: user.selected_provider || null,
            prompt_preference: user.prompt_preference || '',
            sysprompt_preference: user.sysprompt_preference || '',
            api_keys: {},
            verification_status: user.expand?.verification?.status || '',
            last_verified: user.expand?.verification?.updated || '',
            model_preference: user.model_preference,
            ...(user.avatar && { avatar: user.avatar })
        };
    }

    try {
        const cacheControl = 'public, max-age=60, stale-while-revalidate=300';
        
        const user = await pb.collection('users').getOne(params.id, {
            expand: 'verification',
            requestKey: `user_${params.id}`
        }) as PocketBaseUser;

        return json({
            success: true,
            user: sanitizeUser(user)
        }, {
            headers: {
                'Cache-Control': cacheControl
            }
        });
    } catch (err) {
        console.error('Failed to fetch user data:', err);
        return json(
            {
                success: false,
                error: 'Failed to fetch user data'
            },
            { status: 400 }
        );
    }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    // Define types and function inside PATCH
    interface PocketBaseUser {
        id: string;
        name?: string;
        username?: string;
        email?: string;
        description?: string;
        role?: string;
        created?: string;
        updated?: string;
        verified?: boolean;
        theme_preference?: string;
        wallpaper_preference?: string;
        model?: string | null;
        selected_provider?: string | null;
        prompt_preference?: string;
        sysprompt_preference?: string;
        model_preference?: string;
        avatar?: string;
        expand?: {
            verification?: {
                status?: string;
                updated?: string;
            };
        };
    }

    interface UpdateData {
        [key: string]: string | File | null | undefined;
        updated: string;
    }

    function sanitizeUser(user: PocketBaseUser) {
        return {
            id: user.id,
            name: user.name || '',
            username: user.username || '',
            email: user.email || '',
            description: user.description || '',
            role: user.role || '',
            created: user.created || '',
            updated: user.updated || '',
            verified: user.verified || false,
            theme_preference: user.theme_preference || '',
            wallpaper_preference: user.wallpaper_preference || '',
            model: user.model || null,
            selected_provider: user.selected_provider || null,
            prompt_preference: user.prompt_preference || '',
            sysprompt_preference: user.sysprompt_preference || '',
            api_keys: {},
            verification_status: user.expand?.verification?.status || '',
            last_verified: user.expand?.verification?.updated || '',
            model_preference: user.model_preference,
            ...(user.avatar && { avatar: user.avatar })
        };
    }

    try {
        if (!locals.user?.id) {
            return json(
                { success: false, error: 'Authentication required' },
                { status: 403 }
            );
        }

        if (params.id !== locals.user.id) {
            return json(
                { success: false, error: 'You can only update your own user data' },
                { status: 403 }
            );
        }

        const contentType = request.headers.get('content-type') || '';
        const updateData: UpdateData = {
            updated: new Date().toISOString()
        };

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const MAX_FILE_SIZE = 2 * 1024 * 1024;
            
            for (const [key, value] of formData.entries()) {
                if (value instanceof File) {
                    if (value.size > MAX_FILE_SIZE && key === 'avatar') {
                        return json(
                            { success: false, error: 'Avatar file size exceeds 2MB limit' },
                            { status: 400 }
                        );
                    }
                    updateData[key] = value;
                } else {
                    updateData[key] = value;
                }
            }
        } else {
            const data = await request.json() as Record<string, unknown>;
            const allowedFields = [
                'name', 'username', 'description', 'email', 'model',
                'selected_provider', 'theme', 'language', 'prompt_preference',
                'sysprompt_preference', 'avatar', 'model_preference', 'theme_preference',
                'wallpaper_preference'
            ] as const;

            for (const field of allowedFields) {
                if (field in data) {
                    updateData[field] = data[field] as string;
                }
            }
        }

        const updated = await pb.collection('users').update(params.id, updateData) as PocketBaseUser;

        return json({
            success: true,
            user: sanitizeUser(updated)
        });
    } catch (err) {
        console.error('Update failed:', err);
        
        // Type-safe error handling
        const errorMessage = err instanceof Error ? 
            ('status' in err && (err as Error & { status: number }).status === 404) 
                ? 'User not found' 
                : err.message 
            : 'Update failed';
            
        const status = err instanceof Error && 'status' in err 
            ? (err as Error & { status: number }).status 
            : 400;
            
        return json(
            { success: false, error: errorMessage },
            { status }
        );
    }
};