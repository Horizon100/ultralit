<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		Square,
		Circle,
		Triangle,
		Star,
		Hexagon,
		Pencil,
		CheckSquare,
		Database,
		Mic,
		Calculator,
		Box
	} from 'lucide-svelte';
	import AgentThumbnail from '$lib/assets/agent-thumbnail.svg';
	import Controls from '$lib/assets/icons/ai/controls.svg';
	import Compass from '$lib/assets/icons/map/compass.svg';

	import type { Shape } from '$lib/types/types'; // Import Shape from your types file
	export let startPoint: string;
	export let endPoint: string;

	const dispatch = createEventDispatcher<{
		addShape: { shape: Shape; x: number; y: number };
	}>();

	interface Category {
		name: string;
		shapes: Shape[];
	}

	const categories: Category[] = [
		{
			name: 'Agents',
			shapes: [
				{
					id: 'Agent',
					svg: `
                        <svg width="120" height="150" viewBox="0 0 100 100">

                            <rect width="120" height="120" fill="transparent" rx="5" ry="5" />
                            <image href="${Controls}" x="0" y="0" width="150" height="150"/>
                            <text x="30" y="10" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Agent</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle agent">
                                <img src="${Controls}" alt="Agent controls" />
                                <span>Agent</span>
                            </div>
                        `,
						style: `
                            .shape.rectangle.agent {
                                width: 120px;
                                height: 120px;
                                // background-color: #111111;
                                // border-top-left-radius: 70px;
                                // border-top-right-radius: 70px;
                                // border-bottom-left-radius: 0px;
                                // border-bottom-right-radius: 80px;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: space-between;
                                padding: 10px;
                                // border: 4px solid #333333;
                                // border-style:outset;
                                user-select: none;


                            }
                            .shape.rectangle.agent img {
                                width: 100px;
                                height: 100px;
                                user-select: none;

                            }
                            .shape.rectangle.agent span {
                                color: white;
                                font-size: 18px;
                                user-select: none;

                            }
                        `
					}
				},
				{
					id: 'Test',
					svg: `
                        <svg width="120" height="150" viewBox="0 0 100 100">

                            <rect width="120" height="120" fill="transparent" rx="5" ry="5" />
                            <image href="${Compass}" x="0" y="0" width="150" height="150"/>
                            <text x="30" y="10" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Agent</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle agent">
                                <img src="${Compass}" alt="Agent controls" />
                                <span>Agent</span>
                            </div>
                        `,
						style: `
                            .shape.rectangle.agent {
                                width: 120px;
                                height: 120px;
                                // background-color: #111111;
                                // border-top-left-radius: 70px;
                                // border-top-right-radius: 70px;
                                // border-bottom-left-radius: 0px;
                                // border-bottom-right-radius: 80px;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: space-between;
                                padding: 10px;
                                // border: 4px solid #333333;
                                // border-style:outset;

                            }
                            .shape.rectangle.agent img {
                                width: 100px;
                                height: 100px;
                            }
                            .shape.rectangle.agent span {
                                color: white;
                                font-size: 18px;
                            }
                        `
					}
				}
			]
		},
		{
			name: 'Tools',
			shapes: [
				// Sticker
				{
					id: 'Sticker',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#FFD700" rx="5" ry="5" />
                            <foreignObject width="120" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; overflow: hidden;">
                                    Write your note here...
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="black" text-anchor="middle">Sticker</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle sticker">
                                <textarea placeholder="Write your note here..."></textarea>
                            </div>
                        `,
						style: `
                            .shape.rectangle.sticker {
                                width: 150px;
                                height: 150px;
                                background-color: #FFD700;
                                border-radius: 5px;
                                padding: 10px;
                            }
                            .shape.rectangle.sticker textarea {
                                width: 100%;
                                height: 100%;
                                border: none;
                                background: transparent;
                                resize: none;
                                font-family: Arial;
                                font-size: 14px;
                            }
                        `
					}
				},
				// TaskTracker
				{
					id: 'TaskTracker',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#3498db" rx="5" ry="5" />
                            <foreignObject width="130" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; color: white;">
                                    [ ] Task 1<br>
                                    [x] Task 2<br>
                                    [ ] Task 3
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Task Tracker</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle task-tracker">
                                <ul>
                                    <li><input type="checkbox"> Task 1</li>
                                    <li><input type="checkbox" checked> Task 2</li>
                                    <li><input type="checkbox"> Task 3</li>
                                </ul>
                            </div>
                        `,
						style: `
                            .shape.rectangle.task-tracker {
                                width: 150px;
                                height: 150px;
                                background-color: #3498db;
                                border-radius: 5px;
                                padding: 10px;
                                color: white;
                            }
                            .shape.rectangle.task-tracker ul {
                                list-style-type: none;
                                padding: 0;
                            }
                            .shape.rectangle.task-tracker li {
                                margin-bottom: 5px;
                            }
                        `
					}
				},
				// Calculator
				{
					id: 'Calculator',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#34495e" rx="5" ry="5" />
                            <foreignObject width="130" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; color: white; display: flex; justify-content: center; align-items: center; height: 100%;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><line x1="4" y1="10" x2="20" y2="10"></line><line x1="10" y1="4" x2="10" y2="20"></line></svg>
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Calculator</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle calculator">
                                <Calculator size={64} />
                            </div>
                        `,
						style: `
                            .shape.rectangle.calculator {
                                width: 150px;
                                height: 150px;
                                background-color: #34495e;
                                border-radius: 5px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                color: white;
                            }
                        `
					}
				}
			]
		},
		{
			name: 'Infrastructure',
			shapes: [
				// ResourceManager
				{
					id: 'ResourceManager',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#e74c3c" rx="5" ry="5" />
                            <foreignObject width="130" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; color: white;">
                                    CPU: 50%<br>
                                    RAM: 4GB<br>
                                    Disk: 100GB
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Resource Manager</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle resource-manager">
                                <div>CPU: 50%</div>
                                <div>RAM: 4GB</div>
                                <div>Disk: 100GB</div>
                            </div>
                        `,
						style: `
                            .shape.rectangle.resource-manager {
                                width: 150px;
                                height: 150px;
                                background-color: #e74c3c;
                                border-radius: 5px;
                                padding: 10px;
                                color: white;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-around;
                            }
                        `
					}
				},
				// Database
				{
					id: 'Database',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#9b59b6" rx="5" ry="5" />
                            <foreignObject width="130" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; color: white;">
                                    Table 1<br>
                                    Table 2<br>
                                    Table 3
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Database</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle database">
                                <div>Table 1</div>
                                <div>Table 2</div>
                                <div>Table 3</div>
                            </div>
                        `,
						style: `
                            .shape.rectangle.database {
                                width: 150px;
                                height: 150px;
                                background-color: #9b59b6;
                                border-radius: 5px;
                                padding: 10px;
                                color: white;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-around;
                            }
                        `
					}
				}
			]
		},
		{
			name: 'Rooms',
			shapes: [
				// VoiceRoom
				{
					id: 'VoiceRoom',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#f39c12" rx="5" ry="5" />
                            <foreignObject width="130" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; color: white; display: flex; justify-content: center; align-items: center; height: 100%;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Voice Room</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle voice-room">
                                <Mic size={64} />
                            </div>
                        `,
						style: `
                            .shape.rectangle.voice-room {
                                width: 150px;
                                height: 150px;
                                background-color: #f39c12;
                                border-radius: 5px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                color: white;
                            }
                        `
					}
				},
				// Room
				{
					id: 'Room',
					svg: `
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            <rect width="150" height="150" fill="#1abc9c" rx="5" ry="5" />
                            <foreignObject width="130" height="130" x="10" y="10">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 14px; color: white; display: flex; justify-content: center; align-items: center; height: 100%;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3zM12 8v8"></path><path d="M8 12h8"></path></svg>
                                </div>
                            </foreignObject>
                            <text x="75" y="135" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Room</text>
                        </svg>
                    `,
					component: {
						template: `
                            <div class="shape rectangle room">
                                <Box size={64} />
                            </div>
                        `,
						style: `
                            .shape.rectangle.room {
                                width: 150
                                height: 150px;
                background-color: #1abc9c;
                border-radius: 5px;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
            }
        `
					}
				}
			]
		}
	];

	let expandedCategories: { [key: string]: boolean } = {};
	categories.forEach((category) => {
		expandedCategories[category.name] = category.name === 'Agents'; // Open Agents by default
	});

	function toggleCategory(categoryName: string) {
		expandedCategories[categoryName] = !expandedCategories[categoryName];
	}

	function handleDragStart(event: DragEvent, shape: Shape) {
		if (event.dataTransfer) {
			const shapeData = JSON.stringify(shape);
			event.dataTransfer.setData('application/json', shapeData);
			event.dataTransfer.effectAllowed = 'copy';
			console.log('Drag started with shape data:', shapeData);
		}
	}

	function handleClick(shape: Shape) {
		const x = 100;
		const y = 100;
		dispatch('addShape', { shape, x, y });
	}
