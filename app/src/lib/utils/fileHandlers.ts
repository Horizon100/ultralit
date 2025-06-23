import type { TextFile } from '$lib/types/types';
import { fileTryCatch, type Result } from '$lib/utils/errorUtils';
import { uploadedFiles } from '../stores/fileStore';

export async function handleFileUpload(files: File[], x: number, y: number): Promise<Result<void, string>> {
	const result = await fileTryCatch(
		(async () => {
			console.log(`Attempting to upload ${files.length} file(s)`);

			const newUploadedFiles = files.map((file) => {
				console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
				return { file, x, y };
			});

			uploadedFiles.update((files) => [...files, ...newUploadedFiles]);

			console.log(`Successfully added ${newUploadedFiles.length} file(s) to uploadedFiles`);
		})(),
		files.length > 0 ? files[0].name : 'multiple files'
	);

	return result;
}

export function isTextFile(file: unknown): file is TextFile {
	return (
		typeof file === 'object' &&
		file !== null &&
		'type' in file &&
		'name' in file &&
		'content' in file &&
		'lastModified' in file &&
		'size' in file
	);
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function handleDrop(event: DragEvent) {
	event.preventDefault();
	if (event.dataTransfer?.items) {
		for (let i = 0; i < event.dataTransfer.items.length; i++) {
			if (event.dataTransfer.items[i].kind === 'file') {
				const file = event.dataTransfer.items[i].getAsFile();
				if (file) {
					handleFileUpload([file], event.clientX, event.clientY);
				}
			} else if (event.dataTransfer.items[i].kind === 'string') {
				event.dataTransfer.items[i].getAsString((text) => {
					const newFile = {
						type: 'text/plain',
						name: 'Dragged Text',
						content: text,
						lastModified: Date.now(),
						size: text.length
					} as unknown as File;
					handleFileUpload([newFile], event.clientX, event.clientY);
				});
			}
		}
	}
}

export function handleFileInputChange(event: Event, contextMenuX: number, contextMenuY: number) {
	const input = event.target as HTMLInputElement;
	if (input.files) {
		handleFileUpload(Array.from(input.files), contextMenuX, contextMenuY);
	}
	input.value = '';
}

export function handleFileMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
	const { id, x, y } = event.detail;
	uploadedFiles.update((files) =>
		files.map((file) => (file.file.name === id ? { ...file, x, y } : file))
	);
}
export function handleImportComplete(event: CustomEvent<File[]>, importX: number, importY: number) {
	handleFileUpload(event.detail, importX, importY);
	return false;
}

export function getFileType(
	mimeType: string
):
	| 'image'
	| 'video'
	| 'document'
	| 'audio'
	| 'archive'
	| 'spreadsheet'
	| 'presentation'
	| 'code'
	| 'ebook' {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';

	if (
		mimeType.includes('zip') ||
		mimeType.includes('rar') ||
		mimeType.includes('7z') ||
		mimeType.includes('tar') ||
		mimeType.includes('gz')
	)
		return 'archive';

	if (
		mimeType.includes('spreadsheet') ||
		mimeType.includes('excel') ||
		mimeType.includes('csv') ||
		mimeType === 'application/vnd.ms-excel' ||
		mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	)
		return 'spreadsheet';

	if (
		mimeType.includes('presentation') ||
		mimeType.includes('powerpoint') ||
		mimeType === 'application/vnd.ms-powerpoint' ||
		mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	)
		return 'presentation';

	if (
		mimeType.startsWith('text/') &&
		(mimeType.includes('javascript') ||
			mimeType.includes('css') ||
			mimeType.includes('html') ||
			mimeType.includes('xml') ||
			mimeType.includes('json') ||
			mimeType.includes('typescript'))
	)
		return 'code';

	if (
		mimeType.includes('epub') ||
		mimeType.includes('mobi') ||
		mimeType === 'application/x-mobipocket-ebook'
	)
		return 'ebook';

	if (mimeType.includes('pdf')) return 'document';

	return 'document';
}
