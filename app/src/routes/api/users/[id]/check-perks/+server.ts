// src/routes/api/users/[id]/check-perks/+server.ts
import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Perk } from '$lib/types/types';
import { PERKS } from '$lib/features/users/utils/perks';

export const POST: RequestHandler = async ({ params, request }) => {
    const userId = params.id;
    
    try {
        // Get the stats from the request body
        const body = await request.json();
        const stats = {
            threadCount: body.threadCount || 0,
            messageCount: body.messageCount || 0,
            taskCount: body.taskCount || 0,
            tagCount: body.tagCount || 0
        };
        
        console.log('DEBUG: Check-perks API called with stats:', stats);
        
        // Initialize or create perks in database
        let dbPerks: Perk[] = [];
        try {
            // Check if perks exist in the database
            const perksResult = await pb.collection('perks').getList(1, 50);
            
            if (perksResult.totalItems === 0) {
                console.log('DEBUG: No perks in database, creating them');
                // Create perks
                for (const perk of PERKS) {
                    const createdPerk = await pb.collection('perks').create({
                        perkName: perk.perkName,
                        perkDescription: perk.perkDescription,
                        perkIcon: perk.perkIcon,
                        filterConditions: perk.filterConditions,
                        achievedBy: []
                    });
                    
                    dbPerks.push(createdPerk);
                }
            } else {
                console.log(`DEBUG: Found ${perksResult.totalItems} perks in database`);
                // Get all perks
                dbPerks = await pb.collection('perks').getFullList();
            }
        } catch (e) {
            console.error('DEBUG: Error with perks collection:', e);
            // If we can't access the perks collection, just use the hardcoded perks
            dbPerks = PERKS.map(p => ({ ...p, id: p.perkName })) as Perk[];
        }
        
        // Now check which perks the user qualifies for
        const eligiblePerkIds = dbPerks.filter(perk => {
            return perk.filterConditions.every(condition => {
                let userValue = 0;
                
                switch(condition.parameter) {
                    case 'messages': userValue = stats.messageCount; break;
                    case 'threads': userValue = stats.threadCount; break;
                    case 'tasks': userValue = stats.taskCount; break;
                    case 'tags': userValue = stats.tagCount; break;
                }
                
                switch(condition.operator) {
                    case '=': return userValue === condition.value;
                    case '>': return userValue > condition.value;
                    case '>=': return userValue >= condition.value;
                    case '<': return userValue < condition.value;
                    case '<=': return userValue <= condition.value;
                    default: return false;
                }
            });
        }).map(perk => perk.id);
        
        console.log(`DEBUG: User qualifies for ${eligiblePerkIds.length} perks with IDs:`, eligiblePerkIds);
        
        // Get the user
        const user = await pb.collection('users').getOne(userId);
        
        // Make sure user has a perks field
        let currentPerks: string[] = [];
        try {
            currentPerks = user.perks || [];
        } catch (e) {
            console.error('DEBUG: Error accessing user.perks:', e);
            // Try to update user schema if perks field doesn't exist
            try {
                console.log('DEBUG: Attempting to add perks field to user');
                /*
                 * This is usually done in the admin UI, but we'll try programmatically
                 * Note: This requires admin access
                 */
                await pb.collection('users').update(userId, {
                    "perks": []
                });
            } catch (schemaError) {
                console.error('DEBUG: Could not update user schema:', schemaError);
            }
        }
        
        // Check for new perks
        const newPerks = eligiblePerkIds.filter(id => !currentPerks.includes(id));
        console.log(`DEBUG: Found ${newPerks.length} new perks for user`);
        
        // Update user's perks
        if (newPerks.length > 0) {
            try {
                const updatedPerks = [...currentPerks, ...newPerks];
                console.log('DEBUG: Updating user with perks:', updatedPerks);
                
                await pb.collection('users').update(userId, {
                    perks: updatedPerks
                });
                
                // Get user perks after update
                const updatedUser = await pb.collection('users').getOne(userId);
                currentPerks = updatedUser.perks || [];
            } catch (e) {
                console.error('DEBUG: Error updating user perks:', e);
            }
        }
        
        // Get full perk objects for user
        let userPerks: Perk[] = [];
        if (currentPerks.length > 0) {
            try {
                // For each perk ID, find the corresponding perk in dbPerks
                userPerks = currentPerks.map(id => {
                    const foundPerk = dbPerks.find(p => p.id === id);
                    return foundPerk;
                }).filter(Boolean) as Perk[];
            } catch (e) {
                console.error('DEBUG: Error mapping perk IDs to full perks:', e);
            }
        }
        
        console.log(`DEBUG: Returning ${userPerks.length} perks to client`);
        
        // If we still have no perks to return, return eligible perks directly
        if (userPerks.length === 0 && eligiblePerkIds.length > 0) {
            console.log('DEBUG: No perks found for user, returning eligible perks directly');
            userPerks = dbPerks.filter(p => eligiblePerkIds.includes(p.id));
        }
        
        return json({
            success: true,
            perks: userPerks,
            newPerks: newPerks.length
        });
    } catch (err) {
        console.error('DEBUG: Error checking perks:', err);
        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to check perks'
        }, { status: 400 });
    }
};