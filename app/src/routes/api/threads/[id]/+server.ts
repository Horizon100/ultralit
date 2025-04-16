//api/threads/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorized');
    
    try {
        const thread = await pb.collection('threads').getOne(params.id, {
            expand: 'user,participants'
        });
        
        // Verify access - note: participants might be an array
        if (thread.user !== locals.user.id && 
            !thread.participants?.includes(locals.user.id)) {
            throw error(403, 'Forbidden');
        }
        
        return json({ success: true, data: thread });
    } catch (err) {
        console.error('Thread fetch error:', err);
        const message = err.response?.data?.message || err.message;
        throw error(400, message || 'Failed to fetch thread');
    }
};
async function isProjectCollaborator(projectId, userId) {
    try {
        const project = await pb.collection('projects').getOne(projectId);
        return Array.isArray(project.collaborators) && project.collaborators.includes(userId);
    } catch (err) {
        return false;
    }
}
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorized');
    
    const data = await request.json();
    try {
        const thread = await pb.collection('threads').getOne(params.id);
        
        // Check both user and op fields to determine ownership
        const isOwner = thread.user === locals.user.id || thread.op === locals.user.id;
        
        const isCollaborator = thread.project_id ? await isProjectCollaborator(thread.project_id, locals.user.id) : false;
        
        const isMember = Array.isArray(thread.members) && thread.members.includes(locals.user.id);
        
        if (!isOwner && !isCollaborator && !isMember) {
            throw error(403, 'Insufficient permissions to update thread');
        }
        
        if (!isOwner && Object.keys(data).some(key => key !== 'members')) {
            throw error(403, 'Can only update member list');
        }
        
        const updated = await pb.collection('threads').update(params.id, data);
        return json({ success: true, data: updated });
    } catch (err) {
        throw error(400, err.message);
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorized');
    
    try {
        const thread = await pb.collection('threads').getOne(params.id);
        
        // Verify ownership
        if (thread.user !== locals.user.id) {
            throw error(403, 'Only thread owner can delete');
        }
        
        await pb.collection('threads').delete(params.id);
        return json({ success: true });
    } catch (err) {
        throw error(400, err.message);
    }
};