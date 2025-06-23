#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Script to extract used Lucide icons and create local versions
class IconExtractor {
  private usedIcons: Set<string>;
  private srcDir: string;
  private outputDir: string;
  private componentOutputPath: string;

  constructor() {
    this.usedIcons = new Set();
    this.srcDir = './src';
    this.outputDir = './src/lib/assets/icons/lucide';
    this.componentOutputPath = './src/lib/utils/lucideIcons.ts';
  }

  // Step 1: Scan codebase for used icons
  scanForIcons(): Set<string> {
    console.log('🔍 Scanning for used Lucide icons...');
    
    const scanDir = (dir: string): void => {
      const files = fs.readdirSync(dir);
      
      files.forEach((file: string) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.svelte') || file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          this.extractIconsFromFile(content);
        }
      });
    };
    
    scanDir(this.srcDir);
    console.log(`Found ${this.usedIcons.size} unique icons:`, Array.from(this.usedIcons).sort());
    return this.usedIcons;
  }

  private extractIconsFromFile(content: string): void {
    // Match import statements from lucide-svelte
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-svelte['"];?/g;
    let match: RegExpExecArray | null;
    
    while ((match = importRegex.exec(content)) !== null) {
      const imports = match[1];
      // Split by comma and clean up
      const iconNames = imports
        .split(',')
        .map((name: string) => name.trim())
        .filter((name: string) => name && !name.includes('type') && name !== 'IconProps');
      
      iconNames.forEach((icon: string) => {
        // Clean up icon name - remove 'as alias' parts and type annotations
        let cleanIcon = icon.replace(/\s+as\s+\w+/g, '').trim();
        if (cleanIcon && !cleanIcon.startsWith('type ')) {
          this.usedIcons.add(cleanIcon);
        }
      });
    }
  }

  // Step 2: Download SVG files from Lucide repository
  async downloadIcons(): Promise<void> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    console.log('⬇️  Downloading SVG files...');
    
    const downloadPromises = Array.from(this.usedIcons).map(async (iconName: string) => {
      const kebabCase = this.toKebabCase(iconName);
      const url = `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/${kebabCase}.svg`;
      const outputPath = path.join(this.outputDir, `${kebabCase}.svg`);
      
      try {
        await this.downloadFile(url, outputPath);
        console.log(`✅ Downloaded: ${iconName} -> ${kebabCase}.svg`);
      } catch (error) {
        console.error(`❌ Failed to download ${iconName} (${kebabCase}):`, (error as Error).message);
        
        // Try alternative naming patterns
        const alternatives = this.getAlternativeNames(iconName);
        let downloaded = false;
        
        for (const altName of alternatives) {
          try {
            const altUrl = `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/${altName}.svg`;
            await this.downloadFile(altUrl, outputPath);
            console.log(`✅ Downloaded with alternative name: ${iconName} -> ${altName}.svg`);
            downloaded = true;
            break;
          } catch (altError) {
            // Continue to next alternative
          }
        }
        
        if (!downloaded) {
          console.error(`❌ Could not find icon for: ${iconName}. Tried: ${kebabCase}, ${alternatives.join(', ')}`);
          // Create a fallback SVG instead of empty
          const fallbackSvg = this.createFallbackIcon(iconName);
          fs.writeFileSync(outputPath, fallbackSvg);
          console.log(`📝 Created fallback icon for: ${iconName}`);
        }
      }
    });

    await Promise.all(downloadPromises);
  }

  private downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      
      // Add timeout and better error handling
      const request = https.get(url, { timeout: 10000 }, (response) => {
        if (response.statusCode === 404) {
          reject(new Error(`HTTP 404 - Icon not found`));
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          // Verify the file has content
          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            reject(new Error('Downloaded file is empty'));
          } else {
            resolve();
          }
        });
        
        file.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Clean up on error
          reject(err);
        });
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      
      request.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Step 3: Create TypeScript icon utility (PURE TYPESCRIPT - NO SVELTE)
  createIconComponent(): void {
    console.log('🔧 Creating TypeScript Icon utility...');
    
    const iconImports = Array.from(this.usedIcons)
      .map((iconName: string) => {
        const kebabCase = this.toKebabCase(iconName);
        return `import ${iconName}Svg from '../assets/icons/lucide/${kebabCase}.svg?raw';`;
      })
      .join('\n');

    const iconMapEntries = Array.from(this.usedIcons)
      .map((iconName: string) => `  '${iconName}': ${iconName}Svg`)
      .join(',\n');

    const iconTypeUnion = Array.from(this.usedIcons)
      .map((iconName: string) => `'${iconName}'`)
      .join(' | ');

    const iconNamesArray = Array.from(this.usedIcons)
      .map((iconName: string) => `  '${iconName}'`)
      .join(',\n');

    // PURE TYPESCRIPT CODE - NO SVELTE SYNTAX
    const componentCode = `// Auto-generated Lucide icons utility
${iconImports}

export type IconName = ${iconTypeUnion};

export interface IconOptions {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const iconMap: Record<IconName, string> = {
${iconMapEntries}
};

export function getIcon(name: IconName, options: IconOptions = {}): string {
  const { size = 24, color = 'currentColor', strokeWidth = 2 } = options;
  
  let svg = iconMap[name];
  if (!svg) {
    console.warn(\`Icon "\${name}" not found\`);
    return '';
  }
  
  // Update SVG attributes
  svg = svg
    .replace(/width="[^"]*"/g, \`width="\${size}"\`)
    .replace(/height="[^"]*"/g, \`height="\${size}"\`)
    .replace(/stroke="[^"]*"/g, \`stroke="\${color}"\`)
    .replace(/stroke-width="[^"]*"/g, \`stroke-width="\${strokeWidth}"\`);
  
  // Ensure the SVG has proper attributes if they're missing
  if (!svg.includes('width=')) {
    svg = svg.replace('<svg', \`<svg width="\${size}"\`);
  }
  if (!svg.includes('height=')) {
    svg = svg.replace('<svg', \`<svg height="\${size}"\`);
  }
  if (!svg.includes('stroke=') && !svg.includes('fill=')) {
    svg = svg.replace('<svg', \`<svg stroke="\${color}"\`);
  }
  
  return svg;
}

export const availableIcons: IconName[] = [
${iconNamesArray}
];

export default {
  getIcon,
  availableIcons
};`;

    // Ensure directory exists
    const componentDir = path.dirname(this.componentOutputPath);
    if (!fs.existsSync(componentDir)) {
      fs.mkdirSync(componentDir, { recursive: true });
    }

    fs.writeFileSync(this.componentOutputPath, componentCode);
    console.log(`✅ Created TypeScript Icon utility at: ${this.componentOutputPath}`);
  }

  // Step 4: Generate migration guide
  generateMigrationGuide(): void {
    console.log('📋 Generating migration guide...');
    
    const guide = `# Lucide to Local Icons Migration Guide

## What Changed
- Replaced lucide-svelte imports with local SVG icons
- Created a TypeScript utility that provides icons as strings
- Reduced bundle size by including only used icons

## Migration Steps

### 1. Replace Import Statements
**Before:**
\`\`\`typescript
import { Bot, Settings, Plus } from 'lucide-svelte';
\`\`\`

**After:**
\`\`\`typescript
import { getIcon } from '$lib/utils/lucideIcons';
\`\`\`

### 2. Update Icon Usage
**Before:**
\`\`\`svelte
<Bot size={24} />
<Settings class="text-blue-500" />
<Plus strokeWidth={3} />
\`\`\`

**After:**
\`\`\`svelte
{@html getIcon('Bot', { size: 24 })}
<span class="text-blue-500">{@html getIcon('Settings')}</span>
{@html getIcon('Plus', { strokeWidth: 3 })}
\`\`\`

### 3. With Type Safety
\`\`\`typescript
import { getIcon, type IconName } from '$lib/utils/lucideIcons';

// TypeScript will autocomplete available icon names
const iconName: IconName = 'Bot'; 
const iconSvg = getIcon(iconName, { size: 32, color: '#3b82f6' });
\`\`\`

## Available Icons
${Array.from(this.usedIcons).sort().map((icon: string) => `- ${icon}`).join('\n')}

## Bundle Size Impact
- Before: ~${this.usedIcons.size * 2}KB (estimated full Lucide bundle)
- After: ~${this.usedIcons.size * 0.5}KB (only used icons)
- Savings: ~${this.usedIcons.size * 1.5}KB

## Adding New Icons
1. Add the icon import to your component: \`import { NewIcon } from 'lucide-svelte';\`
2. Run: \`yarn extract-icons\`
3. The script will download any new icons automatically
`;

    fs.writeFileSync('./ICON_MIGRATION.md', guide);
    console.log('✅ Created migration guide: ./ICON_MIGRATION.md');
  }

  private createFallbackIcon(iconName: string): string {
    // Create a simple fallback icon based on the icon name
    const firstLetter = iconName.charAt(0).toUpperCase();
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Fallback icon for ${iconName} -->
  <circle cx="12" cy="12" r="10"/>
  <text x="12" y="16" text-anchor="middle" font-size="12" fill="currentColor">${firstLetter}</text>
</svg>`;
  }

  private getAlternativeNames(iconName: string): string[] {
    const alternatives: string[] = [];
    
    // Common alternative patterns
    const kebab = this.toKebabCase(iconName);
    
    // Remove common suffixes that might not exist in Lucide
    const withoutIcon = iconName.replace(/Icon$/, '');
    const withoutSuffix = iconName.replace(/(Icon|Button|Component)$/, '');
    
    alternatives.push(this.toKebabCase(withoutIcon));
    alternatives.push(this.toKebabCase(withoutSuffix));
    
    // Try without numbers/versions
    const withoutNumbers = iconName.replace(/\d+$/, '');
    alternatives.push(this.toKebabCase(withoutNumbers));
    
    // Handle special cases and known mappings
    const specialCases: Record<string, string[]> = {
      'FilterIcon': ['filter'],
      'Filter': ['funnel'], // Lucide uses 'funnel' instead of 'filter'
      'FilterX': ['filter-x'],
      'FilterXIcon': ['filter-x'],
      'User2': ['user'],
      'UserCheckIcon': ['user-check'],
      'XCircle': ['x-circle', 'circle-x'],
      'CheckCircle2': ['check-circle-2', 'circle-check'],
      'CheckCircle': ['circle-check'],
      'CheckSquare': ['square-check'],
      'Trash2': ['trash-2'],
      'TrashIcon': ['trash'],
      'ArrowLeft': ['arrow-left'],
      'ArrowRight': ['arrow-right'],
      'ChevronLeft': ['chevron-left'],
      'ChevronRight': ['chevron-right'],
      'ChevronUp': ['chevron-up'],
      'ChevronDown': ['chevron-down'],
      'MessageCirclePlus': ['message-circle-plus'],
      'PlusSquareIcon': ['plus-square', 'square-plus'],
      'PlusCircle': ['plus-circle', 'circle-plus'],
      'TagIcon': ['tag'],
      'TagsIcon': ['tags'],
      'EyeIcon': ['eye'],
      'LogOutIcon': ['log-out'],
      'SettingsIcon': ['settings'],
      'Settings2': ['settings'],
      'KeyIcon': ['key'],
      'UserIcon': ['user'],
      'HomeIcon': ['home'],
      'CodeIcon': ['code'],
      'BotIcon': ['bot'],
      'FileIcon': ['file'],
      'LinkIcon': ['link'],
      'Volume1': ['volume', 'volume-1'],
      'Volume2': ['volume-2'],
      'Minimize2': ['minimize'],
      'Maximize2': ['maximize'],
      'Edit2': ['edit'],
      'Share2': ['share'],
      'Loader2': ['loader'],
      'AlertCircle': ['alert-circle', 'circle-alert'],
      'HelpCircle': ['help-circle', 'circle-help'],
      'InfoIcon': ['info'],
      'BookmarkCheckIcon': ['bookmark-check'],
      'HeadphonesIcon': ['headphones'],
      'PlayCircleIcon': ['play-circle', 'circle-play'],
      'MoreHorizontal': ['more-horizontal', 'ellipsis'],
      'MoreVertical': ['more-vertical', 'ellipsis-vertical'],
      'UserCircle': ['user-circle', 'circle-user'],
      'SortAsc': ['arrow-up', 'sort-asc'],
      'SortDesc': ['arrow-down', 'sort-desc'],
      'SplitSquareVertical': ['split-square-vertical', 'split'],
      'ChartAreaIcon': ['chart-area'],
      'KanbanSquareIcon': ['kanban-square'],
      'KanbanSquare': ['columns'],
      'ListCollapseIcon': ['list-collapse'],
      'TextCursorIcon': ['text-cursor'],
      'WallpaperIcon': ['wallpaper', 'image'],
      'LucideHome': ['home'],
      'NewIcon': ['plus', 'plus-circle'],
      'ComponentIcon': ['component'],
      'Gamepad2': ['gamepad']
    };
    
    if (specialCases[iconName]) {
      alternatives.unshift(...specialCases[iconName]); // Add to beginning
    }
    
    // Remove duplicates and return
    return [...new Set(alternatives)].filter(name => name !== kebab && name !== '');
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  async run(): Promise<void> {
    try {
      this.scanForIcons();
      await this.downloadIcons();
      this.createIconComponent();
      this.generateMigrationGuide();
      
      console.log('\n🎉 Icon extraction complete!');
      console.log(`📊 Extracted ${this.usedIcons.size} icons`);
      console.log('📝 Check ICON_MIGRATION.md for next steps');
      
    } catch (error) {
      console.error('❌ Error during extraction:', error);
      process.exit(1);
    }
  }
}

// Run the extractor
const extractor = new IconExtractor();
extractor.run();