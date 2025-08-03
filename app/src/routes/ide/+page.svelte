<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { EditorState } from '@codemirror/state';
	import type { Extension } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { json } from '@sveltejs/kit';
	import {
		getLanguageExtension,
		createBasicExtensions,
		createAutosaveExtension
	} from './extensions/extensions';
	import { getFileSystem, type FileSystem } from './services/filesystem';
	import { getCodeSuggestion, explainCode, generateCode } from './services/ai-service';
	import { syntaxTree } from '@codemirror/language';
	import CodeMirror from 'svelte-codemirror-editor';
	import type { Repository, CodeFolders, CodeFiles, CodeCommits } from '$lib/types/types.ide';
	import {
		fetchRepositories,
		createRepository,
		createBranch,
		createFolder,
		fetchFolders,
		fetchFiles,
		createFile,
		updateFile
	} from '$lib/clients/ideClient';
	import { ideNotifications } from '$lib/stores/ideNotificationStore';
	import IdeNotification from '$lib/components/feedback/IdeNotification.svelte';
	import { setupKeyboardShortcuts } from './services/keyboardShortcuts';
	import { saveFile } from './services/file-service';
	import { getLanguageHighlighting } from './themes/highlighting';
	import { clientTryCatch, tryCatchSync, isFailure } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import DOMPurify from 'dompurify';

	let editorElement: HTMLElement;
	let editorView: EditorView;
	let currentLanguage: any;
	let activeFile = 'main.ts';
	let fileSystem = getFileSystem();
	let files: FileSystem = {};
	let code: '';
	let darkMode = true;
	let isSidebarOpen = true;

	let openFiles: string[] = ['main.ts'];
	let isAiPanelOpen = false;
	let aiResponse = '';
	let aiIsLoading = false;
	let aiPrompt = '';

	let repositories: Repository[] = [];
	let selectedRepo: Repository | null = null;
	let selectedBranch: string = '';
	let branches: string[] = [];
	let folders: CodeFolders[] = [];
	let repoFiles: CodeFiles[] = [];
	let expandedFolders: Set<string> = new Set();

	let activeRepoFile: CodeFiles | null = null;
	let unsavedChanges: Set<string> = new Set();
	let cleanupKeyboardShortcuts: (() => void) | null = null;

	async function handleSaveFile() {
		if (!activeFile || !editorView) return;

		const result = await clientTryCatch(
			(async () => {
				if (activeRepoFile) {
					const content = editorView.state.doc.toString();

					await saveFile(activeRepoFile, content);

					unsavedChanges.delete(activeFile);
					unsavedChanges = new Set(unsavedChanges);

					return { type: 'repository', file: activeFile };
				} else {
					const content = editorView.state.doc.toString();
					fileSystem.updateFile(activeFile, content);

					ideNotifications.update((notifications) => [
						{
							id: `local_save_${Date.now()}`,
							message: `${activeFile} saved locally`,
							type: 'success',
							timestamp: Date.now(),
							autoClose: true
						},
						...notifications
					]);

					unsavedChanges.delete(activeFile);
					unsavedChanges = new Set(unsavedChanges);

					return { type: 'local', file: activeFile };
				}
			})(),
			`Saving file ${activeFile}`
		);

		if (isFailure(result)) {
			console.error('Failed to save file:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `save_error_${Date.now()}`,
					message: `Failed to save ${activeFile}: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);
		}
	}
	function getLanguageName(filename: string): string {
		const fileExtension = filename.split('.').pop()?.toLowerCase();

		switch (fileExtension) {
			case 'js':
				return 'JavaScript';
			case 'jsx':
				return 'JSX';
			case 'ts':
				return 'TypeScript';
			case 'tsx':
				return 'TSX';
			case 'html':
			case 'svelte':
				return 'HTML';
			case 'css':
				return 'CSS';
			case 'json':
				return 'JSON';
			case 'md':
				return 'Markdown';
			case 'py':
				return 'Python';
			default:
				return 'Text';
		}
	}
	function createEditor() {
		if (!editorElement || !browser) return;

		const result = tryCatchSync(() => {
			currentLanguage = getLanguageExtension(activeFile);

			const basicExtensions = createBasicExtensions(darkMode, currentLanguage);
			const autosaveExtension = createAutosaveExtension((content) => {
				files[activeFile] = content;
				fileSystem.updateFile(activeFile, content);
				unsavedChanges.add(activeFile);
				unsavedChanges = new Set(unsavedChanges);
			});

			// Combine extensions with proper typing
			const allExtensions = [...basicExtensions, autosaveExtension] as any[];

			const startState = EditorState.create({
				doc: files[activeFile] || '',
				extensions: allExtensions
			});

			if (editorView) {
				editorView.destroy();
			}

			editorView = new EditorView({
				state: startState,
				parent: editorElement
			});

			if (cleanupKeyboardShortcuts) {
				cleanupKeyboardShortcuts();
			}

			cleanupKeyboardShortcuts = setupKeyboardShortcuts(editorView, {
				onSave: handleSaveFile
			});

			return true;
		});

		if (isFailure(result)) {
			console.error('Editor initialization failed:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `editor_error_${Date.now()}`,
					message: `Failed to initialize editor: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: false
				},
				...notifications
			]);
		}
	}

	async function openRepoFile(file: CodeFiles) {
		const result = await clientTryCatch(
			(async () => {
				if (!files[file.name]) {
					const content = Array.isArray(file.content) ? file.content.join('\n') : file.content;
					fileSystem.createFile(file.name, content);
					files = await fileSystem.getFiles();
				}

				activeRepoFile = file;

				openFile(file.name);

				return true;
			})(),
			`Opening repository file ${file.name}`
		);

		if (isFailure(result)) {
			console.error('Error opening repository file:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `open_repo_file_error_${Date.now()}`,
					message: `Failed to open ${file.name}: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);
		}
	}

	function openFile(filename: string) {
		if (!files[filename]) return;

		const result = tryCatchSync(() => {
			if (!openFiles.includes(filename)) {
				openFiles = [...openFiles, filename];
			}

			activeFile = filename;

			if (editorView && browser) {
				currentLanguage = getLanguageExtension(filename);

				const newState = EditorState.create({
					doc: files[filename],
					extensions: [
						...createBasicExtensions(darkMode, currentLanguage),
						createAutosaveExtension((content) => {
							files[activeFile] = content;
							fileSystem.updateFile(activeFile, content);

							unsavedChanges.add(activeFile);
							unsavedChanges = new Set(unsavedChanges);
						})
					] as any
				});

				editorView.setState(newState);
			} else if (browser) {
				createEditor();
			}

			return true;
		});

		if (isFailure(result)) {
			console.error('Error updating editor:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `open_file_error_${Date.now()}`,
					message: `Failed to open ${filename}: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);

			createEditor();
		}
	}

	function closeFile(filename: string) {
		const result = tryCatchSync(() => {
			if (unsavedChanges.has(filename)) {
				const shouldClose = confirm(`${filename} has unsaved changes. Close anyway?`);
				if (!shouldClose) return false;
			}

			openFiles = openFiles.filter((f) => f !== filename);

			unsavedChanges.delete(filename);
			unsavedChanges = new Set(unsavedChanges);

			if (activeFile === filename && openFiles.length > 0) {
				activeFile = openFiles[0];

				if (activeRepoFile?.name === filename) {
					activeRepoFile = null;
				}

				openFile(activeFile);
			}

			return true;
		});

		if (isFailure(result)) {
			console.error('Error closing file:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `close_file_error_${Date.now()}`,
					message: `Failed to close ${filename}: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);
		}
	}

	async function createNewFile() {
		if (!selectedRepo || !selectedBranch) {
			alert('Please select a repository and branch first');
			return;
		}

		const fileName = prompt('Enter new file name:');
		if (!fileName) return;

		const result = await clientTryCatch(
			(async () => {
				const currentPath = '/';

				const newFile = await createFile(
					selectedRepo.id,
					selectedBranch,
					fileName,
					['// New file created'],
					currentPath
				);

				repoFiles = [...repoFiles, newFile];

				openRepoFile(newFile);

				return newFile;
			})(),
			`Creating new file ${fileName} in repository ${selectedRepo.id}`
		);

		if (isFailure(result)) {
			console.error('Error creating file:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `create_file_error_${Date.now()}`,
					message: `Failed to create ${fileName}: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);

			alert(`Failed to create file: ${result.error}`);
		}
	}

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	function toggleTheme() {
		const result = tryCatchSync(() => {
			darkMode = !darkMode;
			if (editorView) {
				const basicExtensions = createBasicExtensions(darkMode, currentLanguage) as any[];
				const autosaveExtension = createAutosaveExtension((content) => {
					fileSystem.updateFile(activeFile, content);

					fileSystem
						.getFiles()
						.then((updatedFiles) => {
							files = updatedFiles;
						})
						.catch((error) => {
							console.error('Error updating files after autosave:', error);
						});
				}) as any;

				const newState = EditorState.create({
					doc: editorView.state.doc,
					extensions: [...basicExtensions, autosaveExtension] as any
				});

				editorView.setState(newState);
			}
			return true;
		});

		if (isFailure(result)) {
			console.error('Error toggling theme:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `toggle_theme_error_${Date.now()}`,
					message: `Failed to toggle theme: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);
		}
	}

	async function getAIAssistance() {
		if (aiIsLoading) return;

		const selectedText = editorView.state.selection.main.empty
			? editorView.state.doc.toString()
			: editorView.state.sliceDoc(
					editorView.state.selection.main.from,
					editorView.state.selection.main.to
				);

		const fileExtension = activeFile.split('.').pop() || 'ts';

		isAiPanelOpen = true;
		aiIsLoading = true;
		aiResponse = 'Thinking...';

		try {
			const result = await getCodeSuggestion(
				selectedText,
				aiPrompt || 'Provide improvements and suggestions for this code',
				fileExtension
			);

			if (result.success) {
				aiResponse = result.content || '';
			} else {
				aiResponse = `Error: ${result.error || 'Failed to get AI response'}`;
			}
		} catch (error) {
			aiResponse = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			aiIsLoading = false;
		}
	}

	function analyzeSyntaxTree() {
		if (!editorView) return;

		const tree = syntaxTree(editorView.state);

		console.log('Syntax tree:', tree);

		isAiPanelOpen = true;
		aiResponse = `# Syntax Tree Analysis\n\nThe current document has a syntax tree with ${
			tree.length
		} nodes. This analysis helps understand the structure of your code.\n\n`;
	}

	async function explainCurrentCode() {
		if (aiIsLoading) return;

		const selectedText = editorView.state.selection.main.empty
			? editorView.state.doc.toString()
			: editorView.state.sliceDoc(
					editorView.state.selection.main.from,
					editorView.state.selection.main.to
				);

		const fileExtension = activeFile.split('.').pop() || 'ts';

		isAiPanelOpen = true;
		aiIsLoading = true;
		aiResponse = 'Analyzing code...';

		try {
			const result = await explainCode(selectedText, fileExtension);
			if (result.success) {
				aiResponse = result.content || '';
			} else {
				aiResponse = `Error: ${result.error || 'Failed to get explanation'}`;
			}
		} catch (error) {
			aiResponse = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			aiIsLoading = false;
		}
	}

	async function applyAiSuggestion() {
		if (!aiResponse) return;

		const result = await clientTryCatch(
			(async () => {
				const codeRegex = /```(?:[a-z]*\n)?([\s\S]*?)```/g;
				const matches = [...aiResponse.matchAll(codeRegex)];

				if (matches.length === 0) {
					throw new Error('No code found in the AI response');
				}

				const code = matches[0][1];

				if (!editorView.state.selection.main.empty) {
					editorView.dispatch({
						changes: {
							from: editorView.state.selection.main.from,
							to: editorView.state.selection.main.to,
							insert: code
						}
					});
				} else {
					editorView.dispatch({
						changes: {
							from: 0,
							to: editorView.state.doc.length,
							insert: code
						}
					});
				}

				fileSystem.updateFile(activeFile, editorView.state.doc.toString());
				files = await fileSystem.getFiles();

				isAiPanelOpen = false;

				return true;
			})(),
			'Applying AI suggestion'
		);

		if (isFailure(result)) {
			console.error('Error applying AI suggestion:', result.error);

			ideNotifications.update((notifications) => [
				{
					id: `apply_ai_error_${Date.now()}`,
					message: `Failed to apply AI suggestion: ${result.error}`,
					type: 'error',
					timestamp: Date.now(),
					autoClose: true
				},
				...notifications
			]);

			alert(`Failed to apply AI suggestion: ${result.error}`);
		}
	}

	function closeAiPanel() {
		isAiPanelOpen = false;
	}

	async function createNewRepository() {
		const repoName = prompt('Enter new repository name:');
		if (!repoName) return;

		try {
			const response = await fetch('/api/repositories', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					repoName,
					defaultBranch: 'main'
				})
			});

			if (response.ok) {
				const newRepo = await response.json();
				repositories = [...repositories, newRepo];
				selectRepository(newRepo);
			}
		} catch (error) {
			console.error('Error creating repository:', error);
		}
	}

	async function createNewBranch() {
		if (!selectedRepo) {
			alert('Please select a repository first');
			return;
		}

		const branchName = prompt('Enter new branch name:');
		if (!branchName) return;

		try {
			const response = await fetch('/api/ide/folders', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: 'root',
					path: '/',
					repository: selectedRepo.id,
					branch: branchName,
					parent: null
				})
			});

			if (response.ok) {
				branches = [...branches, branchName];
				selectedBranch = branchName;
				await fetchFoldersAndFiles();
			}
		} catch (error) {
			console.error('Error creating branch:', error);
		}
	}

	async function createNewFolder() {
		if (!selectedRepo || !selectedBranch) {
			alert('Please select a repository and branch first');
			return;
		}

		const folderName = prompt('Enter new folder name:');
		if (!folderName) return;

		try {
			const response = await fetch('/api/ide/folders', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: folderName,
					path: `/${folderName}`,
					repository: selectedRepo.id,
					branch: selectedBranch,
					parent: null
				})
			});

			if (response.ok) {
				await fetchFoldersAndFiles();
			}
		} catch (error) {
			console.error('Error creating folder:', error);
		}
	}

	async function fetchBranches() {
		if (!selectedRepo) return;

		try {
			/*
			 * In a real app, you'd fetch branches from your API
			 * For now, we'll just use the default branch and add 'main' as a sample
			 */
			branches = [selectedRepo.defaultBranch, 'main'];
		} catch (error) {
			console.error('Error fetching branches:', error);
		}
	}

	async function fetchFoldersAndFiles() {
		if (!selectedRepo || !selectedBranch) return;

		try {
			const foldersResponse = await fetch(
				`/api/ide/folders?repository=${selectedRepo.id}&branch=${selectedBranch}`
			);
			if (foldersResponse.ok) {
				const foldersData = await foldersResponse.json();
				folders = foldersData.items || [];
			}

			const filesResponse = await fetch(
				`/api/files?repository=${selectedRepo.id}&branch=${selectedBranch}`
			);
			if (filesResponse.ok) {
				const filesData = await filesResponse.json();
				repoFiles = filesData.items || [];
			}
		} catch (error) {
			console.error('Error fetching folders and files:', error);
		}
	}

	function toggleFolder(folderId: string) {
		if (expandedFolders.has(folderId)) {
			expandedFolders.delete(folderId);
		} else {
			expandedFolders.add(folderId);
		}
		expandedFolders = new Set(expandedFolders);
	}
	async function handleCreateRepository() {
		const repoName = prompt('Enter new repository name:');
		if (!repoName) return;

		try {
			const newRepo = await createRepository(repoName);

			repositories = [...repositories, newRepo];
			selectRepository(newRepo);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to create repository:', error);
			alert(`Failed to create repository: ${errorMessage}`);
		}
	}

	async function selectRepository(repo: Repository) {
		selectedRepo = repo;
		selectedBranch = repo.defaultBranch;
		branches = [repo.defaultBranch, 'main'];
		await loadRepositoryContents();
	}

	async function handleCreateBranch() {
		if (!selectedRepo) return;

		const branchName = prompt('Enter new branch name:');
		if (!branchName) return;

		try {
			const { success, error } = await createBranch(selectedRepo.id, branchName);

			if (success) {
				branches = [...branches, branchName];
				selectedBranch = branchName;
				await loadRepositoryContents();
			} else {
				alert(error || 'Failed to create branch');
			}
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to create branch');
		}
	}

	async function handleCreateFolder() {
		if (!selectedRepo || !selectedBranch) return;

		const folderName = prompt('Enter new folder name:');
		if (!folderName) return;

		try {
			await createFolder(selectedRepo.id, selectedBranch, folderName);
			await loadRepositoryContents();
		} catch (createError) {
			const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';

			console.error('Failed to create folder:', {
				message: errorMessage,
				error: createError
			});
			return json(
				{
					error: 'Failed to create folder',
					details: errorMessage
				},
				{ status: 500 }
			);
		}
	}

	async function loadRepositoryContents() {
		if (!selectedRepo || !selectedBranch) return;

		try {
			const [foldersResponse, filesResponse] = await Promise.all([
				fetchFolders(selectedRepo.id, selectedBranch),
				fetchFiles(selectedRepo.id, selectedBranch)
			]);

			folders = foldersResponse.items || [];
			repoFiles = filesResponse || [];
		} catch (error) {
			console.error('Failed to load repository contents:', error);
			alert('Failed to load repository contents');
		}
	}

	$: sanitizedHtml = DOMPurify.sanitize(
		aiResponse.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
	);

	onMount(async () => {
		if (browser) {
			const repoResult = await clientTryCatch(
				(async () => {
					return await fetchRepositories();
				})(),
				'Loading repositories'
			);

			if (isFailure(repoResult)) {
				console.error('Failed to load repositories:', repoResult.error);

				ideNotifications.update((notifications) => [
					{
						id: `load_repos_error_${Date.now()}`,
						message: `Failed to load repositories: ${repoResult.error}`,
						type: 'error',
						timestamp: Date.now(),
						autoClose: true
					},
					...notifications
				]);
			} else {
				repositories = repoResult.data;
			}

			const editorResult = await clientTryCatch(
				(async () => {
					files = await fileSystem.getFiles();

					if (Object.keys(files).length === 0) {
						fileSystem.createFile(
							'main.ts',
							'// Welcome to the editor!\n\nfunction hello() {\n  console.log("Hello, world!");\n}\n\nhello();'
						);
						fileSystem.createFile(
							'README.md',
							'# My Project\n\nThis is a sample project created in the online IDE.'
						);
						fileSystem.createFile(
							'styles.css',
							'/* Main styles */\nbody {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n'
						);
						files = await fileSystem.getFiles();
					}

					createEditor();

					return true;
				})(),
				'Initializing editor and file system'
			);

			if (isFailure(editorResult)) {
				console.error('Editor initialization failed:', editorResult.error);

				ideNotifications.update((notifications) => [
					{
						id: `editor_init_error_${Date.now()}`,
						message: `Failed to initialize editor: ${editorResult.error}`,
						type: 'error',
						timestamp: Date.now(),
						autoClose: false
					},
					...notifications
				]);
			}
		}
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});
</script>

<svelte:head>
	<title>AI-Powered IDE</title>
	<meta
		name="description"
		content="An AI-powered code editor built with SvelteKit and CodeMirror 6"
	/>
</svelte:head>
<!-- <CodeMirror bind:value={code} /> -->
<IdeNotification notifications={$ideNotifications} />

<div class="ide-container {darkMode ? 'dark-theme' : 'light-theme'}">
	<!-- Toolbar -->
	<div class="toolbar">
		<div class="toolbar-left">
			<button on:click={toggleSidebar} aria-label="Toggle Sidebar">
				<Icon name="PanelLeft" />
			</button>

			<button on:click={handleCreateRepository} aria-label="New Repository">
				<Icon name="PackagePlus" />
			</button>

			<button on:click={handleCreateBranch} aria-label="New Branch" disabled={!selectedRepo}>
				<Icon name="GitBranchPlus" />
			</button>

			<button
				on:click={handleCreateFolder}
				aria-label="New Folder"
				disabled={!selectedRepo || !selectedBranch}
			>
				<Icon name="FolderPlus" />
			</button>
			<button on:click={createNewFile} aria-label="New File">
				<Icon name="FilePlus" />
			</button>

			{#if activeFile}
				<div class="current-file">
					{activeFile}
				</div>
			{/if}
		</div>
		<div class="toolbar-right">
			<button on:click={handleSaveFile} class="save-button" aria-label="Save File">
				<Icon name="Save" />
				Save
			</button>
			<button on:click={toggleTheme} aria-label="Toggle Theme">
				{#if darkMode}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="5"></circle>
						<line x1="12" y1="1" x2="12" y2="3"></line>
						<line x1="12" y1="21" x2="12" y2="23"></line>
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
						<line x1="1" y1="12" x2="3" y2="12"></line>
						<line x1="21" y1="12" x2="23" y2="12"></line>
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
					</svg>
				{/if}
			</button>
			<button on:click={getAIAssistance} class="ai-button" aria-label="AI Assistance">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="3" y1="9" x2="21" y2="9"></line>
					<line x1="9" y1="21" x2="9" y2="9"></line>
				</svg>
				AI Assist
			</button>
		</div>
	</div>

	<div class="content">
		{#if isSidebarOpen}
			<div class="sidebar">
				<!-- Repository List -->
				<div class="repository-list">
					<span class="repo-header">
						<span class="icon">
							<Icon name="Package" />
						</span>
						<h3>Repositories</h3>
					</span>

					{#each repositories as repo}
						<div
							class="repository-item {selectedRepo?.id === repo.id ? 'active' : 'deactive'}"
							role="button"
							tabindex="0"
							on:click={() => selectRepository(repo)}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectRepository(repo);
								}
							}}
						>
							<span>
								<span class="repo-icon">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"
										></path>
									</svg>
								</span>
								<span class="repo-name">{repo.repoName}</span>
							</span>

							{#if selectedRepo?.id === repo.id}
								<select
									class="branch-selector"
									bind:value={selectedBranch}
									on:change={() => fetchFoldersAndFiles()}
								>
									{#each branches as branch}
										<option value={branch}>{branch}</option>
									{/each}
								</select>
							{/if}
						</div>
					{/each}
				</div>

				<!-- File Explorer -->
				{#if selectedRepo}
					<div class="file-explorer">
						{#each folders.filter((f) => !f.parent) as folder}
							<div class="folder-item">
								<div
									class="folder-header"
									role="button"
									tabindex="0"
									aria-expanded={expandedFolders.has(folder.id)}
									aria-label="Toggle folder {folder.name}"
									on:click={() => toggleFolder(folder.id)}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleFolder(folder.id);
										}
									}}
								>
									<span class="folder-icon">
										{expandedFolders.has(folder.id) ? '📂' : '📁'}
									</span>
									<span class="folder-name">{folder.name}</span>
								</div>

								{#if expandedFolders.has(folder.id)}
									<div class="folder-contents">
										<!-- Files in this folder -->
										{#each repoFiles.filter((f) => f.path.startsWith(folder.path)) as file}
											<div
												class="file-item {activeFile === file.name ? 'active' : ''}"
												role="button"
												tabindex="0"
												aria-label="Open file {file.name}"
												on:click={() => openFile(file.name)}
												on:keydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														openFile(file.name);
													}
												}}
											>
												<span class="file-icon">
													{#if file.name.endsWith('.ts')}
														<span class="file-icon-ts">Ts</span>
													{:else if file.name.endsWith('.js')}
														<span class="file-icon-js">Js</span>
													{:else if file.name.endsWith('.html')}
														<span class="file-icon-html">H</span>
													{:else if file.name.endsWith('.css')}
														<span class="file-icon-css">C</span>
													{:else if file.name.endsWith('.md')}
														<span class="file-icon-md">M</span>
													{:else}
														<span class="file-icon-default">F</span>
													{/if}
												</span>
												<span class="file-name">{file.name}</span>
											</div>
										{/each}

										<!-- Subfolders -->
										{#each folders.filter((f) => f.parent === folder.id) as subfolder}
											<div class="subfolder-item">
												<!-- Recursive folder structure would go here -->
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="editor-container">
			<div class="tabs">
				{#each openFiles as filename}
					<div
						class="tab {activeFile === filename ? 'active' : ''}"
						on:click={() => openFile(filename)}
						on:keydown={(e) => e.key === 'Enter' && openFile(filename)}
						tabindex="0"
						role="button"
					>
						<span class="tab-name">{filename}</span>
						<button
							class="close-tab"
							on:click|stopPropagation={() => closeFile(filename)}
							aria-label="Close tab"
						>
							×
						</button>
					</div>
				{/each}
			</div>

			<div class="editor" bind:this={editorElement}></div>

			<div class="status-bar">
				<div class="status-left">
					{activeFile ? `${activeFile} | ${getLanguageName(activeFile)}` : 'No file open'}
				</div>
				<div class="status-right">
					<button on:click={getAIAssistance} class="status-ai-button"> AI </button>
				</div>
			</div>
		</div>

		{#if isAiPanelOpen}
			<div class="ai-panel">
				<div class="ai-panel-header">
					<h3>AI Assistant</h3>
					<button on:click={closeAiPanel} class="close-ai-panel" aria-label="Close AI panel"
						>×</button
					>
				</div>

				<div class="ai-panel-content">
					<div class="ai-prompt-section">
						<input
							type="text"
							bind:value={aiPrompt}
							placeholder="Ask AI for help (e.g., 'Fix bugs', 'Optimize code', 'Explain this function')"
							class="ai-prompt-input"
						/>
						<button on:click={getAIAssistance} class="ai-prompt-button" disabled={aiIsLoading}>
							{aiIsLoading ? 'Thinking...' : 'Ask AI'}
						</button>
					</div>

					{#if aiResponse}
						<div class="ai-response">
							<div class="ai-response-content">
								{#if aiIsLoading}
									<div class="ai-thinking">Thinking...</div>
								{:else}
									<div class="ai-markdown">
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html sanitizedHtml}
									</div>
								{/if}
							</div>

							{#if !aiIsLoading}
								<div class="ai-response-actions">
									<button on:click={applyAiSuggestion} class="apply-suggestion-button">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M20 6L9 17l-5-5"></path>
										</svg>
										Apply Suggestion
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;

	* {
		font-family: var(--font-family);
	}
	.ide-container {
		display: flex;
		flex-direction: column;
		margin-top: 3rem;
		height: 96vh;
		width: 100%;
		color: #e9e9e9;
		background-color: #1e1e1e;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
			'Helvetica Neue', sans-serif;
	}

	.dark-theme {
		--bg-primary: #1e1e1e;
		--bg-secondary: #252526;
		--bg-tertiary: #333333;
		--text-primary: #e9e9e9;
		--text-secondary: #cccccc;
		--border-color: #454545;
		--accent-color: #0e639c;
		--accent-hover: #1177bb;
		--tab-active: #1e1e1e;
		--tab-inactive: #2d2d2d;
	}

	.light-theme {
		--bg-primary: #f3f3f3;
		--bg-secondary: #e6e6e6;
		--bg-tertiary: #d5d5d5;
		--text-primary: #333333;
		--text-secondary: #555555;
		--border-color: #cccccc;
		--accent-color: #007acc;
		--accent-hover: #0062a3;
		--tab-active: #ffffff;
		--tab-inactive: #ececec;
		color: var(--text-primary);
		background-color: var(--bg-primary);
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		background: var(--bg-gradient-r);
		border-bottom: 1px solid var(--border-color);
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.toolbar-left button {
		background-color: transparent;
		padding: 0.25 rem !important;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 1.5rem;
		height: 1.5rem;
		cursor: pointer;
		color: var(--placeholder-color) !important;
		transition: all 0.2s ease;
		&:hover {
			color: var(--text-color) !important;
		}
	}

	.toolbar button {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 3px;
	}

	.toolbar button:hover {
		background-color: var(--bg-tertiary);
	}

	.current-file {
		padding: 0 0.5rem;
		color: var(--text-primary);
	}

	.ai-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background-color: var(--line-color) !important;
		color: var(--placeholder-color) !important;
		padding: 0.25rem 0.5rem !important;
		border-radius: 3px;
		transition: all 0.2s ease;
		&:hover {
			background-color: var(--placeholder-color) !important;

			color: var(--text-color) !important;
		}
	}

	/* Content */
	.content {
		display: flex;
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.sidebar {
		width: 220px;
		background: var(--primary-color);
		border-right: 1px solid var(--border-color);
		overflow-y: auto;
		overflow-x: hidden;
		flex-shrink: 0;
		transition: all 0.2s ease;

		& h3 {
			font-size: 0.6em !important;
			padding: 0.5rem;
			margin: 0;
			width: auto;
		}

		& .sidebar .repository-list {
			display: flex;
			flex-direction: column;
			height: auto;
		}
	}

	.sidebar-header {
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}
	.file-explorer {
		padding-inline-start: 1em;
		display: flex;
		flex-direction: column;
		height: 85vh;
		overflow-y: auto;

		margin-top: -1rem;
	}
	.sidebar-header h3 {
		margin: 0;

		font-weight: 600;
	}

	.file-list {
		padding: 0.5rem 0;
	}

	.repository-list {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 0;
		transition: all 0.2s ease;

		margin-bottom: 1rem;
		& span.repo-header {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			align-items: center;
			line-height: 2;
			gap: 0.25rem;
			margin-left: 0.5rem;
		}
		& span.icon {
			color: var(--tertiary-color);
			display: flex;
			width: 1rem;
			justify-content: center;
			align-items: center;
		}
		h3 {
			display: flex;
			padding: 0;
		}

		& span.hover {
			width: 100%;
			display: flex;
			justify-content: center;
		}
		& .repository-item.deactive {
			font-size: 0.6em;
			display: flex;
			justify-content: flex-start;
			align-items: flex-start;
			display: none;
		}
		&:hover {
			flex-direction: column;
			padding: 1rem;
			& .repository-item.deactive {
				display: flex;
			}
			& h3 {
				display: flex;
				font-size: 1.2em !important;
			}
			border-bottom: 1px solid var(--line-color);
			z-index: 1000;
			background: var(--secondary-color);

			& .repository-item.deactive {
				display: flex;
			}
		}
	}

	.repository-item.active {
		background: var(--bg-color);
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		top: 0;
		& span {
			display: flex;
			align-items: center;
			align-items: center;
			gap: 0.5rem;
		}
		& .repo-name {
			font-size: 0.8rem !important;
			letter-spacing: 0.1em;
			font-weight: 800;
		}
		& span.repo-icon {
			display: none;
		}
	}
	.repository-item.deactive {
		width: 100%;
		font-size: 0.8em;
		&:hover {
			color: var(--tertiary-color);
		}
	}
	select.branch-selector {
		/* Base styling */
		background: var(--secondary-color);
		color: var(--placeholder-color);
		outline: none;
		width: auto;
		display: flex;

		/* Remove browser default styling */
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;

		/* Safari specific fixes */
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		padding: 0.3rem 1.5rem 0.3rem 0.5rem;

		/* Add custom dropdown arrow */
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23ffffff' viewBox='0 0 16 16'><path d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/></svg>");
		background-repeat: no-repeat;
		background-position: calc(100% - 0.5rem) center;

		/* Ensure text doesn't overflow */
		text-overflow: ellipsis;
		white-space: nowrap;
		overflow: hidden;

		/* Prevent iOS zoom on focus */
		font-size: 0.5em;

		/* Improve cursor */
		cursor: pointer;
	}

	/* Hide default arrow in IE10+ */
	select.branch-selector::-ms-expand {
		display: none;
	}

	/* Safari and Chrome specific focus styles */
	select.branch-selector:focus {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
		outline: none;
	}

	/* Styling for options within the select */
	select.branch-selector option {
		background-color: var(--background-color, #333);
		color: var(--text-color, #fff);
	}

	/* iOS Safari specific fixes for text color */
	@supports (-webkit-touch-callout: none) {
		select.branch-selector {
			/* Ensure text color displays correctly in iOS Safari */
			background-color: var(--secondary-color);
			color: var(--text-color, #fff) !important;
		}
	}

	.folder-header {
		font-size: 0.8em;
		line-height: 2;
	}
	.repository-item,
	.file-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		line-height: 1.5;
		cursor: pointer;
		border-left: 1px solid var(--line-color);
		margin: 0 0.25rem;
		position: relative;
	}

	.file-item:hover {
		background-color: var(--secondary-color);
	}

	.file-item.active {
		background-color: rgba(14, 99, 156, 0.2);
	}

	.file-icon {
		margin-right: 0.5rem;

		width: 16px;
		height: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: bold;
	}

	.file-icon-ts {
		color: #3178c6;
	}

	.file-icon-js {
		color: #f7df1e;
	}

	.file-icon-html {
		color: #e34c26;
	}

	.file-icon-css {
		color: #264de4;
	}

	.file-icon-md {
		color: #808080;
	}

	.file-name {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.85rem;
	}

	.file-actions {
		visibility: hidden;
		display: flex;
		gap: 4px;
	}

	.file-item:hover .file-actions {
		visibility: visible;
	}

	.rename-file,
	.delete-file {
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		padding: 2px;
		line-height: 1;
		border-radius: 3px;
	}

	.rename-file:hover,
	.delete-file:hover {
		background-color: var(--bg-tertiary);
	}

	/* Editor Container */
	.editor-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Tabs */
	.tabs {
		display: flex;
		background-color: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		height: 36px;
		overflow-x: auto;
		overflow-y: hidden;
	}

	.tab {
		display: flex;
		align-items: center;
		padding: 0 0.75rem;
		height: 36px;
		background-color: var(--tab-inactive);
		border-right: 1px solid var(--border-color);
		cursor: pointer;
		white-space: nowrap;
		font-size: 0.8rem;
	}

	.tab.active {
		background-color: var(--tab-active);
		border-bottom: 2px solid var(--accent-color);
	}

	.tab-name {
		margin-right: 0.5rem;
	}

	.close-tab {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		font-size: 1rem;
		line-height: 1;
	}

	.editor {
		flex: 1;
		overflow: hidden;
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 0.5rem;
		height: 22px;
		background-color: var(--bg-tertiary);
		border-top: 1px solid var(--border-color);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.status-ai-button {
		background-color: var(--accent-color);
		color: white;
		border: none;
		border-radius: 3px;
		padding: 0 0.5rem;
		cursor: pointer;
		font-size: 0.7rem;
		line-height: 1.5;
	}

	.status-ai-button:hover {
		background-color: var(--accent-hover);
	}

	.ai-panel {
		position: absolute;
		top: 0;
		right: 0;
		width: 400px;
		height: 100%;
		background-color: var(--bg-secondary);
		border-left: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		z-index: 10;
	}

	.ai-panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.ai-panel-header h3 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.close-ai-panel {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 1.2rem;
		line-height: 1;
		padding: 0;
	}

	.ai-panel-content {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		gap: 0.5rem;
	}

	.ai-prompt-section {
		display: flex;
		gap: 0.5rem;
	}

	.ai-prompt-input {
		flex: 1;
		padding: 0.5rem;
		border-radius: 3px;
		border: 1px solid var(--border-color);
		background-color: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	.ai-prompt-button {
		background-color: var(--accent-color);
		color: white;
		border: none;
		border-radius: 3px;
		padding: 0 0.75rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.ai-prompt-button:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.ai-prompt-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.ai-response {
		margin-top: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 3px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.ai-response-content {
		flex: 1;
		padding: 0.75rem;
		background-color: var(--bg-primary);
		overflow-y: auto;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.ai-thinking {
		color: var(--text-secondary);
		font-style: italic;
	}

	.ai-markdown :global(pre) {
		background-color: var(--bg-tertiary);
		padding: 0.75rem;
		border-radius: 3px;
		overflow: auto;
		margin: 0.5rem 0;
	}

	.ai-markdown :global(code) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;
		font-size: 0.85rem;
	}

	.ai-response-actions {
		display: flex;
		justify-content: flex-end;
		padding: 0.5rem;
		background-color: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
	}

	.apply-suggestion-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background-color: var(--accent-color);
		color: white;
		border: none;
		border-radius: 3px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.apply-suggestion-button:hover {
		background-color: var(--accent-hover);
	}

	:global(.cm-editor) {
		height: 100%;
	}

	:global(.cm-scroller) {
		overflow: auto;
		font-family: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;
		font-size: 14px;
		line-height: 1.5;
	}
</style>
