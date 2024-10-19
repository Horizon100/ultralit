<script lang="ts">
    import { fade, slide } from 'svelte/transition';
    import { pb } from '$lib/pocketbase';
    import { Camera, LogOutIcon } from 'lucide-svelte';
    import { currentUser } from '$lib/pocketbase';
    import { createEventDispatcher } from 'svelte';
    import { t } from '$lib/stores/translationStore';

    export let user: any;
    export let onClose: () => void;

    let isEditing = false;
    let editedUser = user ? { ...user } : {};

    const dispatch = createEventDispatcher();

    function toggleEdit() {
        isEditing = !isEditing;
    }

    async function saveChanges() {
        try {
            if (user && user.id) {
                await pb.collection('users').update(user.id, editedUser);
                user = { ...editedUser };
                isEditing = false;
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    }

    function handleOutsideClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            onClose();
        }
    }

    async function logout() {
        try {
            await pb.authStore.clear();
            currentUser.set(null);
            dispatch('logout');
            onClose();
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
</script>

<div class="modal-overlay" on:click={handleOutsideClick} transition:fade={{ duration: 300 }}>
    <div class="modal-content" on:click|stopPropagation>
        <button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
            <LogOutIcon size={24} />
            <span>{$t('profile.logout')}</span>
        </button>
        {#if user}
            <div class="profile-header">
                <div class="avatar-container">
                    {#if user.avatar}
                        <img src={pb.getFileUrl(user, user.avatar)} alt="User avatar" class="avatar" />
                    {:else}
                        <div class="avatar-placeholder">
                            <Camera size={48} />
                        </div>
                    {/if}
                </div>
                <div class="info-row">
                    {#if isEditing}
                        <input bind:value={editedUser.username} />
                    {:else}
                        <span>{user.username || 'Not set'}</span>
                    {/if}
                </div>        
            </div>
            <div class="profile-info">
                <div class="info-row">
                    <span class="label">
                        <span>{$t('profile.name')}</span>
                    </span>
                    {#if isEditing}
                        <input bind:value={editedUser.name} />
                    {:else}
                        <span>{user.name || 'Not set'}</span>
                    {/if}
                </div>
                <div class="info-row">
                    <span class="label">
                        <span>{$t('profile.email')}</span>
                    </span>
                    <span>{user.email}</span>
                </div>
                <div class="info-row">
                    <span class="label">
                        <span>{$t('profile.role')}</span>
                    </span>
                    <span>{user.role}</span>
                </div>
                <div class="info-row">
                    <span class="label">
                        <span>{$t('profile.created')}</span>
                    </span>
                    <span>{new Date(user.created).toLocaleString()}</span>
                </div>
                <div class="info-row">
                    <span class="label">
                        <span>{$t('profile.updated')}</span>
                    </span>
                    <span>{new Date(user.updated).toLocaleString()}</span>
                </div>
                <div class="info-row">
                    <span class="label">
                        <span>{$t('profile.verified')}</span>
                    </span>
                    <span>{user.verified ? 'Yes' : 'No'}</span>
                </div>
            </div>
            <div class="actions">
                {#if isEditing}
                    <button on:click={saveChanges}>
                        <span>{$t('profile.save')}</span>
                    </button>
                    <button on:click={toggleEdit}>
                        <span>{$t('profile.edit')}</span>
                    </button>
                {:else}
                    <button on:click={toggleEdit}>
                        <span>{$t('profile.edit')}</span>
                    </button>
                {/if}
                <button on:click={onClose}>
                    <span>{$t('profile.close')}</span>
                </button>
            </div>
        {:else}
            <div class="no-user-message">
                <p>No user information available.</p>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
	@use "src/themes.scss" as *;
  * {
    /* font-family: 'Merriweather', serif; */
    /* font-family: 'Roboto', sans-serif; */
    /* font-family: 'Montserrat'; */
    font-family: var(--font-family);
    color: var(--text-color);

  }    .modal-overlay {
        /* position: fixed; */
        top: 60px;
        left: 0;
        max-width: 100%;
        /* height: 100%; */
        /* background-color: rgba(0, 0, 0, 0.5); */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        /* width: 100%; */
        display: flex;
        /* background-color: #131313;
        color: #ffffff;
        /* border: 1px solid rgb(53, 53, 53); */
        border-radius: 20px;
        justify-content: center;
        align-items: center;
        /* gap: 20px; */
        /* height: 50px; */
        /* padding: 10px 20px; */


    }

    .modal-content {
        /* background: linear-gradient(
            to top, 
            rgba(70, 118, 114, 0.9) 0%,
            rgba(70, 118, 114, 0.85) 5%,
            rgba(70, 118, 114, 0.8) 10%,
            rgba(70, 118, 114, 0.75) 15%,
            rgba(70, 118, 114, 0.7) 20%,
            rgba(70, 118, 114, 0.65) 25%,
            rgba(70, 118, 114, 0.6) 30%,
            rgba(70, 118, 114, 0.55) 35%,
            rgba(70, 118, 114, 0.5) 40%,
            rgba(70, 118, 114, 0.45) 45%,
            rgba(70, 118, 114, 0.4) 50%,
            rgba(70, 118, 114, 0.35) 55%,
            rgba(70, 118, 114, 0.3) 60%,
            rgba(70, 118, 114, 0.25) 65%,
            rgba(70, 118, 114, 0.2) 70%,
            rgba(70, 118, 114, 0.15) 75%,
            rgba(70, 118, 114, 0.1) 80%,
            rgba(70, 118, 114, 0.05) 85%,
            rgba(70, 118, 114, 0) 100%
            ); */

        /* border-top-left-radius: 0px;
        border-top-right-radius: 0px;
        border-bottom-left-radius: 8px;
        border-bottom-right-radius: 8px; */
        /* max-width: 100%; */
        /* backdrop-filter: blur(40px);        
        padding: 2rem;
        border-radius: 20px;
        border: 1px solid rgb(53, 53, 53);
        top: 0;
        position: absolute;
        width: 96vw;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); */

        /* max-width: 500px; */
        /* height: 100vh; */
    }

    .profile-header {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
        color: white;

    }

    .avatar-container {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        margin-right: 1rem;
    }

    .avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #e0e0e0;
        color: #757575;
    }

    h2 {
        margin: 0;
        font-size: 1.5rem;
        color: white;

    }

    .profile-info {
        margin-bottom: 1rem;
        color: white;
    }

    .info-row {
        display: flex;
        margin-bottom: 0.5rem;
    }

    .label {
        font-weight: bold;
        width: 100px;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        background: var(--secondary-color);
        transition: all ease 0.3s;
    }

    button:hover {
        opacity: 0.8;
    }

    .logout-button {
        display: flex;
        gap: 10px;
        position: absolute;
        right: 20px;
        top: 20px;
        background-color: red;
        color: white;
    }

    .logout-button span {
        color: white;
        
    }
</style>