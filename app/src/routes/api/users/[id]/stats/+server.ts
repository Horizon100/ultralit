import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    const userId = params.id;
    
    try {
        // Use locals.pb if available, otherwise use pb
        
        const user = await pb.collection('users').getOne(userId);
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        let threadCount = 0;
        let messageCount = 0;
        let taskCount = 0;
        let tagCount = 0;
        let timerCount = 0;
        let lastActive = null;
        
        console.log('Fetching stats for user:', userId);
        
        try {
            const threadFilter = `op="${userId}"`;
            console.log('Using thread filter:', threadFilter);
            
            const threadsResult = await pb.collection('threads').getList(1, 1, {
                filter: threadFilter
                
            });
            
            threadCount = threadsResult.totalItems;
            console.log('Thread count:', threadCount);
            

        } catch (e) {
            console.error('Error counting threads:', e);
            

        }
        try {
            const taskFilter = `createdBy="${userId}"`;
            console.log('Using task filter:', taskFilter);
            
            const taskResults = await pb.collection('tasks').getList(1, 1, {
                filter: taskFilter
                
            });
            
            taskCount = taskResults.totalItems;
            console.log('Task count:', taskCount);
            

        } catch (e) {
            console.error('Error counting tasks:', e);
            

        }
        
        try {
            const messageFilter = `user="${userId}"`;
            console.log('Using message filter:', messageFilter);
            
            const messagesResult = await pb.collection('messages').getList(1, 1, {
                filter: messageFilter
            });
            
            messageCount = messagesResult.totalItems;
            console.log('Message count:', messageCount);
            
            if (messageCount > 0) {
                const latestMessage = await pb.collection('messages').getList(1, 1, {
                    filter: messageFilter,
                    sort: '-created'
                });
                
                if (latestMessage.items.length > 0 && latestMessage.items[0].created) {
                    const messageDate = new Date(latestMessage.items[0].created);
                    if (!lastActive || messageDate > lastActive) {
                        lastActive = messageDate;
                    }
                }
            }
        } catch (e) {
            console.error('Error counting messages:', e);
            try {
                const taskFilter = `createdBy="${userId}"`;
                console.log('Using thread filter:', taskFilter);
                
                const taskResults = await pb.collection('threads').getList(1, 1, {
                    filter: taskFilter
                    
                });
                
                taskCount = taskResults.totalItems;
                console.log('Thread count:', taskCount);
                
    
            } catch (e) {
                console.error('Error counting threads:', e);
                
    
            }
            
            try {
                const alternativeFilters = [
                    `user="${userId}"`,
                    `owner="${userId}"`,
                    `user_id="${userId}"`
                ];
                
                for (const filter of alternativeFilters) {
                    try {
                        console.log('Trying alternative message filter:', filter);
                        const result = await pb.collection('messages').getList(1, 1, {
                            filter: filter
                        });
                        
                        messageCount = result.totalItems;
                        if (messageCount > 0) {
                            console.log('Message count with alternative filter:', messageCount);
                            break;
                        }
                    } catch (innerErr) {
                    }
                }
            } catch (fallbackErr) {
                console.error('All message filters failed:', fallbackErr);
            }
        }
        
        try {
            const tagFilter = `createdBy="${userId}"`;
            console.log('Using tag filter:', tagFilter);
            
            const tagsResult = await pb.collection('tags').getList(1, 1, {
                filter: tagFilter
            });
            
            tagCount = tagsResult.totalItems;
            console.log('Tag count:', tagCount);
        } catch (e) {
            console.error('Error counting tags:', e);
            
            const alternativeCollections = ['bookmarks', 'prompts'];
            for (const collection of alternativeCollections) {
                try {
                    const filter = `createdBy="${userId}"`;
                    console.log(`Trying ${collection} with filter:`, filter);
                    
                    const result = await pb.collection(collection).getList(1, 1, {
                        filter: filter
                    });
                    
                    tagCount += result.totalItems;
                    console.log(`${collection} count:`, result.totalItems);
                } catch (collErr) {
                }
            }
        }
        
        const timerCollections = ['timer_entries', 'timers', 'time_entries', 'time_tracking'];
        for (const collection of timerCollections) {
            try {
                const filter = `createdBy="${userId}"`;
                console.log(`Trying ${collection} with filter:`, filter);
                
                const entries = await pb.collection(collection).getFullList({
                    filter: filter
                });
                
                console.log(`${collection} entries:`, entries.length);
                
                if (entries.length > 0) {
                    if (entries[0]) {
                        console.log(`Sample ${collection} entry:`, entries[0]);
                    }
                    
                    const possibleFields = ['duration_seconds', 'duration', 'seconds', 'time', 'elapsed', 'timeValue'];
                    
                    for (const entry of entries) {
                        let foundDuration = false;
                        
                        for (const field of possibleFields) {
                            if (entry[field] !== undefined && !isNaN(Number(entry[field]))) {
                                timerCount += Number(entry[field]);
                                foundDuration = true;
                                console.log(`Found duration in field '${field}':`, entry[field]);
                                break;
                            }
                        }
                        
                        if (!foundDuration) {
                            console.log('Timer entry fields:', Object.keys(entry));
                            
                            for (const field of Object.keys(entry)) {
                                if (typeof entry[field] === 'number' && 
                                    field !== 'id' && 
                                    !field.includes('id') && 
                                    field !== 'created' && 
                                    field !== 'updated') {
                                    
                                    timerCount += Number(entry[field]);
                                    console.log(`Using numeric field '${field}' as duration:`, entry[field]);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                if (entries.length > 0) {
                    break;
                }
            } catch (e) {
                console.error(`Error with ${collection}:`, e);
            }
        }
        
        console.log('Final counts:', { threadCount, messageCount, taskCount, tagCount, timerCount });
        
        if (!lastActive) {
            if (user.updated) {
                lastActive = new Date(user.updated);
            } else if (user.created) {
                lastActive = new Date(user.created);
            }
        }
        
        return json({
            success: true,
            threadCount,
            messageCount,
            taskCount,
            tagCount,
            timerCount,
            lastActive: lastActive ? lastActive.toISOString() : null
        });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch user stats'
        }, { status: 400 });
    }
};