import { tryCatch, tryCatchSync, isFailure } from '$lib/utils/errorUtils';

export class CryptoService {
	private static readonly ALGORITHM = 'AES-GCM';
	private static readonly KEY_LENGTH = 256;
	private static readonly SALT_LENGTH = 64;
	private static readonly IV_LENGTH = 12; // Recommended length for GCM
	private static readonly AUTH_TAG_LENGTH = 16;

	static async generateEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
		const keyGenerationResult = await tryCatch((async () => {
			const encoder = new TextEncoder();
			const keyMaterial = await crypto.subtle.importKey(
				'raw',
				encoder.encode(password),
				{ name: 'PBKDF2' },
				false,
				['deriveKey']
			);

			return await crypto.subtle.deriveKey(
				{
					name: 'PBKDF2',
					salt,
					iterations: 100000,
					hash: 'SHA-512'
				},
				keyMaterial,
				{
					name: 'AES-GCM',
					length: this.KEY_LENGTH
				},
				false,
				['encrypt', 'decrypt']
			);
		})());

		if (isFailure(keyGenerationResult)) {
			throw new Error(`Failed to generate encryption key: ${keyGenerationResult.error.message}`);
		}

		return keyGenerationResult.data as CryptoKey;
	}

	static async encrypt(text: string, userSecret: string): Promise<string> {
		const encryptionResult = await tryCatch((async () => {
			const encoder = new TextEncoder();
			const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
			const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

			const key = await this.generateEncryptionKey(userSecret, salt);

			const encrypted = await crypto.subtle.encrypt(
				{ name: this.ALGORITHM, iv, tagLength: this.AUTH_TAG_LENGTH * 8 },
				key,
				encoder.encode(text)
			);

			// Combine salt, IV, and encrypted data into a single base64 string
			const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
			combined.set(salt);
			combined.set(iv, salt.length);
			combined.set(new Uint8Array(encrypted), salt.length + iv.length);

			return btoa(String.fromCharCode(...combined));
		})());

		if (isFailure(encryptionResult)) {
			throw new Error(`Encryption failed: ${encryptionResult.error.message}`);
		}

		return encryptionResult.data as string;
	}

	static async decrypt(encryptedData: string, userSecret: string): Promise<string> {
		const decryptionResult = await tryCatch((async () => {
			const bufferResult = tryCatchSync(() => 
				Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0))
			);

			if (isFailure(bufferResult)) {
				throw new Error('Invalid encrypted data format');
			}

			const buffer = bufferResult.data;

			// Validate buffer length
			if (buffer.length < this.SALT_LENGTH + this.IV_LENGTH + this.AUTH_TAG_LENGTH) {
				throw new Error('Encrypted data is too short to be valid');
			}

			const salt = buffer.subarray(0, this.SALT_LENGTH);
			const iv = buffer.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
			const encrypted = buffer.subarray(this.SALT_LENGTH + this.IV_LENGTH);

			const key = await this.generateEncryptionKey(userSecret, salt);

			const decrypted = await crypto.subtle.decrypt(
				{ name: this.ALGORITHM, iv, tagLength: this.AUTH_TAG_LENGTH * 8 },
				key,
				encrypted
			);

			return new TextDecoder().decode(decrypted);
		})());

		if (isFailure(decryptionResult)) {
			console.error('Decryption failed:', decryptionResult.error);
			throw new Error('Failed to decrypt data - invalid password or corrupted data');
		}

		return decryptionResult.data as string;
	}
}