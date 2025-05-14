import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';


async function createRooms(officeId: string, factoryId: string, logisticsId: string, supportId: string, projectId: string) {
  console.log(`[ROOM CREATION] Starting room creation for office: ${officeId}`);
  try {
    // Office rooms
    const hrRoom = await pb.collection('game_rooms').create({
      name: 'HR Department',
      type: 'hr',
      project: projectId,  
      mapContainer: officeId,
      position: { x: 50, y: 50 },
      description: 'Human resources',
      capacity: 20
    });
    console.log(`[ROOM CREATION] Created HR room: ${hrRoom.id}`);
    
    const libraryRoom = await pb.collection('game_rooms').create({
      name: 'Data Library',
      type: 'library',
      project: projectId,  
      mapContainer: officeId,
      position: { x: 150, y: 50 },
      description: 'Data management',
      capacity: 15
    });
    console.log(`[ROOM CREATION] Created library room: ${libraryRoom.id}`);
  
    // Factory rooms
    await pb.collection('game_rooms').create({
      name: 'Manufacturing',
      type: 'manufacturing',
      project: projectId,  
      mapContainer: factoryId,
      position: { x: 50, y: 50 },
      description: 'Data processing',
      capacity: 25
    });
  
  await pb.collection('game_rooms').create({
    name: 'Assembly',
    type: 'assembly',
    project: projectId,  
    mapContainer: factoryId,
    position: { x: 150, y: 50 },
    description: 'Workflow assembly',
    capacity: 20
  });
  
  // Logistics rooms
  await pb.collection('game_rooms').create({
    name: 'Import Center',
    type: 'inbound',
    project: projectId,  
    mapContainer: logisticsId,
    position: { x: 50, y: 50 },
    description: 'Data import',
    capacity: 10
  });
  
  await pb.collection('game_rooms').create({
    name: 'Export Center',
    type: 'outbound',
    project: projectId,  
    mapContainer: logisticsId,
    position: { x: 150, y: 50 },
    description: 'Data export',
    capacity: 10
  });
  
  // Support rooms
  await pb.collection('game_rooms').create({
    name: 'Help Desk',
    type: 'helpdesk',
    project: projectId,  
    mapContainer: supportId,
    position: { x: 50, y: 50 },
    description: 'Customer support',
    capacity: 15
  });
  
  await pb.collection('game_rooms').create({
    name: 'Training Room',
    type: 'training',
    project: projectId,  
    mapContainer: supportId,
    position: { x: 150, y: 50 },
    description: 'User training facility',
    capacity: 12
  });
  
  console.log(`[ROOM CREATION] All rooms created successfully`);
  } catch (error) {
    console.error(`[ROOM CREATION] Error creating rooms:`, error);
    throw error;
  }
}
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  const { projectId } = await request.json();
  
  if (!projectId) {
    throw error(400, 'Project ID required');
  }

  try {
    // Create maps first
    const office = await pb.collection('game_maps').create({
      name: 'Corporate Office',
      type: 'office',
      project: projectId,
      position: { x: 400, y: 300 },
      description: 'Main office for organizational work',
      isActive: true
    });
    
    const factory = await pb.collection('game_maps').create({
      name: 'Data Factory',
      type: 'factory',
      project: projectId,
      position: { x: 700, y: 300 },
      description: 'Processing and manufacturing center',
      isActive: true
    });
    
    const logistics = await pb.collection('game_maps').create({
      name: 'Logistics Hub',
      type: 'logistics',
      project: projectId,
      position: { x: 550, y: 500 },
      description: 'Data flow management',
      isActive: true
    });
    
    const support = await pb.collection('game_maps').create({
      name: 'Help Center',
      type: 'support',
      project: projectId,
      position: { x: 250, y: 500 },
      description: 'User support center',
      isActive: true
    });
    
    // Create rooms after maps are created
    await createRooms(office.id, factory.id, logistics.id, support.id, projectId);
    
    // Create roads
    await createRoads(office.id, factory.id, logistics.id, support.id);
    
    return json({ success: true });
  } catch (err) {
    console.error('Failed to initialize game world:', err);
    throw error(500, 'Failed to initialize game world');
  }
};


async function createRoads(officeId: string, factoryId: string, logisticsId: string, supportId: string) {
  const roads = [
    {
      from: officeId,
      to: factoryId,
      path: [
        { x: 480, y: 300 },
        { x: 620, y: 300 }
      ],
      isActive: true,
      messageFlow: { direction: 'bidirectional', animating: true }
    },
    {
      from: factoryId,
      to: logisticsId,
      path: [
        { x: 660, y: 380 },
        { x: 605, y: 500 }
      ],
      isActive: true,
      messageFlow: { direction: 'from_to', animating: true }
    },
    {
      from: officeId,
      to: supportId,
      path: [
        { x: 350, y: 380 },
        { x: 300, y: 420 }
      ],
      isActive: true,
      messageFlow: { direction: 'bidirectional', animating: true }
    },
    {
      from: supportId,
      to: logisticsId,
      path: [
        { x: 350, y: 500 },
        { x: 470, y: 500 }
      ],
      isActive: true,
      messageFlow: { direction: 'bidirectional', animating: true }
    }
  ];
  
  for (const road of roads) {
    await pb.collection('game_roads').create(road);
  }
}