#!/bin/bash

# Script to add Icon import to files that use {@html} for icons

# Array of files with {@html} warnings that likely need Icon component
files=(
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/AssignButton.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/BackButton.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/KeyStatusButton.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/ModelButton.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/ProjectDropdown.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/RecordButton.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/TagsDropdown.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/buttons/TimeTracker.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/cards/ProjectCard.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/charts/GantChart.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/chat/MessageInput.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/chat/ThreadSidebar.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/feedback/IdeNotification.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/feedback/LoadingSpinner.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/feedback/TaskNotification.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/forms/InvitationForm.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/media/AudioPlayer.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/media/VideoPlayer.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/modals/GenericOverlay.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/modals/ShareModal.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/components/navigation/SearchEngine.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/agents/components/AgentGen.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/agents/components/AgentPicker.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/agents/components/AgentsConfig.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/agents/components/AgentsList.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/agents/components/ConfigWrapper.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/chat/AIChat.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/chat/AIChatCopy.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/chat/JsonFormat.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/chat/MessageHeader.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/chat/MsgBookmarks.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/chat/RecursiveMessage.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/models/APIKeyManager.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/models/ModelSelector.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/models/ModelsConfig.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/prompts/PromptInput.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/ai/components/prompts/SysPromptSelector.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/auth/components/Auth.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/canvas/components/ActionsConfig.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/canvas/components/Assets.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/canvas/components/FileContainer.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/dm/components/DMDrawer.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/dm/components/DMInput.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/dm/components/DMModule.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/notes/components/FolderComponent.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/notes/components/FolderNode.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/notes/components/NoteEditor.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/PostCard.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/PostCommentModal.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/PostComposer.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/PostQuoteCard.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/PostReplyModal.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/PostSidenav.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/posts/components/RepostCard.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/projects/components/ProjectCollaborators.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/projects/components/ProjectDeadlines.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/tasks/Kanban.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/tasks/TaskCalendar.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/tasks/TaskCreationModal.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/threads/components/ThreadCollaborators.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/threads/components/ThreadListTags.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/threads/components/ThreadTags.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/users/components/AvatarUploader.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/users/components/Newsletter.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/users/components/Profile.svelte"
"/Users/jr/Repositories/ultralit/app/src/lib/features/users/components/StyleSwitcher.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/+layout.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/[username]/+page.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/_/auth/confirm-password-reset/[token]/+page.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/canvas/+layout.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/canvas/launcher/+page.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/chat/+page.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/ide/+page.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/notes/+page.svelte"
"/Users/jr/Repositories/ultralit/app/src/routes/welcome/+page.svelte"
)

echo "Adding Icon import to ${#files[@]} files..."

for file in "${files[@]}"; do
    if [[ -f "$file" ]]; then
        # Check if file already has Icon import
        if grep -q "import.*Icon.*from.*Icon.svelte" "$file"; then
            echo "  ✓ $file already has Icon import"
            continue
        fi
        
        # Check if file has a <script> tag
        if grep -q "<script" "$file"; then
            # Add import after the first script tag
            sed -i '' '/<script[^>]*>/a\
	import Icon from '\''$lib/components/ui/Icon.svelte'\'';
' "$file"
            echo "  ✓ Added Icon import to $file"
        else
            echo "  ⚠ Skipped $file (no script tag found)"
        fi
    else
        echo "  ✗ File not found: $file"
    fi
done

echo ""
echo "✅ Icon import addition complete!"
echo ""
echo "Next steps:"
echo "1. Search and replace icon usage patterns:"
echo "   Find: {\\@html getIcon\\('([^']+)',\\s*\\{\\s*size:\\s*(\\d+)\\s*\\}\\)}"
echo "   Replace: <Icon name=\"\$1\" size={\$2} />"
echo ""
echo "2. For simple icon usage without size:"
echo "   Find: {\\@html getIcon\\('([^']+)'\\)}"
echo "   Replace: <Icon name=\"\$1\" />"
echo ""
echo "3. Run lint again to verify fixes:"
echo "   yarn lint"