</script>

<div class="assets-container">
	<h2>Shapes</h2>
	<div class="accordion">
		{#each categories as category}
			<div class="category">
				<button class="category-header" on:click={() => toggleCategory(category.name)}>
					{category.name}
					<span class="expand-icon">{expandedCategories[category.name] ? '▼' : '▶'}</span>
				</button>
				{#if expandedCategories[category.name]}
					<div class="shapes-grid" transition:slide={{ duration: 300 }}>
						{#each category.shapes as shape (shape.id)}
							<div
								class="shape-item"
								draggable="true"
								on:dragstart={(e) => handleDragStart(e, shape)}
								on:click={() => handleClick(shape)}
							>
								{@html shape.svg}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.assets-container {
		padding: 1rem;
		user-select: none;
	}

	h2 {
		color: white;
		margin-bottom: 1rem;
	}

	.accordion {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	image {
		width: 100%;
		height: 100%;
	}

	.category-header {
		width: 100%;
		text-align: left;
		padding: 0.5rem;
		background-color: rgba(255, 255, 255, 0.1);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: background-color 0.3s ease;
	}

	.category-header:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.expand-icon {
		font-size: 0.8em;
	}

	.shapes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
		padding: 1rem;
		background-color: rgba(255, 255, 255, 0.05);
	}

	.shape-item {
		cursor: move;
		transition: transform 0.3s ease;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 10px;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.shape-item:hover {
		transform: scale(1.05);
		background-color: rgba(255, 255, 255, 0.2);
	}

	svg {
		width: 100%;
		height: 100%;
		transition: transform 0.3s ease;
	}

	.shape-item:hover svg {
		transform: scale(1.05);
	}
</style>
