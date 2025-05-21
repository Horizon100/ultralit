import { Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge } from 'lucide-svelte';

export default {
	nav: {
		home: 'Home',
		chat: 'Chat',
		tasks: 'Tasks',
		game: 'Game',
		canvas: 'Canvas',
		ask: 'Ask',
		build: 'Build',
		notes: 'Notes',
		features: 'Features',
		pricing: 'Pricing',
		integrations: 'Integrations',
		comparison: 'Compare',
		blog: 'Blog',
		help: 'Help',
		docs: 'Docs',
		themes: 'Switch themes',
		search: 'Search',
		searchEverything: 'Search everything...',
		searchProjects: 'Search projects...',
		welcome: 'Welcome',
		signup: 'Sign Up',
		quickAccess: 'Quick Access'
	},
	generic: {
		created: "Created",
		updated: "Updated",
		delete: "Delete",
		cancel: "Cancel",
		back: "Back",
		loading: "Loading...",
		deleteQuestion: "Are you sure you want to delete this?",
		deleteWarning: "This action cannot be undone.",
		attachments: "Attachments",
		show: "Show",
		only: "only",
		all: "all",
		filter: "Filter",
		sort: "Sort",
		share: "Share",
		copy: "Copy",
		copyLink: "Copy link",
		copiedLink: "Link copied!",
		returnHome: "Return home",
		signInTo: "Sign in to",
		this: "this",
		userNotLoggedIn: "User not logged in",
		noResults: "No results found for",
		in: "in",
		by: "by",
		collapse: 'Collapse',
		collapseAll: 'Collapse all',
		expand: 'Expand',
		expandAll: 'Expand all'
	},
	posts: {
		loginPrompt: 'Please sign in to create a post.',
		loadingPosts: 'Loading posts...',
		latestUpdates: 'Latest Updates',
		noPosts: 'No posts yet.',
		repost: 'Repost',
		reposted: 'reposted',
		repostedBy: 'Reposted by',
		youReposted: 'You reposted this',
		post: 'post', 
		posts: 'Posts', 
		postsFrom: 'posts from',
		postRead: 'read',
		postUpvote: 'Like',
		quote: 'Quote',
		quoteDescription: 'Add your thoughts and share',
		quoteNotAvailable: 'Quoted post not available',
		quotedBy: 'Quoted by',
		shareLink: 'Share with a link',
		copyLink: "Copy link to post",
		textareaPlaceholder: 'What´s on your mind?',
		postButton: 'Post',
		posting: 'Posting...',
		errorExpression: 'Oops!',
		errorComment: 'Error posting comment:',
		addingComment: 'Adding comment:',
		followUser: 'Follow user',
		reply: 'Reply',
		replies: 'Replies',
		replyToThis: 'Reply to this post...',
		noReplies: 'No replies',
		interactPrompt: 'Please sign in to interact with posts',
		media: 'media',
		likes: 'Likes',
		historySignin: 'Sign in to browse this user`s complete post history',
		seeAll: 'See all',
	},
	lang: {
		notification: 'Language: English',
		flag: '🇬🇧'
	},
	guidance: {
        productivity: [
            "🚀 Unlock 10x productivity with AI-powered task generation!",
            "🤔 Did you know AI can automatically create kanban boards from your conversations?",
            "💡 Pro tip: Connect your calendar to AI agents for seamless task scheduling"
        ],
        aiPowerTips: [
            "🎯 This one weird trick will revolutionize your workflow instantly!",
            "🧐 Did you know you can toggle AI responses on/off mid-conversation?",
            "✨ Hint: Control AI response frequency to match your work style perfectly"
        ],
        projectMastery: [
            "🔥 Nobody tells you about this hidden feature until it's too late!",
            "🤯 Did you know each project unlocks exclusive AI agent capabilities?",
            "💫 Secret: Use project workspaces to create hyper-specialized AI assistants"
        ],
        timeSaving: [
            "⏰ Save 40+ hours a week with these bookmarking hacks!",
            "🎨 Did you know you can theme your workspace for maximum focus?",
            "🚄 Game changer: Use prompt shortcuts to eliminate repetitive typing"
        ]
    },
	tooltip: {
		newProject: 'Create project',
		newThread: 'Create discussion',
		findThread: 'Find discussion',
		pauseAi: "AI responses off",
		playAi: "AI responses on",
		edit: "Edit",
		editDescription: "Edit description",
		generateHints: "Generate/refresh AI tips",
		done: "Done"
	},
	drawer: {
		project: 'Projects',
		thread: 'Discussions',
		sort: [
			{
			newest: 'Newest',
			oldest: 'Oldest',
			alpha_asc: 'Sort A to Z',
			alpha_desc: 'Sort Z to A',
			count_high: 'Most Messages',
			count_low: 'Least Messages',
			users_asc: 'Most Members',
			users_desc: 'Least Members'
			}
		],
	},

	landing: {
		h1: 'LEVEL UP YOUR CONVERSATIONS WITH AI',
		h2: 'Hello',
		cta: 'Get Started',
		subscribing: 'Subscribe',
		usercount: 'users',
		introText:
			"vRazum makes collaborating fun and seamless, whether you're brainstorming with friends or building a global community. Customize your space to chat, create, and work together in real time.",
		productivityTips: [
			'Use AI to brainstorm ideas and overcome creative blocks.',
			'Leverage LLMs for quick research summaries on complex topics.',
			'Automate routine tasks with AI agents to focus on high-value work.',
			'Utilize AI-powered writing assistants to improve your communication.',
			'Create personalized learning plans with AI to upskill efficiently.',
			'Use AI for data analysis to uncover insights and make informed decisions.',
			'Implement AI-driven time management tools to optimize your schedule.',
			'Employ AI chatbots for customer service to save time and improve response rates.',
			'Use AI to proofread and edit your documents for error-free work.',
			'Leverage AI for market research and trend analysis to stay ahead of the curve.',
			'Utilize AI-powered translation tools to break language barriers in global projects.',
			'Implement AI-driven project management tools for better task allocation and deadlines.',
			'Use AI to generate code snippets and accelerate software development.',
			'Employ AI for personalized content recommendations to stay updated in your field.',
			'Utilize AI-powered voice assistants for hands-free task management.',
			'Leverage AI for financial forecasting and budget optimization.',
			'Use AI-driven tools for social media management and content creation.',
			'Implement AI for predictive maintenance to prevent workflow disruptions.',
			'Utilize AI for rapid prototyping and design iterations.',
			'Employ AI-powered analytics to track and improve your productivity metrics.'
		],
		textplaceholder: "What's on your mind?"
	},
	appFeatures: {
		items: [
		{
			title: 'AI Conversations',
			description: 'Start intelligent chats with our AI system'
		},
		{
			title: 'Project Collaboration',
			description: 'Create projects and invite teammates'
		},
		{
			title: 'Task Management',
			description: 'Organize and track your work efficiently'
		},
		{
			title: 'Knowledge Network',
			description: 'Connect your ideas in a visual network'
		},
		{
			title: 'Notes System',
			description: 'Keep your thoughts organized and accessible'
		}
		]
	},
	features: {
		homeIntro: {
			title: 'Key Features',
		},
		title: 'Features',
		cards: [
			{
				title: 'Advanced AI-powered conversations',
				features: [
					'Natural language processing',
					'Contextual understanding',
					'Multi-turn conversations',
					'Custom AI models',
					'Sentiment analysis'
				],
				isPro: true
			},
			{
				title: 'Real-time collaboration tools',
				features: [
					'Shared workspaces',
					'Live editing',
					'Version control',
					'Comment threads',
					'Task assignments'
				],
				isPro: false
			},
			{
				title: 'Customizable workspace',
				features: [
					'Personalized layouts',
					'Theme customization',
					'Widget integration',
					'Keyboard shortcuts',
					'Custom branding options'
				],
				isPro: true
			},
			{
				title: 'Integrated project management',
				features: [
					'Kanban boards',
					'Gantt charts',
					'Time tracking',
					'Resource allocation',
					'Automated reports'
				],
				isPro: false
			},
			{
				title: 'Secure data encryption',
				features: [
					'End-to-end encryption',
					'Two-factor authentication',
					'Regular security audits',
					'Compliance certifications',
					'Data backup and recovery'
				],
				isPro: true
			},
			{
				title: 'Advanced analytics',
				features: [
					'Real-time dashboards',
					'Custom report builder',
					'Data visualization tools',
					'Predictive analytics',
					'Integration with BI tools'
				],
				isPro: true
			}
		]
	},

	extras: {
		greetings: [
			"Hello",
			"Hey",
			"Hi",
			"Greetings",
			"Welcome back",
			"Good to see you",
			"Nice to have you here",
			"Howdy",
			"Salutations",
			"Hi there",
		],
		questions: [
			"What's on your mind?",
			"How can I help?",
			"What’s new with you?",
			"Ready to dive in?",
			"What’s the plan today?",
			"What’s inspiring you right now?",
			"How’s your day going?",
			"What’s your thought of the hour?",
			"Need a digital sidekick today?",
			"What’s cooking in your world?",
		],
		quotes: [
			'The question of whether a computer can think is no more interesting than the question of whether a submarine can swim. - Edsger W. Dijkstra',
			'Computer science is no more about computers than astronomy is about telescopes. - Edsger W. Dijkstra',
			'The most profound technologies are those that disappear. They weave themselves into the fabric of everyday life until they are indistinguishable from it. - Mark Weiser',
			'We can only see a short distance ahead, but we can see plenty there that needs to be done. - Alan Turing',
			'The goal of science is to build better mousetraps. The goal of nature is to build better mice. - Mark Twain',
			'The limits of my language mean the limits of my world. - Ludwig Wittgenstein',
			'Knowledge is power. - Francis Bacon',
			'I think, therefore I am. - René Descartes',
			'The unexamined life is not worth living. - Socrates',
			'To know, is to know that you know nothing. That is the meaning of true knowledge. - Socrates'
		],
		thinking: [
			'Consulting my digital crystal ball...',
			'Asking the oracle of ones and zeros...',
			'Summoning the spirits of Silicon Valley...',
			'Decoding the matrix...',
			'Channeling the ghost in the machine...',
			'Pondering the meaning of artificial life...',
			'Calculating the answer to life, the universe, and everything...',
			'Divining the digital tea leaves...',
			'Consulting the sacred scrolls of binary...',
			'Communing with the AI hive mind...'
		]
	},

	pricing: {
		title: 'Pricing',
		plans: [
			{
				name: 'Basic',
				description: 'For personal or non-commercial projects',
				price: '$0',
				month: '/month',
				button: 'Try Now',
				features: ['Up to 3000 tokens per day', 'Basic AI features']
			},
			{
				name: 'Pro',
				description: 'For founders and teams in early stage companies',
				price: '$14.99',
				month: '/month',
				button: 'Subscribe',

				features: ['Access to multi-agent tools', '50GB storage']
			},
			{
				name: 'Enterprise',
				description: 'For companies looking for customized AI solutions',
				price: 'Contact us',
				month: '',
				button: 'Submit',
				features: ['Unlimited users', 'Custom AI solutions', 'Unlimited storage']
			}
		]
	},
	ui: {
		styles: [
			{
				name: 'Classic',
				value: 'default',
				icon: Sun,
				description: 'This style will brighten your day',
				dummyContent: 'Sunshine and clear skies'
			},
			{
				name: 'Dark',
				value: 'dark',
				icon: Moon,
				description: 'For night owls and stargazers',
				dummyContent: 'Moonlit adventures await'
			},
			{
				name: 'Light',
				value: 'light',
				icon: Sunrise,
				description: 'Start your day with a fresh look',
				dummyContent: 'Early bird gets the worm'
			},
			{
				name: 'Sunset',
				value: 'sunset',
				icon: Sunset,
				description: 'Wind down with warm hues',
				dummyContent: 'Golden hour vibes'
			},
			{
				name: 'Focus',
				value: 'focus',
				icon: Focus,
				description: 'Minimize distractions, maximize productivity',
				dummyContent: 'Concentration intensifies'
			},
			{
				name: 'Bold',
				value: 'bold',
				icon: Bold,
				description: 'Make a statement with vibrant colors',
				dummyContent: 'Stand out from the crowd'
			},
			{
				name: 'Turbo',
				value: 'turbo',
				icon: Gauge,
				description: 'Speed up your workflow',
				dummyContent: 'Faster than the speed of light'
			},
			{
				name: 'Bone',
				value: 'bone',
				icon: Gauge,
				description: 'Speed up your workflow',
				dummyContent: 'Faster than the speed of light'
			}
		]
	},
	dates: {
		day: 'day',
		days: 'days',
		dayAgo: 'day ago',
		daysAgo: 'days ago',
		monthAgo: "month ago",
		monthsAgo: "months ago",
		yearAgo: "year ago",
		yearsAgo: "years ago",
		today: "Today",
		tomorrow: "Tomorrow",
		endWeek: "End of Week",
		week: "week",
		weeks: "weeks",
		month: "month",
		months: "months",
		now: "Now",
	},

	tasks: {
		title: 'Tasks',
		task: 'task',
		tasks: 'tasks',
		status: 'Status',
		addDescription: 'Click to add a description',
		changePriority: 'Click to change priority',
		priorityLow: "Low",
		priorityMedium: "Medium",
		priorityHight: "High",
		deadline: "Deadline",
		start: "Start",
		subtasks: "Subtasks",
		backlog: "Backlog",
		todo: "To-Do",
		inprogress: "In Progress",
		review: "Review",
		done: "Ready",
		hold: "Delayed",
		postpone: "Postpone",
		postponed: "Postponed",
		delegate: "Delegate",
		cancelled: "Cancelled",
		archive: "Archive",
		selectStart: "Set start date",
		selectEnd: "Set end date",
		due: "Due",
		parent: "parent",
		assigned: 'Assigned',
		notAssigned: 'Not assigned',
		schedule: 'Schedule',
		gantt: 'Taskflows',
		add: 'Add a task',
	},

	dashboard: {
		title: 'Reports',
		nameThreads: 'total threads',
		nameMessages: 'total messages',
		nameTasks: 'total tasks',
		nameTags: 'tags',
		nameTimer: 'time spent',
		nameActive: 'Last Active:',
		perks: 'Achievements',
		projectInfo: 'Info',
		projectDetails: 'Logs',
		projectStats: 'Stats',
		projectMembers: 'Members',
		projectCollaborators: 'Collaborators',
		projectActivity: 'Activities',
		projectSuggestions: 'Suggestions',
		projectDescription: 'Description'
	},

	threads: {
		selectThread: 'Hello,',
		newThread: 'New chat',
		newTag: 'Add tag',
		tagsHeader: 'Tags',
		today: 'Today',
		yesterday: 'Yesterday',
		lastweek: 'Last Week',
		thismonth: 'This Month',
		older: 'Older',
		threadHeader: 'Discussions',
		updated: 'Updated',
		shared: 'People',
		thread: 'Thread',
		threads: 'Threads'
	},

	chat: {
		placeholder: 'Message Vrazum',
		manualPlaceholder: 'Send message...',
		loading: 'Loading messages...',
		message: 'Message',
		messages: 'Messages',
		messagecount: 'messages',
		prompts: 'Prompts',
		models: 'Models'
	},

	profile: {
		name: 'Name',
		username: 'Username',
		email: 'Email',
		emailReset: 'Your email for password recovery',
		resetEmailSent: 'Recovery link sent.',
		password: 'Password',
		passwordHelp: 'Forgot password?',
		reset: 'Reset',
		role: 'Role',
		created: 'Created',
		updated: 'Updated',
		verified: 'Verified',
		edit: 'Edit',
		save: 'Save',
		close: 'Done',
		logout: 'Log Out',
		login: 'Log In',
		loginProgress: 'Authorizing...',
		signup: 'Sign Up',
		clause: 'By using vRazum you automatically agree to our',
		terms: 'Terms',
		privacy: 'Privacy',
		invitation: 'I have an invitation code',
		invitationPlaceholder: 'Invitation code (12 characters)',
		invitationSuccess: 'Invitation code accepted!',
		invitationFailure: 'Invalid, too many attempts or already used invitation code',
		invitationTitle: 'Please provide an invitation code',
		invitationTitleSuccess: 'Please provide an invitation code',
		invitationQuestion: 'Why I need invitation for registration?',
		invitationExplanation: 'To maintain a high-quality, secure, and engaged community, we use an invitation-only registration system at the moment. Here’s why:',
		invitationReasons: [
			{
				bold: 'Early Access Perk',
				text: ' During beta or limited capacity, invitations help manage early adopters.'
			},
			{
				bold: 'Controlled Growth',
				text: 'We want to expand services sustainably to ensure server stability and a smooth user experience for all users.'
			},
			{
				bold: 'Prevent Abuse',
				text: 'Invitations help reduce spam, fake accounts, and malicious activity'
			},
		],
		waitlist: 'Join the Waitlist',
		join: 'Subscribe',
		joined: 'Joined',
		projects: 'Projects',
		posts: "Posts",
		connections: "Connections",
		yes: "Yes",
		no: "No",
		language: "Languages",
		theme: "Themes",
		googleAuth: "Google",
		update: "Update",
		upload: "Upload",
		not_available: "Not available",
		followers: 'Followers',
		following: 'Following',
		follow: 'Follow',
	},
	button: {
		tags: 'Tags'
	},
	thinkingPhrases: [
		'Consulting my digital crystal ball...',
		'Asking the oracle of ones and zeros...',
		'Summoning the spirits of Silicon Valley...',
		'Decoding the matrix...',
		'Channeling the ghost in the machine...',
		'Pondering the meaning of artificial life...',
		'Calculating the answer to life, the universe, and everything...',
		'Divining the digital tea leaves...',
		'Consulting the sacred scrolls of binary...',
		'Communing with the AI hive mind...'
	]
};
