import { type IconName } from '$lib/utils/lucideIcons';

export default {
	nav: {
		home: 'Home',
		chat: 'Chat',
		tasks: 'Tasks',
		tools: 'Tools',
		ide: 'Code',
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
		quickAccess: 'Quick Access',
		debug: 'Debug',
		posts: 'Posts',
		filters: 'Filters',
		agents: 'Agents',
		threads: 'threads'
	},
	generic: {
		created: 'Created',
		updated: 'Updated',
		delete: 'Delete',
		cancel: 'Cancel',
		back: 'Back',
		loading: 'Loading...',
		deleteQuestion: 'Are you sure you want to delete this?',
		deleteWarning: 'This action cannot be undone.',
		attachments: 'Attachments',
		show: 'Show',
		hide: 'Hide',
		only: 'only',
		all: 'all',
		filter: 'Filter',
		filters: 'filters',
		sort: 'Sort',
		share: 'Share',
		copy: 'Copy',
		copyLink: 'Copy link',
		copiedLink: 'Link copied!',
		returnHome: 'Return home',
		signInTo: 'Sign in to',
		this: 'this',
		userNotLoggedIn: 'User not logged in',
		noResults: 'No results found for',
		in: 'in',
		by: 'by',
		collapse: 'Collapse',
		collapseAll: 'Collapse all',
		expand: 'Expand',
		expandAll: 'Expand all',
		yes: 'Yes',
		no: 'No',
		on: 'On',
		off: 'Off',
		settings: 'Settings',
		tags: 'Tags',
		add: 'Add',
		new: 'New',
		and: 'and',
		for: 'for',
		user: 'User',
		clear: 'Clear'
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
		posts: 'posts',
		postsFrom: 'posts from',
		postRead: 'read',
		postUpvote: 'Like',
		quote: 'Quote',
		quoteDescription: 'Add your thoughts and share',
		quoteNotAvailable: 'Quoted post not available',
		quotedBy: 'Quoted by',
		shareLink: 'Share with a link',
		copyLink: 'Copy link to post',
		textareaPlaceholder: 'What´s on your mind?',
		posting: 'Posting...',
		errorExpression: 'Oops!',
		errorComment: 'Error posting comment:',
		addComment: 'Add your comment...',
		addingComment: 'Adding comment:',
		followUser: 'Follow user',
		reply: 'Reply',
		replies: 'Replies',
		replyToThis: 'Reply to this post...',
		noReplies: 'No replies',
		interactPrompt: 'Please sign in to interact with posts',
		media: 'media',
		likes: 'likes',
		historySignin: 'Sign in to browse this user`s complete post history',
		seeAll: 'See all',
		joinConversation: 'Join Conversation',
		noMorePosts: 'No more posts to load',
		hasntPosted: 'has not posted anything yet.',
		replyPlaceholder: 'Write your reply...',
		replyButton: 'Reply',
		postPlaceholder: "What's on your mind?",
		postButton: 'Post',
		quotePlaceholder: 'Add your thoughts to this quote...',
		quoteButton: 'Quote'
	},
	lang: {
		notification: 'Language: English',
		flag: '🇬🇧'
	},
	guidance: {
		productivity: [
			'🚀 Unlock 10x productivity with AI-powered task generation!',
			'🤔 Did you know AI can automatically create kanban boards from your conversations?',
			'💡 Pro tip: Connect your calendar to AI agents for seamless task scheduling'
		],
		aiPowerTips: [
			'🎯 This one weird trick will revolutionize your workflow instantly!',
			'🧐 Did you know you can toggle AI responses on/off mid-conversation?',
			'✨ Hint: Control AI response frequency to match your work style perfectly'
		],
		projectMastery: [
			"🔥 Nobody tells you about this hidden feature until it's too late!",
			'🤯 Did you know each project unlocks exclusive AI agent capabilities?',
			'💫 Secret: Use project workspaces to create hyper-specialized AI assistants'
		],
		timeSaving: [
			'⏰ Save 40+ hours a week with these bookmarking hacks!',
			'🎨 Did you know you can theme your workspace for maximum focus?',
			'🚄 Game changer: Use prompt shortcuts to eliminate repetitive typing'
		]
	},
	tooltip: {
		newProject: 'Create project',
		newThread: 'Create discussion',
		findThread: 'Find discussion',
		pauseAi: 'AI responses off',
		playAi: 'AI responses on',
		edit: 'Edit',
		editDescription: 'Edit description',
		generateHints: 'Generate/refresh AI tips',
		done: 'Done'
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
		]
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
			title: 'Key Features'
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
			'Hello',
			'Hey',
			'Hi',
			'Greetings',
			'Welcome back',
			'Good to see you',
			'Nice to have you here',
			'Howdy',
			'Salutations',
			'Hi there'
		],
		questions: [
			"What's on your mind?",
			'How can I help?',
			'What’s new with you?',
			'Ready to dive in?',
			'What’s the plan today?',
			'What’s inspiring you right now?',
			'How’s your day going?',
			'What’s your thought of the hour?',
			'Need a digital sidekick today?',
			'What’s cooking in your world?'
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
				icon: 'Sun' as IconName,
				description: 'This style will brighten your day',
				dummyContent: 'Sunshine and clear skies'
			},
			{
				name: 'Dark',
				value: 'dark',
				icon: 'Moon' as IconName,
				description: 'For night owls and stargazers',
				dummyContent: 'Moonlit adventures await'
			},
			{
				name: 'Light',
				value: 'light',
				icon: 'Sunrise' as IconName,
				description: 'Start your day with a fresh look',
				dummyContent: 'Early bird gets the worm'
			},
			{
				name: 'Sunset',
				value: 'sunset',
				icon: 'Sunset' as IconName,
				description: 'Wind down with warm hues',
				dummyContent: 'Golden hour vibes'
			},
			{
				name: 'Focus',
				value: 'focus',
				icon: 'Focus' as IconName,
				description: 'Minimize distractions, maximize productivity',
				dummyContent: 'Concentration intensifies'
			},
			{
				name: 'Bold',
				value: 'bold',
				icon: 'Bold' as IconName,
				description: 'Make a statement with vibrant colors',
				dummyContent: 'Stand out from the crowd'
			},
			{
				name: 'Turbo',
				value: 'turbo',
				icon: 'Gauge' as IconName,
				description: 'Speed up your workflow',
				dummyContent: 'Faster than the speed of light'
			},
			{
				name: 'Bone',
				value: 'bone',
				icon: 'Bone' as IconName,
				description: 'Speed up your workflow',
				dummyContent: 'Faster than the speed of light'
			}
		]
	},
	dates: {
		minute: 'minute',
		minutes: 'minutes',
		minutesAgo: 'minutes ago',
		hour: 'hour',
		hours: 'hours',
		hoursAgo: 'h ago',
		day: 'day',
		days: 'days',
		dayAgo: 'day ago',
		daysAgo: 'days ago',
		weekAgo: 'Last week',
		weeksAgo: 'weeks ago',
		monthAgo: 'Last month',
		monthsAgo: 'months ago',
		yearAgo: 'Last year',
		yearsAgo: 'years ago',
		today: 'Today',
		tomorrow: 'Tomorrow',
		yesterday: 'Yesterday',
		endWeek: 'End of Week',
		week: 'week',
		weeks: 'weeks',
		month: 'month',
		months: 'months',
		now: 'Now',
		online: 'Online',
		offline: 'Offline'
	},
	months: {
		january: 'January',
		february: 'February',
		march: 'March',
		april: 'April',
		may: 'May',
		june: 'June',
		july: 'July',
		august: 'August',
		september: 'September',
		october: 'October',
		november: 'November',
		december: 'December'
	},
	tasks: {
		title: 'Tasks',
		task: 'task',
		tasks: 'tasks',
		status: 'Status',
		addDescription: 'Click to add a description',
		changePriority: 'Click to change priority',
		priorityLow: 'Low',
		priorityMedium: 'Medium',
		priorityHight: 'High',
		deadline: 'Deadline',
		start: 'Start',
		subtasks: 'Subtasks',
		backlog: 'Backlog',
		todo: 'To-Do',
		inprogress: 'In Progress',
		review: 'Review',
		done: 'Ready',
		hold: 'Delayed',
		postpone: 'Postpone',
		postponed: 'Postponed',
		delegate: 'Delegate',
		cancelled: 'Cancelled',
		archive: 'Archive',
		selectStart: 'Set start date',
		selectEnd: 'Set end date',
		due: 'Due',
		parent: 'parent',
		assigned: 'Assigned',
		notAssigned: 'Not assigned',
		schedule: 'Schedule',
		gantt: 'Taskflows',
		add: 'Add a task',
		tags: 'Tags'
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
		prompt: 'Prompt',
		prompts: 'Prompts',
		model: 'Model',
		models: 'Models',
		thread: 'Thread',
		threads: 'Threads',
		local: 'Local',
		locals: 'Locals',
		bookmark: 'Bookmark',
		bookmarks: 'Bookmarks',
		sysPrompt: 'System Prompt',
		sysPrompts: 'System Prompts'
	},

	profile: {
		profile: 'Profile',
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
		wallpaper: 'Wallpaper',
		invitation: 'I have an invitation code',
		invitationPlaceholder: 'Invitation code (12 characters)',
		invitationSuccess: 'Invitation code accepted!',
		invitationFailure: 'Invalid, too many attempts or already used invitation code',
		invitationTitle: 'Please provide an invitation code',
		invitationTitleSuccess: 'Please provide an invitation code',
		invitationQuestion: 'Why I need invitation for registration?',
		invitationExplanation:
			'To maintain a high-quality, secure, and engaged community, we use an invitation-only registration system at the moment. Here’s why:',
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
			}
		],
		waitlist: 'Join the Waitlist',
		join: 'Subscribe',
		joined: 'Joined',
		projects: 'Projects',
		posts: 'Posts',
		connections: 'Connections',
		yes: 'Yes',
		no: 'No',
		language: 'Languages',
		theme: 'Themes',
		googleAuth: 'Google',
		update: 'Update',
		upload: 'Upload',
		not_available: 'Not available',
		followers: 'followers',
		following: 'following',
		follow: 'Follow',
		favorite: 'Favorite',
		favorites: 'Favorites',
		stats: 'Stats',
		timeTracker: 'TimeTracker',
		yourPosts: 'Your Posts'
	},
	agents: {
		title: 'Agent',
		agents: 'Agents',
		model: 'Model',
		models: 'Models',
		analysis: 'Analysis',
		response: 'Response',
		summary: 'Summary',
		priority: 'Priority',
		sentiment: 'Sentiment',
		ai: 'AI',
		analyze: 'Analyze',
		autoreply: 'auto-reply',
		autoReply: 'Auto-reply'
	},
	status: {
		download: 'Download',
		downloading: 'Downloading...',
		downloaded: 'Downloaded',
		process: 'Process',
		processing: 'Processing...',
		processed: 'Processed',
		upload: 'Upload',
		uploading: 'Uploading...',
		uploaded: 'Uploaded',
		waiting: 'Waiting...',
		error: 'Error',
		success: 'Success',
		failed: 'Failed',
		cancel: 'Cancel',
		cancelling: 'Cancelling...',
		cancelled: 'Cancelled',
		pause: 'Pause',
		pausing: 'Pausing...',
		paused: 'Paused',
		run: 'Run',
		running: 'Running',
		stop: 'Stop',
		stopping: 'Stopping...',
		stopped: 'Stopped',
		save: 'Save',
		saving: 'Saving...',
		saved: 'Saved',
		delete: 'Delete',
		deleting: 'Deleting...',
		deleted: 'Deleted',
		load: 'Load',
		loading: 'Loading...',
		loaded: 'Loaded',
		create: 'Create',
		creating: 'Creating...',
		created: 'Created',
		add: 'Add',
		adding: 'Adding...',
		added: 'Added',
		export: 'Export',
		exporting: 'Exporting...',
		exported: 'Exported',
		import: 'Import',
		importing: 'Importing...',
		imported: 'Imported',
		active: 'Active',
		inactive: 'Inactive',
		total: 'Total',
		assign: 'Assign',
		assigning: 'Assigning...',
		assigned: 'assigned',
		unassign: 'Unassign',
		unassigning: 'Unassigning...',
		unassigned: 'unassigned',
		trigger: 'Trigger',
		triggered: 'triggered',
		close: 'Close',
		closing: 'Closing...',
		closed: 'Closed'
	},
	button: {
		tags: 'Tags'
	},
	notifications: {
		delete: 'Are you sure you want to delete this?'
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
	],
	startPrompts: [
		// Productivity & Workflow
		'🚀 How can I improve my daily workflow?',
		"⚖️ What's the best way to prioritize competing tasks?",
		'🎯 How do you structure effective team meetings?',
		'🧰 What tools help you stay organized?',
		'💻 How can I better communicate with remote colleagues?',
		"⏰ What's your approach to managing deadlines?",
		'🚫 How do you handle interruptions while working?',
		'🏁 What makes a project successful from start to finish?',
		'💡 How can I give more constructive feedback?',
		"🤝 What's the key to effective delegation?",
		'🎯 How do you maintain focus during long work sessions?',
		'🤝 What strategies help resolve team conflicts?',
		'📊 How can I better track my progress on goals?',
		"👋 What's the best way to onboard new team members?",
		'⚖️ How do you balance individual work with collaboration?',
		'⚡ What makes virtual teamwork more effective?',
		'⏱️ How can I improve my time management skills?',
		"💭 What's your process for brainstorming new ideas?",
		'🤹 How do you handle multiple projects simultaneously?',
		'📝 What makes documentation actually useful?',
		'🌟 How can I build stronger working relationships?',
		"🔄 What's the best way to run a retrospective?",
		'🎯 How do you stay motivated on long-term projects?',
		'🛠️ What tools help your team collaborate better?',
		'🎤 How can I make my presentations more engaging?',
		"🧠 What's your approach to knowledge sharing?",
		'🛡️ How do you handle scope creep in projects?',
		'🎭 What makes cross-functional teams work well?',
		'🤔 How can I improve my decision-making process?',
		'🚀 What strategies help maintain team momentum?',

		// Fun & Creative
		'🐱 What would happen if cats ruled the world?',
		'🌳 Design the perfect treehouse office space',
		'🦸 If you could have any superpower for work, what would it be?',
		'🤖 What would your dream collaboration with an AI look like?',
		'👨‍🍳 Create a recipe for the perfect work-life balance',
		'🏆 If meetings were a sport, what would the rules be?',
		'⏰ Design the ultimate workspace for a time traveler',
		'🚀 What would LinkedIn look like on Mars?',
		'🎵 Create a theme song for your current project',
		'💻 If your code could talk, what would it complain about?',
		'🎮 Design a game that teaches project management',
		'👔 What would happen if everyone worked in pajamas forever?',
		'🍕 Create the perfect snack for late-night coding sessions',
		'🦸‍♀️ If productivity tools were Marvel characters, who would win?',
		'🎉 Design a holiday celebrating remote work',

		// Quirky Professional
		'🐛 How do you debug life problems like code issues?',
		'📚 What would your autobiography chapter titles be?',
		'🤖 If you could automate one annoying task, what would it be?',
		'🎧 Create the perfect playlist for deep focus work',
		'📖 What would your personal user manual say?',
		'☕ Design the ideal coffee break conversation starter',
		'📧 If work emails had mood indicators, what would yours show?',
		'🌅 Create a survival guide for Monday mornings',
		'🍔 What would your work personality type be if described as food?',
		'🎯 Design the ultimate procrastination recovery plan',
		'💭 If you could give past-you one piece of career advice, what would it be?',
		'💪 Create a workout routine using only office supplies',
		'🔔 What would your dream notification sound be?',
		'🏃 Design the perfect excuse for being 5 minutes late',
		'✨ If your desk could grant three wishes, what would you ask for?',

		// Thoughtful & Reflective
		'📈 What skill would you love to master in the next year?',
		'🎯 How do you define success in your current role?',
		'⏰ What would you do if you had an extra hour every day?',
		'💪 Share your best "failure that led to success" story',
		'🌟 What legacy do you want to leave in your industry?',
		'🔄 How has your definition of productivity changed over time?',
		'🎓 What would you teach in a masterclass about your expertise?',
		'🎉 How do you celebrate small wins?',
		'🤔 What question do you wish people asked you more often?',
		'🔍 How do you stay curious in your field?'
	],
	terms: {
		title: 'Terms of Service',
		description:
			'These are the Terms of Service for vRazum. By using our service, you agree to these terms.',
		content: [
			{
				heading: '1. Use of Service',
				body: 'vRazum provides AI-powered features that assist users in content creation, communication, and productivity. You agree to use the service only for lawful purposes and in accordance with these terms.'
			},
			{
				heading: '2. User Content',
				body: 'You retain ownership of your content. By submitting content to vRazum, you grant us a non-exclusive, worldwide license to use, process, and display your content solely to provide and improve the service.'
			},
			{
				heading: '3. Privacy',
				body: 'Your privacy is important to us. Please refer to our Privacy Policy for details on how we collect, use, and protect your data.'
			},
			{
				heading: '4. Prohibited Conduct',
				body: 'You may not use vRazum to violate laws, generate harmful or misleading content, interfere with service operations, or reverse-engineer the AI.'
			},
			{
				heading: '5. Disclaimer of Warranties',
				body: 'The service is provided “as is.” We do not guarantee accuracy, reliability, or fitness for a particular purpose. Use of AI outputs is at your own risk.'
			},
			{
				heading: '6. Limitation of Liability',
				body: 'vRazum is not liable for any direct, indirect, incidental, or consequential damages arising from your use of the service.'
			},
			{
				heading: '7. Modifications',
				body: 'We may update these Terms from time to time. Continued use of the service means you accept the revised terms.'
			},
			{
				heading: '8. Termination',
				body: 'We reserve the right to suspend or terminate your access if you violate these terms or misuse the service.'
			},
			{
				heading: '9. Governing Law',
				body: 'These terms are governed by the laws of your jurisdiction.'
			}
		]
	},
	privacy: {
		title: 'Privacy Policy',
		description:
			'Your privacy is important to us. This Privacy Policy outlines how Vrazum (vrazum.com) collects, uses, and protects your data.',
		content: [
			{
				heading: '1. Information We Collect',
				body: 'We collect your name or username and email address when you register or interact with our services.'
			},
			{
				heading: '2. Email Communications',
				body: 'We may send newsletters or updates if you opt in. You can unsubscribe at any time.'
			},
			{
				heading: '3. Analytics',
				body: 'We use Umami for privacy-focused analytics to understand how users interact with our platform.'
			},
			{
				heading: '4. Tracking Technologies',
				body: 'We use cookies, web beacons, local storage, and session data to enhance your experience and support essential functionality.'
			},
			{
				heading: '5. Social Login',
				body: 'We allow sign-in via Google. This simplifies access while maintaining your security.'
			},
			{
				heading: '6. Children’s Privacy',
				body: 'Vrazum is not intended for users under the age of 13, and we do not knowingly collect their data.'
			},
			{
				heading: '7. Contact Information',
				body: 'You may contact us at support@vrazum.com or via the form at www.vrazum.com/contact.'
			},
			{
				heading: '8. Device Access',
				body: 'We may request access to your device’s camera and photo gallery to provide specific features.'
			},
			{
				heading: '9. Payments',
				body: 'We accept payments online and handle payment information securely through third-party processors.'
			},
			{
				heading: '10. Compliance',
				body: 'We comply with CalOPPA, GDPR, CCPA, and applicable Russian data protection laws.'
			}
		]
	},
	security: {
		passwordQuestions: {
			motherMaiden: "What is your mother's maiden name?",
			childhoodFriend: 'What is the name of your best childhood friend?',
			firstPet: 'What was the name of your first pet?',
			birthCity: 'In what city were you born?',
			favoriteTeacher: 'What is the name of your favorite teacher?',
			firstCar: 'What was the make of your first car?',
			childhoodStreet: 'What street did you grow up on?',
			favoriteBook: 'What is your favorite book?',
			dreamJob: 'What was your dream job as a child?',
			favoriteFood: 'What is your favorite food?'
		},
		selectQuestion: 'Select a security question',
		securityAnswer: 'Your answer',
		securityAnswerPlaceholder: 'Enter your answer (case-insensitive)',
		resetWithHint: 'Reset with Security Question',
		securityQuestionTitle: 'Security Question',
		answerQuestion: 'Answer your security question to reset password',
		newPassword: 'New Password',
		confirmPassword: 'Confirm New Password',
		passwordsMatch: 'Passwords must match',
		resetSuccess: 'Password reset successfully'
	}
};
