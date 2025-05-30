<script lang="ts">
	import type { Shape } from '$lib/types/types';

	export let startShape: Shape;
	export let endShape: Shape;
	export let scale: number;
	export let offsetX: number;
	export let offsetY: number;
	export const startPoint: string | undefined = undefined;
	export const endPoint: string | undefined = undefined;

	function getShapeCenter(shape: Shape) {
		const rect = shape.ref?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };

		const x = (rect.left + rect.width / 2 - offsetX) / scale;
		const y = (rect.top + rect.height / 2 - offsetY) / scale;

		return { x, y };
	}

	function createPath(start: { x: number; y: number }, end: { x: number; y: number }) {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const midX = start.x + dx / 2;
		const midY = start.y + dy / 2;

		// Determine the best orientation for the connector
		if (Math.abs(dx) > Math.abs(dy)) {
			// Horizontal orientation
			return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
		} else {
			// Vertical orientation
			return `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
		}
	}

	$: start = getShapeCenter(startShape);
	$: end = getShapeCenter(endShape);
	$: path = createPath(start, end);
</script>

<path d={path} stroke="black" stroke-width="2" fill="none" marker-end="url(#arrowhead)" />

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}		
	path {
		pointer-events: all;
		cursor: pointer;
	}
</style>
