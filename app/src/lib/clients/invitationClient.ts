/**
 * Interface for invitation code records
 */
export interface InvitationCode {
  id?: string;
  code: string;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
  createdAt?: Date;
}

/**
 * Validate an invitation code
 * @param code The invitation code to validate
 * @returns The invitation code record if valid, null if invalid
 */
export async function validateInvitationCode(code: string): Promise<InvitationCode | null> {
  try {
    const response = await fetch(`/api/verify/invitation-codes/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to validate invitation code');
    }
    
    const data = await response.json();
    return data.success ? data.invitationCode : null;
  } catch (error) {
    console.error('Error validating invitation code:', error);
    return null;
  }
}

/**
 * Mark an invitation code as used
 * @param codeId The ID of the invitation code
 * @param userId The ID of the user who used the code
 * @returns True if successful, false otherwise
 */
export async function markInvitationCodeAsUsed(codeId: string, userId: string): Promise<boolean> {
  try {
    // Updated to use the new endpoint path
    const response = await fetch(`/api/verify/invitation-codes/${codeId}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to mark invitation code as used');
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error marking invitation code as used:', error);
    return false;
  }
}