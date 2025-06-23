import { browser } from '$app/environment';
import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';

export interface FileSystem {
	[filename: string]: string;
}

const STORAGE_KEY = 'ide-filesystem';

export function getFileSystem() {
	const defaultFiles: FileSystem = {
		'main.ts':
			'// Welcome to the editor!\n\nfunction hello() {\n  console.log("Hello, world!");\n}\n\nhello();',
		'README.md': '# My Project\n\nThis is a sample project created in the online IDE.',
		'styles.css':
			'/* Main styles */\nbody {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n'
	};

	async function getFiles(): Promise<FileSystem> {
		if (!browser) return defaultFiles;

		const result = await clientTryCatch(Promise.resolve().then(() => {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored ? JSON.parse(stored) : defaultFiles;
		}));
		if (isFailure(result)) {
			return defaultFiles;
		}
		return result.data;
	}

	async function saveFiles(files: FileSystem): Promise<void> {
		if (!browser) return;
		await clientTryCatch(Promise.resolve().then(() => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
		}));
	}

	async function createFile(filename: string, content: string): Promise<void> {
		const files = await getFiles();
		files[filename] = content;
		await saveFiles(files);
	}

	async function updateFile(filename: string, content: string): Promise<void> {
		const files = await getFiles();
		if (files[filename] !== undefined) {
			files[filename] = content;
			await saveFiles(files);
		}
	}

	async function deleteFile(filename: string): Promise<void> {
		const files = await getFiles();
		if (files[filename] !== undefined) {
			delete files[filename];
			await saveFiles(files);
		}
	}

	async function renameFile(oldFilename: string, newFilename: string): Promise<void> {
		const files = await getFiles();
		if (files[oldFilename] !== undefined) {
			files[newFilename] = files[oldFilename];
			delete files[oldFilename];
			await saveFiles(files);
		}
	}

	async function fileExists(filename: string): Promise<boolean> {
		const files = await getFiles();
		return files[filename] !== undefined;
	}

	return {
		getFiles,
		createFile,
		updateFile,
		deleteFile,
		renameFile,
		fileExists
	};
}
