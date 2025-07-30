<script lang="ts">
	export let name: string;
	export let size: number = 40;

	$: initials = name
		.split(' ')
		.map((word) => word[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

	$: backgroundColor = stringToColor(name);

	function stringToColor(str: string) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}
		let color = '#';
		for (let i = 0; i < 3; i++) {
			const value = (hash >> (i * 8)) & 0xff;
			color += ('00' + value.toString(16)).substr(-2);
		}
		return color;
	}
</script>

<div
	class="default-avatar"
	style="
      width: {size}px; 
      height: {size}px; 
      background-color: {backgroundColor};
      font-size: {size / 2}px;
    "
>
	{initials}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.default-avatar {
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 50%;
		color: white;
		font-weight: bold;
	}
</style>
