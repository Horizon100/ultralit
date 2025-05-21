// src/lib/utils/perkChecker.ts
import type { Perk } from '$lib/types/types';
import { PERKS } from '$lib/features/users/utils/perks';
import { pb } from '$lib/server/pocketbase';

export interface UserStats {
  threadCount: number;
  messageCount: number;
  taskCount: number;
  tagCount: number;
}

export async function initializePerksCollection() {
  try {
    // Check if perks collection exists
    const collections = await pb.collections.getFullList();
    const perksCollectionExists = collections.some(col => col.name === 'perks');
    
    if (!perksCollectionExists) {
      console.log('Creating perks collection');
      // This would normally be done in PocketBase Admin UI
      // For demo purposes, if you need to create via API:
      await pb.collections.create({
        name: 'perks',
        schema: [
          {
            name: 'perkName',
            type: 'text',
            required: true
          },
          {
            name: 'perkDescription',
            type: 'text',
            required: true
          },
          {
            name: 'icon',
            type: 'text',
            required: true
          },
          {
            name: 'filterConditions',
            type: 'json',
            required: true
          },
          {
            name: 'achievedBy',
            type: 'json'
          }
        ]
      });
    }
    
    // Check if perks are already seeded
    const existingPerks = await pb.collection('perks').getList(1, 1);
    
    if (existingPerks.totalItems === 0) {
      console.log('Seeding perks collection');
      // Seed perks
      for (const perk of PERKS) {
        await pb.collection('perks').create({
          perkName: perk.perkName,
          perkDescription: perk.perkDescription,
          icon: perk.icon,
          filterConditions: perk.filterConditions,
          achievedBy: []
        });
      }
      console.log('Perks collection seeded successfully');
    }
    
    return true;
  } catch (e) {
    console.error('Error initializing perks collection:', e);
    return false;
  }
}

export async function checkEligiblePerks(stats: UserStats): Promise<Perk[]> {
  try {
    // Get all perks from the definition
    return PERKS.filter(perk => {
      return perk.filterConditions.every(condition => {
        let userValue = 0;
        
        // Get appropriate stat value
        switch (condition.parameter) {
          case 'messages': userValue = stats.messageCount; break;
          case 'threads': userValue = stats.threadCount; break;
          case 'tasks': userValue = stats.taskCount; break;
          case 'tags': userValue = stats.tagCount; break;
        }
        
        // Evaluate the condition
        switch (condition.operator) {
          case '=': return userValue === condition.value;
          case '>': return userValue > condition.value;
          case '>=': return userValue >= condition.value;
          case '<': return userValue < condition.value;
          case '<=': return userValue <= condition.value;
          default: return false;
        }
      });
    });
  } catch (e) {
    console.error('Error checking eligible perks:', e);
    return [];
  }
}

export async function updateUserPerks(userId: string, eligiblePerks: Perk[]): Promise<string[]> {
  try {
    // Get stored perks from database to have access to their IDs
    await initializePerksCollection();
    
    const storedPerks = await pb.collection('perks').getFullList();
    
    // Map eligible perks to stored perks with IDs
    const eligiblePerkIds = eligiblePerks.map(eligiblePerk => {
      const matchedPerk = storedPerks.find(p => p.perkName === eligiblePerk.perkName);
      return matchedPerk?.id;
    }).filter(Boolean) as string[];
    
    // Get user
    const user = await pb.collection('users').getOne(userId);
    
    // Update the user's perks
    if (user) {
      // Get current user perks or initialize empty array
      const currentPerks = user.perks || [];
      
      // Find new perks user doesn't already have
      const newPerks = eligiblePerkIds.filter(id => !currentPerks.includes(id));
      
      if (newPerks.length > 0) {
        console.log(`Adding ${newPerks.length} new perks to user ${userId}`);
        
        // Update user's perks array
        const updatedPerks = [...currentPerks, ...newPerks];
        await pb.collection('users').update(userId, {
          perks: updatedPerks
        });
        
        // Update each perk's achievedBy field
        for (const perkId of newPerks) {
          const perk = await pb.collection('perks').getOne(perkId);
          const achievedBy = perk.achievedBy || [];
          
          if (!achievedBy.includes(userId)) {
            await pb.collection('perks').update(perkId, {
              achievedBy: [...achievedBy, userId]
            });
          }
        }
      }
      
      return eligiblePerkIds;
    }
    
    return [];
  } catch (e) {
    console.error('Error updating user perks:', e);
    return [];
  }
}