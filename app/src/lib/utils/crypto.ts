export class CryptoService {
	private static readonly ALGORITHM = 'AES-GCM';
	private static readonly KEY_LENGTH = 256;
	private static readonly SALT_LENGTH = 64;
	private static readonly IV_LENGTH = 12; // Recommended length for GCM
	private static readonly AUTH_TAG_LENGTH = 16;

	static async generateEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
	}

	static async encrypt(text: string, userSecret: string): Promise<string> {
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
	}

	static async decrypt(encryptedData: string, userSecret: string): Promise<string> {
		try {
			const buffer = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

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
		} catch (error) {
			console.error('Decryption failed:', error);
			throw new Error('Failed to decrypt data');
		}
	}
}
