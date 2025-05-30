// Test data for Icicle chart component
export const icicleTestData = {
	name: "Company",
	children: [
		{
			name: "Engineering",
			children: [
				{
					name: "Frontend",
					children: [
						{ name: "React Team", value: 15 },
						{ name: "Vue Team", value: 8 },
						{ name: "Svelte Team", value: 12 }
					]
				},
				{
					name: "Backend",
					children: [
						{ name: "Node.js Team", value: 20 },
						{ name: "Python Team", value: 18 },
						{ name: "Go Team", value: 10 }
					]
				},
				{
					name: "DevOps",
					children: [
						{ name: "Infrastructure", value: 14 },
						{ name: "CI/CD", value: 6 },
						{ name: "Security", value: 8 }
					]
				}
			]
		},
		{
			name: "Product",
			children: [
				{
					name: "Design",
					children: [
						{ name: "UX Design", value: 12 },
						{ name: "UI Design", value: 10 },
						{ name: "Research", value: 6 }
					]
				},
				{
					name: "Management",
					children: [
						{ name: "Product Managers", value: 8 },
						{ name: "Project Managers", value: 5 },
						{ name: "Analysts", value: 7 }
					]
				}
			]
		},
		{
			name: "Sales & Marketing",
			children: [
				{
					name: "Sales",
					children: [
						{ name: "Enterprise Sales", value: 15 },
						{ name: "SMB Sales", value: 12 },
						{ name: "Customer Success", value: 10 }
					]
				},
				{
					name: "Marketing",
					children: [
						{ name: "Digital Marketing", value: 8 },
						{ name: "Content Marketing", value: 6 },
						{ name: "Brand Marketing", value: 4 }
					]
				}
			]
		},
		{
			name: "Operations",
			children: [
				{
					name: "HR",
					children: [
						{ name: "Recruitment", value: 6 },
						{ name: "People Ops", value: 4 },
						{ name: "Learning & Dev", value: 3 }
					]
				},
				{
					name: "Finance",
					children: [
						{ name: "Accounting", value: 5 },
						{ name: "Financial Planning", value: 4 },
						{ name: "Legal", value: 3 }
					]
				}
			]
		}
	]
};

// Alternative simpler test data
export const simpleTestData = {
	name: "Root",
	children: [
		{
			name: "Branch A",
			children: [
				{ name: "Leaf A1", value: 100 },
				{ name: "Leaf A2", value: 200 },
				{ name: "Leaf A3", value: 150 }
			]
		},
		{
			name: "Branch B",
			children: [
				{ name: "Leaf B1", value: 300 },
				{ name: "Leaf B2", value: 250 }
			]
		},
		{
			name: "Branch C",
			value: 180
		}
	]
};

// File system example
export const fileSystemData = {
	name: "src",
	children: [
		{
			name: "components",
			children: [
				{
					name: "charts",
					children: [
						{ name: "Icicle.svelte", value: 250 },
						{ name: "BarChart.svelte", value: 180 },
						{ name: "LineChart.svelte", value: 220 }
					]
				},
				{
					name: "ui",
					children: [
						{ name: "Button.svelte", value: 80 },
						{ name: "Modal.svelte", value: 150 },
						{ name: "Input.svelte", value: 120 }
					]
				}
			]
		},
		{
			name: "routes",
			children: [
				{ name: "+layout.svelte", value: 100 },
				{ name: "+page.svelte", value: 200 },
				{
					name: "dashboard",
					children: [
						{ name: "+page.svelte", value: 300 },
						{ name: "+layout.svelte", value: 150 }
					]
				}
			]
		},
		{
			name: "lib",
			children: [
				{ name: "utils.ts", value: 180 },
				{ name: "stores.ts", value: 120 },
				{ name: "api.ts", value: 250 }
			]
		}
	]
};