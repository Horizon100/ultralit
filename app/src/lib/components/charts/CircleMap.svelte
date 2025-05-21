<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface DataNode {
		name: string;
		value?: number;
		children?: DataNode[];
	}

	let d3Container: SVGSVGElement;

	onMount(() => {
		const data: DataNode = {
			name: 'root',
			children: [
				{
					name: 'level 1: A',
					children: [
						{ name: 'level 2: A1', value: 100 },
						{ name: 'level 2: A2', value: 300 },
						{
							name: 'level 2: B2',
							children: [
								{ name: 'level 3: B2-1', value: 77 },
								{ name: 'level 3: B2-2', value: 100 }
							]
						}
					]
				},
				{
					name: 'level 1: B',
					children: [
						{ name: 'level 2: B1', value: 700 },
						{
							name: 'level 2: B2',
							children: [
								{ name: 'level 3: B2-1', value: 100 },
								{ name: 'level 3: B2-2', value: 200 }
							]
						}
					]
				}
			]
		};

		const width = 928;
		const height = width;

		const color = d3
			.scaleLinear<string>()
			.domain([0, 5])
			.range(['hsl(152,80%,80%)', 'hsl(228,30%,40%)'])
			.interpolate(d3.interpolateHcl);

		const pack = (data: DataNode) =>
			d3.pack<DataNode>().size([width, height]).padding(3)(
				d3
					.hierarchy(data)
					.sum((d) => d.value || 0)
					.sort((a, b) => (b.value || 0) - (a.value || 0))
			);

		const root = pack(data);

		const svg = d3
			.select(d3Container)
			.attr('viewBox', `-${width / 2} -${height / 2} ${width} ${height}`)
			.attr('width', width)
			.attr('height', height)
			.attr(
				'style',
				`max-width: 100%; height: auto; display: block; margin: 0 -14px; background: ${color(0)}; cursor: pointer;`
			);

		const node = svg
			.append('g')
			.selectAll('circle')
			.data(root.descendants().slice(1))
			.join('circle')
			.attr('fill', (d) => (d.children ? color(d.depth) : 'white'))
			.attr('pointer-events', (d) => (!d.children ? 'none' : null))
			.on('mouseover', function () {
				d3.select(this).attr('stroke', '#000');
			})
			.on('mouseout', function () {
				d3.select(this).attr('stroke', null);
			})
			.on('click', (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));

		const label = svg
			.append('g')
			.style('font', '16px sans-serif inter')
			.attr('pointer-events', 'none')
			.attr('text-anchor', 'middle')
			.selectAll('text')
			.data(root.descendants())
			.join('text')
			.style('fill-opacity', (d) => (d.parent === root ? 1 : 0))
			.style('display', (d) => (d.parent === root ? 'inline' : 'none'))
			.text((d) => d.data.name);

		svg.on('click', (event) => zoom(event, root));

		let focus = root;
		let view: [number, number, number];

		const zoomTo = (v: [number, number, number]) => {
			const k = width / v[2];
			view = v;

			label.attr('transform', (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
			node.attr('transform', (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
			node.attr('r', (d) => d.r * k);
		};

		const zoom = (event: any, d: any) => {
			const focus0 = focus;
			focus = d;

			const transition = svg
				.transition()
				.duration(event.altKey ? 7500 : 750)
				.tween('zoom', () => {
					const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 1]);
					return (t: number) => zoomTo(i(t));
				});

			label
				.filter(function (d) {
					return d.parent === focus || this.style.display === 'inline';
				})
				.transition(transition as any)
				.style('fill-opacity', (d) => (d.parent === focus ? 1 : 0))
				.on('start', function (d) {
					if (d.parent === focus) this.style.display = 'inline';
				})
				.on('end', function (d) {
					if (d.parent !== focus) this.style.display = 'none';
				});
		};

		zoomTo([focus.x, focus.y, focus.r * 2]);
	});
</script>

<div class="d3-window">
	<svg class="d3-container" bind:this={d3Container}></svg>
</div>

<style>
	.d3-window {
		width: 100%;
		height: 100%;
	}

	.d3-container {
		width: 100%;
		height: 100%;
	}
</style>
