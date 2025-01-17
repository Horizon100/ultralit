import { writable } from 'svelte/store';
import type { Workshops } from '$lib/types/types';

function createWorkshopStore() {
    const { subscribe, set, update } = writable<Workshops[]>([]);

    return {
        subscribe,
        set,
        addWorkshop: (workshop: Workshops) => update(workshops => [...workshops, workshop]),
        updateWorkshop: (updatedWorkshop: Workshops) => update(workshops => 
            workshops.map(w => w.id === updatedWorkshop.id ? updatedWorkshop : w)
        ),
        removeWorkshop: (workshopId: string) => update(workshops => 
            workshops.filter(w => w.id !== workshopId)
        ),
        loadWorkshops: (workshops: Workshops[]) => set(workshops),
    };
}

export const workshopStore = createWorkshopStore();