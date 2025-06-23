<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import * as d3 from 'd3';
	import type { HierarchyData } from '$lib/types/types';

	// Extended type for our nodes
	interface IcicleNode extends d3.HierarchyRectangularNode<HierarchyData> {
		target?: {
			x0: number;
			x1: number;
			y0: number;
			y1: number;
		};
	}

	export let data: HierarchyData;
	export let width = 928;
	export let height = 1200;
	export let scale = 1;
	export let containerWidth: number = width;
	export let containerHeight: number = height;
	const dispatch = createEventDispatcher<{
		zoom: { scale: number };
		taskClicked: { task: NonNullable<HierarchyData['taskData']>; name: string };
	}>();

	let svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
	let root: IcicleNode;
	let originalRoot: IcicleNode;
	let color: d3.ScaleOrdinal<string, string>;
	let clickedStack: IcicleNode[] = [];

	$: if (data && svg) {
		updateChart();
	}

	$: if (scale !== 1) {
		updateZoom();
	}

	onMount(() => {
		svg = d3
			.select('#icicle-chart')
			.append('svg')
			.attr('viewBox', [0, 0, width, height])
			.attr('width', width)
			.attr('height', height)
			.attr('style', 'max-width: 100%; height: auto;');

		updateChart();
	});

	function updateChart() {
		if (!svg || !data) return;

		svg.selectAll('*').remove();

		// Reset the navigation stack when data changes
		clickedStack = [];

		color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, (data.children?.length ?? 0) + 1));

		const hierarchy = d3
			.hierarchy<HierarchyData>(data)
			.sum((d) => d.value ?? 0)
			.sort((a, b) => b.height - a.height || (b.value ?? 0) - (a.value ?? 0));

		root = d3.partition().size([height, ((hierarchy.height + 1) * width) / 4])(
			hierarchy as any
		) as IcicleNode;

		// Store the original root for navigation
		originalRoot = root;

		renderChart();
	}

	function renderChart() {
		if (!svg || !root) return;

		// Clear existing elements
		svg.selectAll('*').remove();

		// Create formatter for values
		const format = d3.format(',d');

		// Create cell groups for each node
		const cell = svg
			.selectAll<SVGGElement, IcicleNode>('g')
			.data(root.descendants())
			.join('g')
			.attr('transform', (d) => `translate(${d.y0},${d.x0})`)
			.classed('task-node', (d) => !!d.data.taskId)
			.style('cursor', 'pointer')
			.on('click', (event, d) => clicked(event, d));

		// Add rectangles - maintain original icicle layout
		cell
			.append('rect')
			.attr('width', (d) => Math.max(1, d.y1 - d.y0 - 1))
			.attr('height', (d) => rectHeight(d))
			.attr('fill-opacity', (d) => (d.data.taskId ? 0.9 : 1))
			.attr('fill', (d) => {
				if (!d.depth) return '#ccc';
				if (d.data.taskId) return '#ff4757';
				let current = d;
				while (current.depth > 1 && current.parent) current = current.parent;
				return color(current.data.name);
			})
			.attr('stroke', (d) => (d.data.taskId ? '#2c2c2c' : 'none'))
			.attr('stroke-width', (d) => (d.data.taskId ? 2 : 0));

		// Add text elements - maintain original icicle text layout
		const text = cell
			.append('text')
			.style('user-select', 'none')
			.attr('pointer-events', 'none')
			.attr('x', 4)
			.attr('y', 13)
			.attr('fill-opacity', (d) => +labelVisible(d));

		text.append('tspan').text((d) => d.data.name);
		text
			.append('tspan')
			.attr('fill-opacity', (d) => labelVisible(d) * 0.7)
			.text((d) => ` ${format(d.value ?? 0)}`);

		// Add tooltips
		cell.append('title').text(
			(d) =>
				`${d
					.ancestors()
					.map((a) => a.data.name)
					.reverse()
					.join('/')}\n${format(d.value ?? 0)}`
		);

		// Calculate total height needed
		const totalHeight = d3.max(root.descendants(), (d) => d.x1) || height;

		// Update SVG dimensions if content exceeds container
		if (totalHeight > containerHeight) {
			svg.attr('height', totalHeight).attr('viewBox', [0, 0, width, totalHeight]);
		} else {
			svg.attr('height', containerHeight).attr('viewBox', [0, 0, width, containerHeight]);
		}
	}

	function updateZoom() {
		if (!svg) return;
		svg.attr('transform', `scale(${scale})`);
		dispatch('zoom', { scale });
	}
	function clicked(event: Event, p: any) {
		// If clicking on the current root (leftmost, full-height section), go back
		if (p === root && clickedStack.length > 0) {
			const previousRoot = clickedStack.pop();
			if (!previousRoot) return;

			root = previousRoot;
			animateTransition(root);
			return;
		}

		// If clicking on a leaf node (individual task), dispatch task details
		if (!p.children && p.data.taskData) {
			dispatch('taskClicked', {
				task: p.data.taskData,
				name: p.data.name
			});
			return;
		}

		// Don't zoom into leaf nodes or the same node we're already viewing
		if (!p.children || p === root) return;

		// Push the current root to the stack before zooming into the new root
		clickedStack.push(root);

		// Update root to the new clicked node
		root = p as IcicleNode;

		animateTransition(p);
	}

	function animateTransition(p: any) {
		const t = svg.transition().duration(400);

		// Calculate new positions - stretch vertically (height), keep horizontal proportions
		root.each((d: any) => {
			// For vertical stretching (full height)
			const relativeX = (Number(d.x0) - Number(p.x0)) / (Number(p.x1) - Number(p.x0));
			const relativeXEnd = (Number(d.x1) - Number(p.x0)) / (Number(p.x1) - Number(p.x0));

			// For horizontal positioning (maintain proportions)
			const relativeY = (Number(d.y0) - Number(p.y0)) / (Number(p.y1) - Number(p.y0));
			const relativeYEnd = (Number(d.y1) - Number(p.y0)) / (Number(p.y1) - Number(p.y0));

			d.target = {
				// Stretch vertically to fill full height
				x0: relativeX * height,
				x1: relativeXEnd * height,
				// Maintain relative width proportions
				y0: relativeY * (Number(p.y1) - Number(p.y0)),
				y1: relativeYEnd * (Number(p.y1) - Number(p.y0))
			};

			// For task nodes, enforce fixed height
			if (!d.children && d.data.taskId) {
				const midPoint = (d.target.x0 + d.target.x1) / 1;
				d.target.x0 = midPoint - 40; // Half of 80px
				d.target.x1 = midPoint + 40; // Half of 80px
			}
		});

		const cell = svg.selectAll('g');

		// Animate positions
		cell
			.transition(t as any)
			.attr('transform', (d: any) => `translate(${d.target?.y0 ?? d.y0},${d.target?.x0 ?? d.x0})`);

		// Animate rectangles
		cell
			.select('rect')
			.transition(t as any)
			.attr('width', (d: any) => (d.target?.y1 ?? d.y1) - (d.target?.y0 ?? d.y0) - 1)
			.attr('height', (d: any) => rectHeight(d.target ?? d));

		// Animate text visibility
		cell
			.select('text')
			.transition(t as any)
			.attr('fill-opacity', (d: any) => +labelVisible(d.target ?? d));

		cell
			.select('tspan')
			.transition(t as any)
			.attr('fill-opacity', (d: any) => labelVisible(d.target ?? d) * 0.7);
	}
	// Function to go back to the previous hierarchy level
	function goBack() {
		if (clickedStack.length === 0) return;

		// Pop the last node from the stack
		const previousRoot = clickedStack.pop();
		if (!previousRoot) return;

		root = previousRoot;

		// Calculate positions for going back
		const t = svg.transition().duration(750);

		// Reset target positions to original positions
		root.each((d: any) => {
			d.target = {
				x0: Number(d.x0),
				x1: Number(d.x1),
				y0: Number(d.y0),
				y1: Number(d.y1)
			};
		});

		const cell = svg.selectAll('g');

		// Animate back to previous positions
		cell
			.transition(t as any)
			.attr('transform', (d: any) => `translate(${d.target?.y0 ?? d.y0},${d.target?.x0 ?? d.x0})`);

		cell
			.select('rect')
			.transition(t as any)
			.attr('height', (d: any) => rectHeight(d.target ?? d));

		cell
			.select('text')
			.transition(t as any)
			.attr('fill-opacity', (d: any) => +labelVisible(d.target ?? d));

		cell
			.select('tspan')
			.transition(t as any)
			.attr('fill-opacity', (d: any) => labelVisible(d.target ?? d) * 0.7);
	}

	// Function to go back to the root
	function goToRoot() {
		if (!originalRoot || root === originalRoot) return;

		// Clear the stack and go back to original root
		clickedStack = [];
		root = originalRoot;

		// Re-render the entire chart from the root
		renderChart();
	}

	function rectHeight(d: IcicleNode): number {
		return d.data.taskId ? 80 : d.x1 - d.x0;
	}

	function labelVisible(d: any): number {
		const y0 = Number(d.y0);
		const y1 = Number(d.y1);
		const x0 = Number(d.x0);
		const x1 = Number(d.x1);

		// Always show labels for tasks
		if (!d.children && d.data.taskId) {
			return 1;
		}

		return y1 <= width && y0 >= 0 && x1 - x0 > 16 ? 1 : 0;
	}
</script>

<div class="chart-container">
	<div id="icicle-chart"></div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.chart-container {
		margin: 0;
		padding: 0;
		width: 100%;
		height: auto;
	}

	#icicle-chart {
		width: 90%;
		height: 100%;
		margin-left: 5%;
		&.scrollable {
			overflow: auto;
		}
		.task-node {
			rect {
				height: 80px !important;
			}

			text {
				font-weight: bold;
				dominant-baseline: middle;
				transform: translateY(40px);
			}
		}

		text {
			font-size: 12px;
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: hidden;
		}
		svg {
			display: block;

			.task-node {
				text {
					font-size: 11px;
					dominant-baseline: middle;
				}

				rect {
					height: 80px !important;
					transform: translateY(-40px) !important;
				}
			}

			text {
				font-size: 12px;
				pointer-events: none;
				user-select: none;
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
			}
		}
	}

	.icicle-container {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.task-node {
		rect {
			height: 80px !important;
			transform: translateY(-40px) !important;
		}

		foreignObject {
			div {
				&::-webkit-scrollbar {
					width: 4px;
				}
				&::-webkit-scrollbar-thumb {
					background: rgba(0, 0, 0, 0.2);
					border-radius: 2px;
				}
			}
		}
	}
</style>
