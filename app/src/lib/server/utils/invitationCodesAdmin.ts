import { nanoid } from 'nanoid';
import type PocketBase from 'pocketbase';
import type { InvitationCode } from '$lib/clients/invitationClient';

const CODE_LENGTH = 12; 
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
/**
 * Generate a secure invitation code
 */
export function generateInvitationCode(): string {
  return nanoid(CODE_LENGTH);
}

/**
 * Generate multiple invitation codes
 */
export function generateInvitationCodes(count: number): string[] {
  return Array.from({ length: count }, () => generateInvitationCode());
}

/**
 * Create invitation codes in database
 * @param pb PocketBase instance (with admin authentication)
 * @param count Number of codes to generate
 * @returns Array of created invitation codes
 */
export async function createInvitationCodes(pb: PocketBase, count: number): Promise<InvitationCode[]> {
  const codes = generateInvitationCodes(count);
  const results: InvitationCode[] = [];
  
  for (const code of codes) {
    try {
      const data = await pb.collection('invitation_codes').create({
        code,
        used: false,
        createdAt: new Date().toISOString()
      });
      
      results.push(data as unknown as InvitationCode);
    } catch (error) {
      console.error('Error creating invitation code:', error);
    }
  }
  
  return results;
}

/**
 * Get all unused invitation codes
 * @param pb PocketBase instance (with admin authentication)
 * @returns Array of unused invitation codes
 */
export async function getUnusedInvitationCodes(pb: PocketBase): Promise<InvitationCode[]> {
  try {
    const result = await pb.collection('invitation_codes').getList(1, 100, {
      filter: 'used=false',
      sort: 'created',
    });
    
    return result.items as unknown as InvitationCode[];
  } catch (error) {
    console.error('Error getting unused invitation codes:', error);
    return [];
  }
}

/**
 * Get all used invitation codes
 * @param pb PocketBase instance (with admin authentication)
 * @returns Array of used invitation codes
 */
export async function getUsedInvitationCodes(pb: PocketBase): Promise<InvitationCode[]> {
  try {
    const result = await pb.collection('invitation_codes').getList(1, 100, {
      filter: 'used=true',
      sort: '-usedAt',
    });
    
    return result.items as unknown as InvitationCode[];
  } catch (error) {
    console.error('Error getting used invitation codes:', error);
    return [];
  }
}