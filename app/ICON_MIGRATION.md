# Lucide to Local Icons Migration Guide

## What Changed
- Replaced lucide-svelte imports with local SVG icons
- Created a TypeScript utility that provides icons as strings
- Reduced bundle size by including only used icons

## Migration Steps

### 1. Replace Import Statements
**Before:**
```typescript
import { Bot, Settings, Plus } from 'lucide-svelte';
```

**After:**
```typescript
import { getIcon } from '$lib/utils/lucideIcons';
```

### 2. Update Icon Usage
**Before:**
```svelte
<Bot size={24} />
<Settings class="text-blue-500" />
<Plus strokeWidth={3} />
```

**After:**
```svelte
{@html getIcon('Bot', { size: 24 })}
<span class="text-blue-500">{@html getIcon('Settings')}</span>
{@html getIcon('Plus', { strokeWidth: 3 })}
```

### 3. With Type Safety
```typescript
import { getIcon, type IconName } from '$lib/utils/lucideIcons';

// TypeScript will autocomplete available icon names
const iconName: IconName = 'Bot'; 
const iconSvg = getIcon(iconName, { size: 32, color: '#3b82f6' });
```

## Available Icons
- Activity
- AlertCircle
- ArrowDown
- ArrowLeft
- ArrowRight
- ArrowUpDown
- Bold
- Bone
- Book
- Bookmark
- BookmarkCheckIcon
- BookmarkMinus
- BookmarkX
- Bot
- BotIcon
- Box
- Braces
- Brain
- BrainCircuit
- BrainCog
- Cake
- Calculator
- Calendar
- CalendarCheck
- CalendarClock
- CalendarDays
- CalendarOff
- Camera
- ChartAreaIcon
- ChartBarBig
- ChartNoAxesGantt
- Check
- CheckCircle
- CheckCircle2
- CheckSquare
- ChevronDown
- ChevronLeft
- ChevronRight
- ChevronUp
- Circle
- CircleOff
- CirclePlay
- ClipboardList
- Clock
- Code
- Combine
- Command
- Compass
- Component
- Copy
- CopyPlus
- Cpu
- Database
- Edit2
- Eye
- EyeIcon
- EyeOff
- File
- FileIcon
- FilePenLine
- FilePlus
- FileSpreadsheet
- FileText
- Filter
- FilterIcon
- Flag
- Focus
- Folder
- FolderGit
- FolderPlus
- Gamepad
- Gamepad2
- Gauge
- GitBranchPlus
- GitCompare
- GitFork
- Github
- Group
- Headphones
- HeadphonesIcon
- Heart
- HelpCircle
- Hexagon
- History
- HomeIcon
- Image
- Info
- InfoIcon
- KanbanSquare
- KanbanSquareIcon
- Key
- KeyIcon
- Languages
- Layers
- LayoutList
- Link
- ListCollapse
- ListCollapseIcon
- ListFilter
- ListTodo
- ListTree
- ListX
- Loader2
- LogIn
- LogOut
- LogOutIcon
- Logs
- LucideHome
- Mail
- MailCheck
- MailPlus
- MapPin
- Maximize
- Maximize2
- MessageCircle
- MessageCircleMore
- MessageCircleOff
- MessageCirclePlus
- MessageSquare
- MessageSquareText
- MessagesSquare
- Mic
- Minimize
- Minimize2
- Moon
- MoreHorizontal
- MoreVertical
- NewIcon
- Notebook
- NotebookPen
- OctagonPause
- Package
- PackageOpen
- PackagePlus
- Palette
- PanelLeft
- PanelLeftClose
- PanelLeftOpen
- Paperclip
- Pause
- Pen
- Pencil
- Play
- PlayCircleIcon
- PlugZap
- Plus
- PlusCircle
- PlusSquareIcon
- Presentation
- Quote
- RefreshCcw
- Repeat
- Save
- ScanFace
- Search
- Send
- ServerCog
- Settings
- Settings2
- SettingsIcon
- Share
- Share2
- Shield
- ShieldCheck
- SignalHigh
- SortAsc
- SortDesc
- Sparkles
- SplitSquareVertical
- Square
- SquareKanban
- SquareMenu
- SquarePlay
- Star
- Sun
- Sunrise
- Sunset
- Tag
- TagIcon
- Tags
- TagsIcon
- Target
- TextCursorIcon
- Timer
- TimerOff
- Trash
- Trash2
- TrashIcon
- TrendingUp
- Triangle
- Unlink
- Upload
- User
- User2
- UserCheckIcon
- UserCircle
- UserIcon
- UserPlus
- Users
- Video
- Volume1
- Volume2
- VolumeX
- WallpaperIcon
- Workflow
- Wrench
- X
- XCircle
- ZapOff

## Bundle Size Impact
- Before: ~418KB (estimated full Lucide bundle)
- After: ~104.5KB (only used icons)
- Savings: ~313.5KB

## Adding New Icons
1. Add the icon import to your component: `import { NewIcon } from 'lucide-svelte';`
2. Run: `yarn extract-icons`
3. The script will download any new icons automatically
