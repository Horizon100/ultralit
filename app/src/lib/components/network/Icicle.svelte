<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';

  export let data: any;
  export let width = 928;
  export let height = 1200;
  export let scale = 1;

  const dispatch = createEventDispatcher();

  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let root: d3.HierarchyRectangularNode<any>;
  let color: d3.ScaleOrdinal<string, string>;

  // Stack to keep track of clicked nodes
  let clickedStack = [];

  $: if (data && svg) {
    updateChart();
  }

  $: if (scale !== 1) {
    updateZoom();
  }

  onMount(() => {
    svg = d3.select('#icicle-chart')
      .append('svg')
      .attr('viewBox', [0, 0, width, height])
      .attr('width', width)
      .attr('height', height)
      .attr('style', 'max-width: 100%; height: auto; font: 20px sans-serif;');

    updateChart();
  });

  function updateChart() {
    if (!svg || !data) return;

    svg.selectAll('*').remove();

    color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

    const hierarchy = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.height - a.height || b.value - a.value);

    root = d3.partition()
      .size([height, (hierarchy.height + 1) * width / 3])
      (hierarchy);

    const cell = svg
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y0},${d.x0})`);

    const rect = cell.append('rect')
      .attr('width', d => d.y1 - d.y0 - 1)
      .attr('height', d => rectHeight(d))
      .attr('fill-opacity', 0.6)
      .attr('fill', d => {
        if (!d.depth) return '#ccc';
        while (d.depth > 1) d = d.parent;
        return color(d.data.name);
      })
      .style('cursor', 'pointer')
      .on('click', clicked);

    const text = cell.append('text')
      .style('user-select', 'none')
      .attr('pointer-events', 'none')
      .attr('x', 4)
      .attr('y', 13)
      .attr('fill-opacity', d => +labelVisible(d));

    text.append('tspan')
      .text(d => d.data.name);

    const format = d3.format(',d');
    const tspan = text.append('tspan')
      .attr('fill-opacity', d => labelVisible(d) * 0.7)
      .text(d => ` ${format(d.value)}`);

    cell.append('title')
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join('/')}\n${format(d.value)}`);
  }

  function updateZoom() {
    if (!svg) return; // Ensure svg is defined before applying transformations
    svg.attr('transform', `scale(${scale})`);
    dispatch('zoom', { scale });
  }

  function clicked(event, p) {
    // Push the current root to the stack before zooming into the new root
    clickedStack.push(root);

    // Update root to the new clicked node
    root = p;

    const t = svg.transition().duration(750);
    root.each(d => d.target = {
      x0: (d.x0 - p.x0) / (p.x1 - p.x0) * height,
      x1: (d.x1 - p.x0) / (p.x1 - p.x0) * height,
      y0: d.y0 - p.y0,
      y1: d.y1 - p.y0
    });

    const cell = svg.selectAll('g');
    cell.transition(t)
      .attr('transform', d => `translate(${d.target.y0},${d.target.x0})`);

    cell.select('rect')
      .transition(t)
      .attr('height', d => rectHeight(d.target));

    cell.select('text')
      .transition(t)
      .attr('fill-opacity', d => +labelVisible(d.target));

    cell.select('tspan')
      .transition(t)
      .attr('fill-opacity', d => labelVisible(d.target) * 0.7);
  }

  // Function to go back to the previous hierarchy level
  function goBack() {
    if (clickedStack.length === 0) return;

    // Pop the last node from the stack
    root = clickedStack.pop();

    const t = svg.transition().duration(750);
    root.each(d => d.target = {
      x0: d.x0,
      x1: d.x1,
      y0: d.y0,
      y1: d.y1
    });

    const cell = svg.selectAll('g');
    cell.transition(t)
      .attr('transform', d => `translate(${d.target.y0},${d.target.x0})`);

    cell.select('rect')
      .transition(t)
      .attr('height', d => rectHeight(d.target));

    cell.select('text')
      .transition(t)
      .attr('fill-opacity', d => +labelVisible(d.target));

    cell.select('tspan')
      .transition(t)
      .attr('fill-opacity', d => labelVisible(d.target) * 0.7);
  }

  function rectHeight(d) {
    return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
  }

  function labelVisible(d) {
    return d.y1 <= width && d.y0 >= 0 && d.x1 - d.x0 > 16;
  }
</script>

<div id="icicle-chart"></div>
<button on:click={goBack}>Back</button>

<style>
  #icicle-chart {
    width: 90%;
    height: 100%;
    margin-left: 5%;
    overflow: hidden;
  }

  :global(.text) {
    font: 20px sans-serif;
  }

  button {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 10px;
    background-color: #007BFF;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  button:hover {
    background-color: #0056b3;
  }
</style>