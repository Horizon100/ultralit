// src/routes/api/projects/[id]/threads/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Threads, Projects } from '$lib/types/types';

export const GET: RequestHandler = async ({ params, locals, request }) => {
    const projectId = params.id;
    
    console.log(`API projects/[id]/threads: Fetching threads for project ${projectId}`);
    
    // Authentication check
    if (!locals.user) {
        console.error('API: User not authenticated');
        return json({ 
            success: false, 
            message: 'Authentication required' 
        }, { status: 401 });
    }
    
    // PocketBase instance check
    if (!locals.pb) {
        console.error('API: PocketBase client not available');
        return json({ 
            success: false, 
            message: 'Server error' 
        }, { status: 500 });
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // 1. Verify project exists and user has access
        let project: Projects;
        try {
            project = await locals.pb.collection('projects').getOne(projectId);
            console.log(`API: Found project: ${project.id} with ${project.threads?.length || 0} thread references`);
        } catch (err) {
            console.error('API: Project not found:', err);
            return json({ 
                success: false, 
                message: 'Project not found' 
            }, { status: 404 });
        }
        
        // Permission check
        const isOwner = project.owner === currentUserId;
        const isCollaborator = Array.isArray(project.collaborators) && 
                            project.collaborators.includes(currentUserId);
        
        if (!isOwner && !isCollaborator) {
            console.error('API: User does not have permission');
            return json({ 
                success: false, 
                message: 'Access denied'
            }, { status: 403 });
        }

        // 2. Fetch threads with optimized query
        let threads: Threads[] = [];
        const foundThreadIds = new Set<string>();
        
        try {
            // Single optimized query that checks all possible project reference fields
            const directThreads = await locals.pb.collection('threads').getFullList({
                filter: `(project = "${projectId}" || project.id = "${projectId}" || project_id = "${projectId}" || project_id.id = "${projectId}")`,
                sort: '-created',
                expand: 'project,project_id' // Expand any relation fields
            });
            
            console.log(`API: Found ${directThreads.length} threads with direct project reference`);
            
            // Add these threads and track their IDs
            directThreads.forEach(thread => {
                foundThreadIds.add(thread.id);
                threads.push({
                    ...thread,
                    project: projectId,
                    project_id: projectId
                });
            });
            
        } catch (fetchError) {
            console.error('API: Error fetching direct threads:', fetchError);
            // Continue with empty array
        }
        
        // 3. Fetch additional threads from project.threads array
        if (project.threads && Array.isArray(project.threads) && project.threads.length > 0) {
            try {
                // Filter out thread IDs we already have
                const missingThreadIds = project.threads.filter(id => !foundThreadIds.has(id));
                
                if (missingThreadIds.length > 0) {
                    console.log(`API: Fetching ${missingThreadIds.length} additional threads from project.threads array`);
                    
                    // Build filter for multiple IDs
                    const idFilter = missingThreadIds.map(id => `id = "${id}"`).join(' || ');
                    
                    const additionalThreads = await locals.pb.collection('threads').getFullList({
                        filter: idFilter,
                        sort: '-created'
                    });
                    
                    console.log(`API: Found ${additionalThreads.length} additional threads from project.threads array`);
                    
                    // Add these threads with project reference
                    additionalThreads.forEach(thread => {
                        // Avoid duplicates
                        if (!foundThreadIds.has(thread.id)) {
                            foundThreadIds.add(thread.id);
                            threads.push({
                                ...thread,
                                project: projectId,
                                project_id: projectId
                            });
                        }
                    });
                }
            } catch (additionalError) {
                console.error('API: Error fetching additional threads:', additionalError);
                // Continue with what we have
            }
        }
        
        console.log(`API: Total threads found: ${threads.length}`);
        
        // 4. Create default thread if none found (optional)
        if (threads.length === 0) {
            console.log('API: No threads found, creating default thread');
            try {
                const defaultThread = await locals.pb.collection('threads').create({
                    name: "General Discussion",
                    project: projectId,
                    project_id: projectId,
                    user: currentUserId,
                    members: [currentUserId],
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                });
                
                threads = [defaultThread];
                console.log('API: Default thread created:', defaultThread.id);
                
                // Optionally update the project's threads array
                try {
                    await locals.pb.collection('projects').update(projectId, {
                        threads: [...(project.threads || []), defaultThread.id]
                    });
                    console.log('API: Updated project with new thread reference');
                } catch (updateError) {
                    console.error('API: Failed to update project with thread reference:', updateError);
                }
            } catch (createError) {
                console.error('API: Error creating default thread:', createError);
            }
        }
        
        // 5. Return results
        return json({
            success: true,
            threads: threads,
            data: threads // Maintaining backward compatibility
        });
        
    } catch (err) {
        console.error('API: Unexpected error:', err);
        return json({ 
            success: false, 
            message: 'Server error',
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
    }
};