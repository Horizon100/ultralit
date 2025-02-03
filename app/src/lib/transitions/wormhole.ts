import { cubicInOut } from 'svelte/easing';

export function wormhole(node: HTMLElement, { duration = 1000, delay = 0, easing = cubicInOut }) {
	const style = getComputedStyle(node);
	const transform = style.transform === 'none' ? '' : style.transform;

	return {
		delay,
		duration,
		easing,
		css: (t: number, u: number) => `
      transform: ${transform} scale(${t});
      opacity: ${t};
      filter: blur(${u * 20}px);
    `
	};
}
