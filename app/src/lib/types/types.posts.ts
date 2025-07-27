import type { User } from './types';
export interface PostAttachment {
	id: string;
	post: string;
	file_path: string;
	file_type:
		| 'image'
		| 'video'
		| 'document'
		| 'audio'
		| 'archive'
		| 'spreadsheet'
		| 'presentation'
		| 'code'
		| 'ebook';
	file_size: number;
	original_name: string;
	mime_type: string;
	tags: string[];
	tagCount?: number;
	analysis?: string;
	created: string;
	updated: string;
}

export interface Post {
	id: string;
	content: string;
	user: string;
	attachments?: PostAttachment[];
	upvotedBy: string[];
	downvotedBy: string[];
	repostedBy: string[];
	commentedBy: string[];
	sharedBy: string[];
	quotedBy: string[];
	readBy: string[];
	agents?: string[];
	upvoteCount: number;
	downvoteCount: number;
	repostCount: number;
	commentCount: number;
	shareCount: number;
	tagCount: number;
	quoteCount: number;
	readCount: number;
	parent: string;
	children: string[];
	tags: string[];
	quotedPost: string;
	created: string;
	updated: string;
	analyzed?: boolean;
	analyzed_at?: string;
	type?: 'post' | 'comment' | 'agent_reply';
	agent?: string;
}

export interface PostWithInteractions extends Post {
	upvote: boolean;
	downvote: boolean;
	repost: boolean;
	preview: boolean;
	hasRead: boolean;
	share: boolean;
	quote: boolean;
	agents?: string[];
	tagCount: number;
	tags: string[];
	author_name?: string;
	author_username?: string;
	author_avatar?: string;
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
	analyzed?: boolean;
	analyzed_at?: string;
	type?: 'post' | 'comment' | 'agent_reply';
	agent?: string;
	expand?: {
		user?: {
			id: string;
			name?: string;
			username?: string;
			avatar?: string;
		};
	};
}

export interface PostWithInteractionsExtended extends PostWithInteractions {
	expand?: {
		user?: {
			id: string;
			name?: string;
			username?: string;
			avatar?: string;
		};
	};
}

export interface ProfilePost extends PostWithInteractionsExtended {
	isRepost: boolean;
	isOwnRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
}

export type PostStoreState = {
	posts: PostWithInteractions[];
	loading: boolean;
	loadingMore: boolean;
	hasMore: boolean;
	error: string | null;
};

export interface TimelinePost extends PostWithInteractions {
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
}

export interface Comment {
	id: string;
	content: string;
	author: User;
	created: string;
	updated: string;
	postId: string;
	parentId?: string;
	upvote?: boolean;
	downvote?: boolean;
	repost?: boolean;
	upvoteCount?: number;
	downvoteCount?: number;
	repostCount?: number;
}

export interface CommentWithInteractions extends Comment {
	upvote: boolean;
	downvote: boolean;
	repost: boolean;
	preview: boolean;
	hasRead: boolean;
	share: boolean;
	quote: boolean;
	upvoteCount: number;
	downvoteCount: number;
	repostCount: number;
	commentCount: number;
	shareCount: number;
	tagCount: number;
	quoteCount: number;
	readCount: number;
	quotedPost?: string;
	upvotedBy: string[];
	downvotedBy: string[];
	repostedBy: string[];
	commentedBy: string[];
	sharedBy: string[];
	quotedBy: string[];
	readBy: string[];
	agents?: string[];
	parent: string;
	children: string[];
	tags: string[];
	attachments?: PostAttachment[];
	user: string;
	author_name?: string;
	author_username?: string;
	author_avatar?: string;
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
	analyzed?: boolean;
	analyzed_at?: string;
	type?: 'post' | 'comment' | 'agent_reply';
	agent?: string;
	expand?: {
		user?: {
			id: string;
			name?: string;
			username?: string;
			avatar?: string;
		};
	};
}
export interface PostChild {
	id: string;
	user: string;
	parent?: string;
	content?: string;
	created: string;
	upvotedBy?: string[];
	downvotedBy?: string[];
	repostedBy?: string[];
	readBy?: string[];
	childrenIds?: string[];
	commentCount: number;
	upvote: boolean;
	downvote: boolean;
	repost: boolean;
	hasRead: boolean;
	author_name?: string;
	author_username?: string;
	author_avatar?: string;
	children: PostChild[];
}

export interface PostsApiResponse {
	success: boolean;
	posts: PostWithInteractions[];
	totalPages: number;
	totalItems: number;
	filters?: {
		tag?: string;
		tags?: string[];
		parent?: string;
	};
}
export interface PostUpdateResponse {
	success: boolean;
	id: string;
	tags: string[];
	tagCount: number;
}
export interface PostTagStatsResponse {
	success: boolean;
	stats: {
		tagId: string;
		tagName: string;
		postCount: number;
	}[];
}
export interface QuotePostResponse {
	success: boolean;
	post: PostWithInteractions;
	quoteCount: number;
	quotedBy: string[];
}

export interface AddCommentResponse {
	success: boolean;
	comment: PostWithInteractions;
	message?: string;
}

export interface FetchChildrenResponse {
	success: boolean;
	children: PostWithInteractions[];
	totalCount?: number;
}
export interface UpvoteResponse {
	success: boolean;
	upvoted: boolean;
	upvoteCount: number;
	downvoteCount: number;
	downvoted: boolean;
}

export interface RepostResponse {
	success: boolean;
	reposted: boolean;
	repostCount: number;
	repostedBy: string[];
}
export interface TagPostResponse {
	success: boolean;
	message?: string;
}
export interface MarkAsReadResponse {
	success: boolean;
	hasRead: boolean;
	readCount: number;
}

export interface UpdatePostResponse {
	success: boolean;
	id: string;
	content?: string;
	tags?: string[];
}

export interface DeletePostResponse {
	success: boolean;
	message?: string;
}
export type PostUpdateData =
	| Pick<UpvoteResponse, 'upvoted' | 'upvoteCount' | 'downvoteCount'>
	| Pick<RepostResponse, 'reposted' | 'repostCount'>
	| Pick<MarkAsReadResponse, 'hasRead'>;
export interface PostAnalysisStatusResponse {
	success: boolean;
	analyzed: boolean;
}

export interface MarkAnalyzedResponse {
	success: boolean;
	post: PostWithInteractions;
}

export interface AgentAutoReplyResponse {
	success: boolean;
	reply: PostWithInteractions;
	agent: string;
	content: string;
}

export interface AgentBatchReplyResponse {
	success: boolean;
	responses: Array<{
		agentId: string;
		success: boolean;
		data?: AgentAutoReplyResponse;
		error?: string;
	}>;
	analyzed: boolean;
	skipped?: boolean;
	reason?: string;
}