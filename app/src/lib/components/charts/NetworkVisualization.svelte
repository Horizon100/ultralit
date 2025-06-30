<script lang="ts">
	import { onMount } from 'svelte';
	import type { NetworkData, VisNode } from '$lib/types/types';
	import * as d3 from 'd3';
	export let networkData: NetworkData;

	let svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>;
	interface NetworkLink extends d3.SimulationLinkDatum<VisNode> {
		source: string | VisNode;
		target: string | VisNode;
	}

	function drawNetwork() {
		svg.selectAll('*').remove();

		const width = 800;
		const height = 600;

		const simulation = d3
			.forceSimulation<VisNode>(networkData.nodes)
			.force(
				'link',
				d3
					.forceLink<VisNode, NetworkLink>(networkData.edges)
					.id((d) => d.id)
					.distance(100)
			)
			.force('charge', d3.forceManyBody())
			.force('center', d3.forceCenter(width / 2, height / 2));

		const link = svg
			.append('g')
			.attr('class', 'links')
			.selectAll('line')
			.data(networkData.edges)
			.enter()
			.append('line')
			.attr('stroke-width', 2);

		const node = svg
			.append('g')
			.attr('class', 'nodes')
			.selectAll('circle')
			.data(networkData.nodes)
			.enter()
			.append('circle')
			.attr('r', 5)
			.attr('fill', (d: VisNode) => (d.id === networkData.rootAgent.id ? '#ff0000' : '#00ff00'));

		const text = svg
			.append('g')
			.attr('class', 'labels')
			.selectAll('text')
			.data(networkData.nodes)
			.enter()
			.append('text')
			.text((d: VisNode) => d.label)
			.attr('font-size', 12)
			.attr('dx', 12)
			.attr('dy', 4);

		simulation.on('tick', () => {
			link
				.attr('x1', (d: NetworkLink) => (d.source as VisNode).x || 0)
				.attr('y1', (d: NetworkLink) => (d.source as VisNode).y || 0)
				.attr('x2', (d: NetworkLink) => (d.target as VisNode).x || 0)
				.attr('y2', (d: NetworkLink) => (d.target as VisNode).y || 0);

			node.attr('cx', (d: VisNode) => d.x || 0).attr('cy', (d: VisNode) => d.y || 0);

			text.attr('x', (d: VisNode) => d.x || 0).attr('y', (d: VisNode) => d.y || 0);
		});
	}
	onMount(() => {
		if (networkData && Array.isArray(networkData.nodes) && Array.isArray(networkData.edges)) {
			svg = d3.select('svg');
			drawNetwork();
		} else {
			console.error('Invalid networkData:', networkData);
		}
	});
</script>

<svg width="800" height="600"></svg>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	svg {
		border: 1px solid #ccc;
	}
</style>
