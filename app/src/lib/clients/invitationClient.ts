import { fetchTryCatch, isSuccess, type Result } from '$lib/utils/errorUtils';

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
export async function validateInvitationCode(
	code: string
): Promise<Result<InvitationCode | null, string>> {
	console.log('🌐 Starting API call for code:', code);
	
	const result = await fetchTryCatch<any>(`/api/verify/invitation-codes/validate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code })
	});

	console.log('🔄 fetchTryCatch result:', result);

	if (isSuccess(result)) {
		const responseData = result.data;
		console.log('📦 Response data:', responseData);
		console.log('📦 Response data keys:', Object.keys(responseData));
		console.log('✅ Response success:', responseData.success);
		
		// Check if the response has a 'data' property with the invitation code
		if (responseData.success) {
			let invitationCode;
			
			// Handle different response structures
			if (responseData.invitationCode) {
				invitationCode = responseData.invitationCode;
			} else if (responseData.data && responseData.data.invitationCode) {
				invitationCode = responseData.data.invitationCode;
			} else if (responseData.data && typeof responseData.data === 'object') {
				// The data itself might be the invitation code object
				invitationCode = responseData.data;
			}
			
			console.log('🎫 Found invitationCode:', invitationCode);
			
			if (invitationCode) {
				console.log('✅ Returning successful result');
				return { 
					data: invitationCode, 
					error: null, 
					success: true 
				};
			}
		}
		
		console.log('❌ Response indicates failure or no invitation code found');
		return { 
			data: null, 
			error: responseData.message || 'Invalid invitation code', 
			success: false 
		};
	}

	console.log('❌ fetchTryCatch failed, error:', result.error);
	return { data: null, error: result.error, success: false };
}
/**
 * Mark an invitation code as used
 * @param codeId The ID of the invitation code
 * @param userId The ID of the user who used the code
 * @returns Result object with success status
 */
export async function markInvitationCodeAsUsed(
	codeId: string,
	userId: string
): Promise<Result<boolean, string>> {
	const result = await fetchTryCatch<{ success: boolean; message?: string }>(
		`/api/verify/invitation-codes/${codeId}/use`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId })
		}
	);

	if (isSuccess(result)) {
		return { data: result.data.success, error: null, success: true };
	}

	return { data: null, error: result.error, success: false };
}
