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
	const result = await fetchTryCatch<{
		success: boolean;
		invitationCode?: InvitationCode;
		message?: string;
	}>(`/api/verify/invitation-codes/validate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code })
	});

	if (isSuccess(result)) {
		const invitationCode = result.data.success ? result.data.invitationCode || null : null;
		return { data: invitationCode, error: null, success: true };
	}

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
