export function processMapSVG(svgString: string): SVGPathElement[] {
	const parser = new DOMParser();
	const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
	const paths = Array.from(svgDoc.querySelectorAll('path'));
	return paths;
}

export function zoomToCountry(
	path: SVGPathElement,
	width: number,
	height: number
): { viewBox: string; scale: number } {
	const bbox = path.getBBox();
	const padding = 20;
	const aspectRatio = width / height;

	let newWidth = bbox.width + padding * 2;
	let newHeight = bbox.height + padding * 2;

	if (newWidth / newHeight > aspectRatio) {
		newHeight = newWidth / aspectRatio;
	} else {
		newWidth = newHeight * aspectRatio;
	}

	const scale = Math.min(width / newWidth, height / newHeight);
	const viewBox = `${bbox.x - padding} ${bbox.y - padding} ${newWidth} ${newHeight}`;

	return { viewBox, scale: scale * 100 };
}
