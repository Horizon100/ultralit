<script lang="ts">
	import { onMount } from 'svelte';
	import * as joint from '@joint/core';

	let paperContainer: HTMLElement;
	let graph: joint.dia.Graph;
	let paper: joint.dia.Paper;
	let selectedNode: joint.dia.Element | null = null;

	const nodePositions: { [key: string]: { x: number; y: number } } = {
		a: { x: 0, y: 50 },
		b: { x: 1, y: 0 },
		c: { x: 2, y: 100 },
		d: { x: 3, y: -50 },
		e: { x: 4, y: 50 },
		f: { x: 5, y: 150 },
		g: { x: 5, y: 250 },
		h: { x: 5, y: 200 },
		i: { x: -200, y: 100 },
		j: { x: -50, y: 50 },
		k: { x: 5, y: 300 },
		l: { x: 40, y: 400 },
		m: { x: 5, y: 400 }
	} as { [key: string]: { x: number; y: number } };

	const list = {
		a: ['b', 'c'],
		b: ['d', 'e'],
		c: ['f', 'g'],
		f: ['b'],
		e: ['c'],
		h: ['f', 'g'],
		i: ['h', 'a', 'd', 'g'],
		j: ['a'],
		k: ['l'],
		l: ['h'],
		m: ['l']
	};

	const nodeInfo = {
		a: 'Task Allocation AI: Distributes tasks efficiently among agents',
		b: 'Natural Language Processing AI: Understands and processes user commands',
		c: 'Context Analysis AI: Evaluates task context for optimal execution',
		d: 'Resource Management AI: Allocates system resources for tasks',
		e: 'Priority Assessment AI: Determines task urgency and importance',
		f: 'Conflict Resolution AI: Manages conflicts between tasks or agents',
		g: 'Performance Optimization AI: Improves overall system efficiency',
		h: 'User Interface AI: Creates intuitive interfaces for user interaction',
		i: 'Integration AI: Connects with external systems and APIs',
		j: 'Security AI: Ensures data protection and system integrity',
		k: 'Learning AI: Improves system performance over time',
		l: 'Feedback Analysis AI: Processes user feedback for system improvement',
		m: 'Report Generation AI: Creates comprehensive task reports'
	};

	let start: joint.dia.Element;
	let subgraph: joint.dia.Cell[];
	let hoverElement: HTMLElement;

	function setupEventListeners() {
		selectStart(graph.getCell('a') as joint.dia.Element);

		paper.on('element:pointerdown', ({ model: element }) => {
			selectStart(element as joint.dia.Element);
			highlightSubgraph([]);
			// resizeNode(element as joint.dia.Element);
		});

		paper.on('element:mouseenter', ({ model: end }) => {
			const between = getElementsBetween(start, end as joint.dia.Element);
			if (between.length > 0) {
				highlightSubgraph([start, end, ...between], true);
			} else {
				highlightSubgraph([start, end], graph.isNeighbor(start, end, { outbound: true }));
			}
			showHoverInfo(end as joint.dia.Element);
		});

		paper.on('element:mouseleave', () => {
			highlightSubgraph([]);
			hideHoverInfo();
		});

		// Add a blank space click listener to reset node size
		paper.on('blank:pointerdown', () => {
			if (selectedNode) {
				resizeNode(selectedNode, true);
			}
		});
	}

	function resizeNode(element: joint.dia.Element, reset: boolean = false) {
		const originalSize = 600;
		const expandedSize = 600;
		const duration = 300;

		if (selectedNode && selectedNode !== element) {
			// Reset the previously selected node
			resizeNode(selectedNode, true);
		}

		const newSize = reset ? originalSize : expandedSize;

		element.transition(
			'size',
			{ width: newSize, height: newSize },
			{
				duration: duration,
				easing: joint.util.timing.cubic
			}
		);

		// Update the label size
		element.attr('label/fontSize', reset ? 20 : 24, {
			duration: duration,
			easing: joint.util.timing.cubic
		});

		selectedNode = reset ? null : element;
	}

	function createNode(id: string): joint.dia.Element {
		const node = new joint.shapes.standard.Circle({
			id: id,
			size: { width: 30, height: 30 },
			attrs: {
				label: {
					text: id.toUpperCase(),
					fontSize: 20,
					fontFamily: 'sans-serif'
				},
				body: {
					fill: '#F3F7F6',
					stroke: '#2C3E50',
					strokeWidth: 2,
					boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
					cursor: 'pointer'
				}
			}
		});
		node.addTo(graph);
		return node;
	}

	onMount(() => {
		const { dia, shapes, V } = joint;

		graph = new dia.Graph({}, { cellNamespace: shapes });
		paper = new dia.Paper({
			el: paperContainer,
			model: graph,
			cellViewNamespace: shapes,
			width: '50%',
			height: '50%',
			async: true,
			sorting: dia.Paper.sorting.APPROX,
			background: { color: '#F3F7F6' },
			interactive: true,
			defaultConnectionPoint: { name: 'boundary' },
			defaultConnector: { name: 'smooth' },
			clickThreshold: 10
		});

		(Object.keys(list) as (keyof typeof list)[]).forEach((parent) => {
			const neighbors = list[parent];
			createNode(parent);
			neighbors.forEach((adj) => {
				if (!graph.getCell(adj)) createNode(adj);
				createLink(parent, adj);
			});
		});

		createCustomLayout(graph);
		centerGraph();
		addStyles();
		setupEventListeners();

		hoverElement = document.createElement('div');
		hoverElement.className = 'hover-info';
		hoverElement.style.display = 'none';
		paperContainer.appendChild(hoverElement);
	});

	function createCustomLayout(graph: joint.dia.Graph) {
		Object.entries(nodePositions).forEach(([id, position]) => {
			const cell = graph.getCell(id);
			if (cell && cell.isElement()) {
				cell.position(position.x, position.y);
			}
		});

		graph.getLinks().forEach((link) => {
			const sourceId = link.getSourceElement()?.id;
			const targetId = link.getTargetElement()?.id;
			if (sourceId && targetId) {
				const sourcePos = nodePositions[sourceId];
				const targetPos = nodePositions[targetId];
				if (sourcePos && targetPos) {
					const midX = (sourcePos.x + targetPos.x) / 2;
					const midY = (sourcePos.y + targetPos.y) / 2;
					link.vertices([{ x: midX, y: midY }]);
				}
			}
		});
	}

	function centerGraph() {
		const graphBBox = graph.getBBox();
		const paperWidth = paper.getComputedSize().width;
		const paperHeight = paper.getComputedSize().height;

		if (graphBBox) {
			const tx = (paperWidth - graphBBox.width) / 2 - graphBBox.x;
			const ty = (paperHeight - graphBBox.height) / 2 - graphBBox.y;

			graph.translate(tx, ty);
		}
	}

	function addStyles() {
		const styles = joint.V.createSVGStyle(`
        .joint-element .subgraph {
            stroke: #4666E5;
            fill: #4666E5;
            fill-opacity: 0.2;
        }
        .joint-element .no-subgraph {
            stroke: #FF4365;
            fill: #FF4365;
            fill-opacity: 0.2;
        }
        .joint-link .subgraph {
            stroke: #4666E5;
            stroke-dasharray: 5;
            stroke-dashoffset: 10;
            animation: dash 0.5s infinite linear;
        }
        @keyframes dash {
            to {
            stroke-dashoffset: 0;
            }
        }
        `);
		if (paper && paper.svg) {
			paper.svg.prepend(styles);
		}
	}

	function showHoverInfo(element: joint.dia.Element) {
		const elementView = element.findView(paper);
		const elementBBox = elementView.getBBox();
		const info = nodeInfo[element.id as keyof typeof nodeInfo];

		hoverElement.textContent = info;
		hoverElement.style.display = 'block';
		hoverElement.style.left = `${elementBBox.x + elementBBox.width / 2}px`;
		hoverElement.style.top = `${elementBBox.y - 60}px`;
	}

	function hideHoverInfo() {
		hoverElement.style.display = 'none';
	}

	function createLink(source: string, target: string): joint.dia.Link {
		const link = new joint.shapes.standard.Link({
			source: { id: source },
			target: { id: target },
			router: { name: 'manhattan' },
			connector: { name: 'rounded' },
			attrs: {
				line: {
					stroke: '#2C3E50',
					strokeWidth: 2
				}
			}
		});
		link.addTo(graph);
		return link;
	}

	function selectStart(element: joint.dia.Element) {
		const id = 'start-highlight';
		if (start) {
			joint.highlighters.mask.remove(start.findView(paper), id);
		}
		start = element;
		joint.highlighters.mask.add(element.findView(paper), 'body', id, {
			padding: 2,
			attrs: {
				stroke: '#4666E5',
				'stroke-width': 4
			}
		});
	}

	function highlightSubgraph(elements: joint.dia.Cell[], valid?: boolean) {
		const id = 'subgraph-highlighter';
		if (subgraph) {
			subgraph.forEach((cell) => {
				joint.highlighters.addClass.remove(cell.findView(paper), id);
			});
		}
		subgraph = graph.getSubgraph(elements);
		if (!valid) {
			subgraph.forEach((cell) => {
				joint.highlighters.addClass.add(cell.findView(paper), 'body', id, {
					className: 'no-subgraph'
				});
			});
		} else {
			subgraph.forEach((cell) => {
				joint.highlighters.addClass.add(cell.findView(paper), cell.isLink() ? 'line' : 'body', id, {
					className: 'subgraph'
				});
			});
		}
	}

	function getElementsBetween(
		start: joint.dia.Element,
		end: joint.dia.Element
	): joint.dia.Element[] {
		const start2end = getSuccessors(start, end);
		const end2start = getPredecessors(end, start);
		const intersection = new Set<joint.dia.Element>();
		start2end.forEach((element) => {
			if (end2start.includes(element)) {
				intersection.add(element);
			}
		});
		return Array.from(intersection);
	}

	function getElements(
		element: joint.dia.Element,
		terminator: joint.dia.Element,
		opt: { outbound?: boolean; inbound?: boolean }
	): joint.dia.Element[] {
		const res: joint.dia.Element[] = [];
		graph.search(
			element,
			(el) => {
				if (el !== element) {
					res.push(el as joint.dia.Element);
				}
				if (el === terminator) {
					return false;
				}
				return true; // Add this line to ensure a boolean value is always returned
			},
			opt
		);
		return res;
	}

	function getSuccessors(
		element: joint.dia.Element,
		terminator: joint.dia.Element
	): joint.dia.Element[] {
		return getElements(element, terminator, { outbound: true });
	}

	function getPredecessors(
		element: joint.dia.Element,
		terminator: joint.dia.Element
	): joint.dia.Element[] {
		return getElements(element, terminator, { inbound: true });
	}
</script>

<div bind:this={paperContainer} id="paper-container"></div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	#paper-container {
		/* width: 100%; */
		/* height: 600px; */
		position: relative;
		overflow: hidden;
		border-radius: 500px;
		border: 10px solid #f3f7f6;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
	}

	:global(.joint-element) {
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	:global(.hover-info) {
		position: absolute;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 10px 15px;
		border-radius: 5px;
		font-size: 14px;
		max-width: 250px;
		text-align: center;
		transform: translateX(-50%);
		z-index: 1000;
		pointer-events: none;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	:global(.hover-info::after) {
		content: '';
		position: absolute;
		bottom: -10px;
		left: 50%;
		transform: translateX(-50%);
		border-width: 10px 10px 0;
		border-style: solid;
		border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
	}
</style>
