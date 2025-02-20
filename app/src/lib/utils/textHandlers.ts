export const textareaElement: HTMLTextAreaElement | null = null;
export const defaultTextareaHeight = '60px';

export function adjustFontSize(element: HTMLTextAreaElement) {
	const maxFontSize = 30;
	const minFontSize = 20;
	const maxLength = 50;

	const contentLength = element.value.length;

	if (contentLength <= maxLength) {
		element.style.fontSize = `${maxFontSize}px`;
	} else {
		const fontSize = Math.max(minFontSize, maxFontSize - (contentLength - maxLength) / 2);
		element.style.fontSize = `${fontSize}px`;
	}
}
export function resetTextareaHeight() {
	if (textareaElement) {
		textareaElement.style.height = defaultTextareaHeight;
		textareaElement.style.height = '60px';
	}
}
