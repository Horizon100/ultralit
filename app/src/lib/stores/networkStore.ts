import { writable } from 'svelte/store';
import type { NodeConfig, AIAgent, Network, Scenario, Task } from '../types';

export interface Node {
  id: string;
  x: number;
  y: number;
  seedPrompt: string;
  expanded: boolean;
  config: NodeConfig;
}

interface NetworkState {
  rootAgent: AIAgent | null;
  childAgents: AIAgent[];
  network: Network | null;
  nodes: Node[];  // Keep this for visualization purposes
  scenarios: Scenario[];
  tasks: Task[];
}

function createNetworkStore() {
  const { subscribe, set, update } = writable<NetworkState>({
    rootAgent: null,
    childAgents: [],
    network: null,
    nodes: [],
    scenarios: [],
    tasks: [],
  });

  return {
    subscribe,
    setRootAgent: (agent: AIAgent) => update(state => ({
      ...state,
      rootAgent: agent,
    })),
    addChildAgent: (agent: AIAgent) => update(state => ({
      ...state,
      childAgents: [...state.childAgents, agent],
    })),
    addChildAgents: (agents: AIAgent[]) => update(state => ({
      ...state,
      childAgents: [...state.childAgents, ...agents],
    })),
    updateAgent: (id: string, updates: Partial<AIAgent>) => update(state => ({
      ...state,
      rootAgent: state.rootAgent?.id === id ? { ...state.rootAgent, ...updates } : state.rootAgent,
      childAgents: state.childAgents.map(agent => agent.id === id ? { ...agent, ...updates } : agent),
    })),
    removeChildAgent: (id: string) => update(state => ({
      ...state,
      childAgents: state.childAgents.filter(agent => agent.id !== id),
    })),
    setNetwork: (network: Network) => update(state => ({
      ...state,
      network,
    })),
    // Keep node functions for visualization
    addNode: (node: Node) => update(state => ({
      ...state,
      nodes: [...state.nodes, node],
    })),
    updateNode: (id: string, updates: Partial<Node>) => update(state => ({
      ...state,
      nodes: state.nodes.map(node => node.id === id ? { ...node, ...updates } : node),
    })),
    removeNode: (id: string) => update(state => ({
      ...state,
      nodes: state.nodes.filter(node => node.id !== id),
    })),
    // Scenario and Task functions
    addScenario: (scenario: Scenario) => update(state => ({
      ...state,
      scenarios: [...state.scenarios, scenario],
    })),
    addTask: (task: Task) => update(state => ({
      ...state,
      tasks: [...state.tasks, task],
    })),
    reset: () => set({ 
      rootAgent: null,
      childAgents: [],
      network: null,
      nodes: [],
      scenarios: [],
      tasks: [],
    }),
    // New methods as per previous recommendations
    addAgent: (agent: AIAgent) => update(state => ({
      ...state,
      childAgents: [...state.childAgents, agent],
    })),
    addAgents: (agents: AIAgent[]) => update(state => ({
      ...state,
      childAgents: [...state.childAgents, ...agents],
    })),
  };
}

export const networkStore = createNetworkStore();