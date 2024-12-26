import { Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge } from 'lucide-svelte';

export default {
    nav: {
        ask: "Ask",
        build: "Build",
        notes: "Notes",
        features: "Features",
        pricing: "Pricing",
        blog: "Blog",
        help: "Help"
    },

    lang: {
        notification: "Language: English"
    },

    landing: {
        h1: "LEVEL UP YOUR CONVERSATIONS WITH AI",
        h2: "Hello",
        cta: "Get Started",
        subscribing: "Subscribe",
        usercount: "users",
        introText: "vRazum makes collaborating fun and seamless, whether you're brainstorming with friends or building a global community. Customize your space to chat, create, and work together in real time.",
        productivityTips: [
            "Use AI to brainstorm ideas and overcome creative blocks.",
            "Leverage LLMs for quick research summaries on complex topics.",
            "Automate routine tasks with AI agents to focus on high-value work.",
            "Utilize AI-powered writing assistants to improve your communication.",
            "Create personalized learning plans with AI to upskill efficiently.",
            "Use AI for data analysis to uncover insights and make informed decisions.",
            "Implement AI-driven time management tools to optimize your schedule.",
            "Employ AI chatbots for customer service to save time and improve response rates.",
            "Use AI to proofread and edit your documents for error-free work.",
            "Leverage AI for market research and trend analysis to stay ahead of the curve.",
            "Utilize AI-powered translation tools to break language barriers in global projects.",
            "Implement AI-driven project management tools for better task allocation and deadlines.",
            "Use AI to generate code snippets and accelerate software development.",
            "Employ AI for personalized content recommendations to stay updated in your field.",
            "Utilize AI-powered voice assistants for hands-free task management.",
            "Leverage AI for financial forecasting and budget optimization.",
            "Use AI-driven tools for social media management and content creation.",
            "Implement AI for predictive maintenance to prevent workflow disruptions.",
            "Utilize AI for rapid prototyping and design iterations.",
            "Employ AI-powered analytics to track and improve your productivity metrics."
        ],
        textplaceholder: "What's on your mind?"
    },

    features: {
        title: "Features",
        cards: [
            {
                title: "Advanced AI-powered conversations",
                features: [
                    "Natural language processing",
                    "Contextual understanding",
                    "Multi-turn conversations",
                    "Custom AI models",
                    "Sentiment analysis"
                ],
                isPro: true
            },
            {
                title: "Real-time collaboration tools",
                features: [
                    "Shared workspaces",
                    "Live editing",
                    "Version control",
                    "Comment threads",
                    "Task assignments"
                ],
                isPro: false
            },
            {
                title: "Customizable workspace",
                features: [
                    "Personalized layouts",
                    "Theme customization",
                    "Widget integration",
                    "Keyboard shortcuts",
                    "Custom branding options"
                ],
                isPro: true
            },
            {
                title: "Integrated project management",
                features: [
                    "Kanban boards",
                    "Gantt charts",
                    "Time tracking",
                    "Resource allocation",
                    "Automated reports"
                ],
                isPro: false
            },
            {
                title: "Secure data encryption",
                features: [
                    "End-to-end encryption",
                    "Two-factor authentication",
                    "Regular security audits",
                    "Compliance certifications",
                    "Data backup and recovery"
                ],
                isPro: true
            },
            {
                title: "Advanced analytics",
                features: [
                    "Real-time dashboards",
                    "Custom report builder",
                    "Data visualization tools",
                    "Predictive analytics",
                    "Integration with BI tools"
                ],
                isPro: true
            }
        ]
    },

    extras: {
        quotes: [
            "The question of whether a computer can think is no more interesting than the question of whether a submarine can swim. - Edsger W. Dijkstra",
            "Computer science is no more about computers than astronomy is about telescopes. - Edsger W. Dijkstra",
            "The most profound technologies are those that disappear. They weave themselves into the fabric of everyday life until they are indistinguishable from it. - Mark Weiser",
            "We can only see a short distance ahead, but we can see plenty there that needs to be done. - Alan Turing",
            "The goal of science is to build better mousetraps. The goal of nature is to build better mice. - Mark Twain",
            "The limits of my language mean the limits of my world. - Ludwig Wittgenstein",
            "Knowledge is power. - Francis Bacon",
            "I think, therefore I am. - René Descartes",
            "The unexamined life is not worth living. - Socrates",
            "To know, is to know that you know nothing. That is the meaning of true knowledge. - Socrates"
        ],
        thinking: [
            "Consulting my digital crystal ball...",
            "Asking the oracle of ones and zeros...",
            "Summoning the spirits of Silicon Valley...",
            "Decoding the matrix...",
            "Channeling the ghost in the machine...",
            "Pondering the meaning of artificial life...",
            "Calculating the answer to life, the universe, and everything...",
            "Divining the digital tea leaves...",
            "Consulting the sacred scrolls of binary...",
            "Communing with the AI hive mind..."
          ]
        
    
    },

    pricing: {
        title: "Pricing",
        plans: [
            {
                name: "Basic",
                price: "Free",
                features: [
                    "Up to 3000 tokens per day",
                    "Basic AI features",
                ]
            },
            {
                name: "Pro",
                price: "$14.99/month",
                features: [
                    "Access to multi-agent tools",
                    "50GB storage"
                ]
            },
            {
                name: "Enterprise",
                price: "Contact us",
                features: [
                    "Unlimited users",
                    "Custom AI solutions",
                    "Unlimited storage"
                ]
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
              },
        ]
    },

    dashboard: {
        title: "Reports",
        nameThreads: "total threads",
        nameMessages: "total messages",
        nameTags: "tags",
        nameTimer: "time spent",
        nameActive: "Last Active:",    
    },

    threads: {
        selectThread: "Select thread or create new",
        newThread: "New chat",
        newTag: "Add tag",
        tagsHeader: "Tags",
        today: "Today",
        yesterday: "Yesterday",
        lastweek: "Last Week",
        thismonth: "This Month",
        older: "Older",
        threadHeader: "Discussions"
    },

    chat: {
        placeholder: "Message Vrazum",
        loading: "Loading messages...",
        messagecount: "messages",
        prompts: "Prompts",
        models: "Models",
    },

    profile: {
        name: "Name:",
        email: "Email:",
        role: "Role:",
        created: "Created:",
        updated: "Updated:",
        verified: "Verified:",
        edit: "Edit",
        save: "Save",
        close: "Close",
        logout: "Log Out",
        login: "Log In",
        signup: "Sign Up",
        clause: "By using vRazum you automatically agree to our",
        terms: "Terms",
        privacy: "Privacy"
    },

};