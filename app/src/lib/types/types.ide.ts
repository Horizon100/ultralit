import type { User, Projects } from './types';

export interface Repository {
	id: string;
	repoName: string;
	repoDescription: string;
	createdBy: User | string;
	repoCollaborators: string[];
	project: Projects | string;
	defaultBranch: string;
	isPublic: boolean;
	created: string;
	updated: string;
}

export interface CodeFolders {
	id: string;
	name: string;
	path: string;
	repository: Repository | string;
	branch: string;
	createdBy: User | string;
	parent: CodeFolders | string;
	created: string;
	updated: string;
}

export interface CodeFiles {
	id: string;
	name: string;
	content: string[];
	path: string;
	repository: Repository | string;
	branch: string;
	createdBy: User | string;
	lastEditedBy: User | string;
	size: number;
	language: string;
	created: string;
	updated: string;
}

export interface CodeCommits {
	id: string;
	message: string;
	repository: Repository | string;
	branch: string;
	author: User | string;
	changedFiles: string[];
	hash: string;
	created: string;
	updated: string;
}
