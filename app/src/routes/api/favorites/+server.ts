// src/routes/api/favorites/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    try {
        const user = locals.user;
        if (!user?.favoriteThreads?.length) {
            return json([]);
        }

        const records = await pb.collection('threads').getList(1, 50, {
            filter: user.favoriteThreads.map((id) => `id = '${id}'`).join(' || '),
            sort: '-created',
            expand: 'user,thread'
        });

        const threads = records.items.map((thread) => ({
            id: thread.id,
            name: thread.name,
            created: thread.created,
        }));

        return json(threads);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return json([], { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const user = locals.user;

        if (!user) {
            return json(
                {
                    success: false,
                    message: 'Authentication required'
                },
                { status: 401 }
            );
        }

        const { threadId, action } = await request.json();

        if (!threadId || !['add', 'remove'].includes(action)) {
            return json(
                {
                    success: false,
                    message: 'Invalid request parameters'
                },
                { status: 400 }
            );
        }

        const currentFavoriteThreads = user.favoriteThreads || [];

        let updateFavoriteThreads: string[];

        if (action === 'add') {
            if (!currentFavoriteThreads.includes(threadId)) {
                updateFavoriteThreads = [...currentFavoriteThreads, threadId];
            } else {
                updateFavoriteThreads = currentFavoriteThreads;
            }
        } else {
            updateFavoriteThreads = currentFavoriteThreads.filter((id) => id !== threadId);
        }

        await pb.collection('users').update(user.id, {
            favoriteThreads: updateFavoriteThreads
        });

        return json({
            success: true,
            favoriteThreads: updateFavoriteThreads,
            message: action === 'add' ? 'Added to favorites' : 'Removed from favorites'
        });
    } catch (error) {
        console.error('Favorites API error:', error);
        return json(
            {
                success: false,
                message: 'Failed to update favorites'
            },
            { status: 500 }
        );
    }
};
