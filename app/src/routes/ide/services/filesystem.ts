import { browser } from '$app/environment';

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

	function getFiles(): FileSystem {
		if (!browser) return defaultFiles;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored ? JSON.parse(stored) : defaultFiles;
		} catch (error) {
			console.error('Failed to load files from storage:', error);
			return defaultFiles;
		}
	}

	function saveFiles(files: FileSystem): void {
		if (!browser) return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
		} catch (error) {
			console.error('Failed to save files to storage:', error);
		}
	}

	function createFile(filename: string, content: string): void {
		const files = getFiles();
		files[filename] = content;
		saveFiles(files);
	}

	function updateFile(filename: string, content: string): void {
		const files = getFiles();
		if (files[filename] !== undefined) {
			files[filename] = content;
			saveFiles(files);
		}
	}

	function deleteFile(filename: string): void {
		const files = getFiles();
		if (files[filename] !== undefined) {
			delete files[filename];
			saveFiles(files);
		}
	}

	function renameFile(oldFilename: string, newFilename: string): void {
		const files = getFiles();
		if (files[oldFilename] !== undefined) {
			files[newFilename] = files[oldFilename];
			delete files[oldFilename];
			saveFiles(files);
		}
	}

	function fileExists(filename: string): boolean {
		const files = getFiles();
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
