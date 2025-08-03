// $lib/clients/securityClient.ts
import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';

export interface SecurityQuestion {
	key: string;
	question: string;
}

export interface UserSecurity {
	id: string;
	user: string;
	securityQuestion: string;
	securityAnswer: string;
	twoFactorAuth?: any;
	created: string;
	updated: string;
}

/**
 * Save user's security question and answer during registration
 */
export async function saveSecurityInfo(
	userId: string,
	securityQuestion: string,
	securityAnswer: string
): Promise<{ success: boolean; error?: string }> {
	const result = await fetchTryCatch<{ success: boolean; error?: string }>('/api/auth/security', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			userId,
			securityQuestion,
			securityAnswer: securityAnswer.toLowerCase().trim() // Normalize for comparison
		})
	});

	if (!isSuccess(result)) {
		return { success: false, error: result.error };
	}

	return result.data;
}

/**
 * Get user's security question by email
 */
export async function getSecurityQuestion(
	email: string
): Promise<{ success: boolean; question?: string; error?: string }> {
	const result = await fetchTryCatch<{ success: boolean; question?: string; error?: string }>(
		`/api/auth/security?email=${encodeURIComponent(email)}`,
		{
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		}
	);

	if (!isSuccess(result)) {
		return { success: false, error: result.error };
	}

	return result.data;
}

/**
 * Verify security answer and reset password
 */
export async function resetPasswordWithSecurity(
	email: string,
	securityAnswer: string,
	newPassword: string
): Promise<{ success: boolean; error?: string }> {
	const result = await fetchTryCatch<{ success: boolean; error?: string }>(
		'/api/auth/reset-password',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email,
				securityAnswer: securityAnswer.toLowerCase().trim(),
				newPassword
			})
		}
	);

	if (!isSuccess(result)) {
		return { success: false, error: result.error };
	}

	return result.data;
}
