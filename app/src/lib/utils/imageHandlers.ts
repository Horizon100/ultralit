import type { Notes } from '$lib/types';
import { notesStore } from '$lib/stores/notesStore';

export function handleImageUpload(fileInput: HTMLInputElement) {
    fileInput.click();
}

export async function onFileSelected(event: Event, updateNoteContent: () => void) {
    const target = event.target as HTMLInputElement;
    const file = (target.files as FileList)[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e: ProgressEvent<FileReader>) {
            const img = document.createElement('img');
            img.src = e.target?.result as string;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.insertNode(img);
                range.setStartAfter(img);
                range.setEndAfter(img);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            updateNoteContent();
        };
        reader.readAsDataURL(file);
    }
}

export function handleImageResize(event: MouseEvent, direction: 'width' | 'height', updateNoteContent: () => void) {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        const originalWidth = img.width;
        const originalHeight = img.height;
        const aspectRatio = originalWidth / originalHeight;

        const startX = event.clientX;
        const startY = event.clientY;

        function onMouseMove(moveEvent: MouseEvent) {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            if (direction === 'width') {
                const newWidth = originalWidth + deltaX;
                img.style.width = `${newWidth}px`;
                img.style.height = 'auto';
            } else {
                const newHeight = originalHeight + deltaY;
                img.style.height = `${newHeight}px`;
                img.style.width = 'auto';
            }
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            updateNoteContent();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
}

export function handleImageAlign(align: 'left' | 'center' | 'right', updateNoteContent: () => void) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const img = range.commonAncestorContainer.parentElement;
        if (img && img.tagName === 'IMG') {
            img.style.display = 'block';
            img.style.marginLeft = align === 'left' ? '0' : align === 'right' ? 'auto' : 'auto';
            img.style.marginRight = align === 'right' ? '0' : align === 'left' ? 'auto' : 'auto';
            updateNoteContent();
        }
    }
}