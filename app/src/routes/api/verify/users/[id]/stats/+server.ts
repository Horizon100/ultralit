import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkEligiblePerks, updateUserPerks } from '$lib/features/users/utils/perkChecker';

export const GET: RequestHandler = async ({ params, locals, url }) => {
    const userId = params.id;
    const projectId = url.searchParams.get('projectId');

    try {
        // Use locals.pb if available, otherwise use pb
        const pocketBase = locals?.pb || pb;
        
        // First check if user exists
        const user = await pocketBase.collection('users').getOne(userId);
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        // Initialize counters with default values
        let threadCount = 0;
        let messageCount = 0;
        let taskCount = 0;
        let tagCount = 0;
        let timerCount = 0;
        let lastActive = null;
        
        console.log('Fetching stats for user:', userId);
        
        // Try to get thread count - based on your tags and tasks API pattern
        try {
            // This pattern matches your tags API filter style
            const threadFilter = `op="${userId}"`;
            console.log('Using thread filter:', threadFilter);
            
            const threadsResult = await pocketBase.collection('threads').getList(1, 1, {
                filter: threadFilter,

            });
            
            threadCount = threadsResult.totalItems;
            console.log('Thread count:', threadCount);
            

        } catch (e) {
            console.error('Error counting threads:', e);
            

        }
        
        try {
          const taskFilter = `createdBy="${userId}"`;
          console.log('Using task filter:', taskFilter);
          
          const taskResults = await pocketBase.collection('tasks').getList(1, 1, {
              filter: taskFilter,

          });
          
          taskCount = taskResults.totalItems;
          console.log('Task count:', taskCount);
          

      } catch (e) {
          console.error('Error counting tasks:', e);
          

      }
        // Try to get message count
        try {
            // Based on your tags pattern
            const messageFilter = `user="${userId}"`;
            console.log('Using message filter:', messageFilter);
            
            const messagesResult = await pocketBase.collection('messages').getList(1, 1, {
                filter: messageFilter
            });
            
            messageCount = messagesResult.totalItems;
            console.log('Message count:', messageCount);
            
            // Try to get last activity time from the most recent message
            if (messageCount > 0) {
                const latestMessage = await pocketBase.collection('messages').getList(1, 1, {
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
                // Try alternative filter styles
                const alternativeFilters = [
                    `user="${userId}"`,
                    `owner="${userId}"`,
                    `user_id="${userId}"`
                ];
                
                for (const filter of alternativeFilters) {
                    try {
                        console.log('Trying alternative message filter:', filter);
                        const result = await pocketBase.collection('messages').getList(1, 1, {
                            filter: filter
                        });
                        
                        messageCount = result.totalItems;
                        if (messageCount > 0) {
                            console.log('Message count with alternative filter:', messageCount);
                            break;
                        }
                    } catch (innerErr) {
                        // Continue to next filter
                    }
                }
            } catch (fallbackErr) {
                console.error('All message filters failed:', fallbackErr);
            }
        }
        
        // Get tag count - directly using the pattern from your tags API
        try {
            const tagFilter = `createdBy="${userId}"`;
            console.log('Using tag filter:', tagFilter);
            
            const tagsResult = await pocketBase.collection('tags').getList(1, 1, {
                filter: tagFilter
            });
            
            tagCount = tagsResult.totalItems;
            console.log('Tag count:', tagCount);
        } catch (e) {
            console.error('Error counting tags:', e);
            
            // Try with other collections that might contain tag-like data
            const alternativeCollections = ['bookmarks', 'prompts'];
            for (const collection of alternativeCollections) {
                try {
                    const filter = `createdBy="${userId}"`;
                    console.log(`Trying ${collection} with filter:`, filter);
                    
                    const result = await pocketBase.collection(collection).getList(1, 1, {
                        filter: filter
                    });
                    
                    tagCount += result.totalItems;
                    console.log(`${collection} count:`, result.totalItems);
                } catch (collErr) {
                    // Just continue to the next collection
                }
            }
        }
        
        // Get timer count - try to find a collection with time tracking data
        const timerCollections = ['timer_entries', 'timers', 'time_entries', 'time_tracking'];
        for (const collection of timerCollections) {
            try {
                const filter = `createdBy="${userId}"`;
                console.log(`Trying ${collection} with filter:`, filter);
                
                const entries = await pocketBase.collection(collection).getFullList({
                    filter: filter
                });
                
                console.log(`${collection} entries:`, entries.length);
                
                if (entries.length > 0) {
                    // Log the first entry to see its structure
                    if (entries[0]) {
                        console.log(`Sample ${collection} entry:`, entries[0]);
                    }
                    
                    // Try different field names for duration
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
                            // If we couldn't find a duration field, check all fields
                            console.log('Timer entry fields:', Object.keys(entry));
                            
                            // Try to find a numeric field that could be duration
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
                
                // If we found timer entries, break out of the loop
                if (entries.length > 0) {
                    break;
                }
            } catch (e) {
                // If this collection doesn't exist, just continue to the next one
                console.error(`Error with ${collection}:`, e);
            }
        }
        
        console.log('Final counts:', { threadCount, messageCount, taskCount, tagCount, timerCount });
        
        // If no activity found, use the user's updated or created date
        if (!lastActive) {
            if (user.updated) {
                lastActive = new Date(user.updated);
            } else if (user.created) {
                lastActive = new Date(user.created);
            }
        }
        const stats = { threadCount, messageCount, taskCount, tagCount };
        const eligiblePerks = await checkEligiblePerks(stats);
        
        console.log(`User ${userId} is eligible for ${eligiblePerks.length} perks`);
        
        const perkIds = await updateUserPerks(userId, eligiblePerks);
        
        let perks = [];
        try {
            // Get user's existing perks
            if (user.perks && user.perks.length > 0) {
                const filter = user.perks.map(id => `id="${id}"`).join(' || ');
                const perksResult = await pocketBase.collection('perks').getList(1, 100, {
                    filter: filter
                });
                
                perks = perksResult.items;
            }
        } catch (e) {
            console.error('Error fetching perks:', e);
        }
        
        return json({
            success: true,
            threadCount,
            messageCount,
            taskCount,
            tagCount,
            timerCount,
            lastActive: lastActive ? lastActive.toISOString() : null,
            perks: perks
        });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch user stats'
        }, { status: 400 });
    }
};