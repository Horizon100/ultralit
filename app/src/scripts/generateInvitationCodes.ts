import PocketBase from 'pocketbase';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.VITE_POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.VITE_POCKETBASE_ADMIN_PASSWORD;

// Configuration for invitation codes
const CODE_LENGTH = 12;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Admin credentials not found in environment variables');
  process.exit(1);
}

// Number of codes to generate
const COUNT = process.argv[2] ? parseInt(process.argv[2]) : 10;

/**
 * Generate a secure invitation code
 */
function generateInvitationCode(): string {
  return nanoid(CODE_LENGTH);
}

/**
 * Generate multiple invitation codes
 */
function generateInvitationCodes(count: number): string[] {
  return Array.from({ length: count }, () => generateInvitationCode());
}

/**
 * Create invitation codes in database
 */
async function createInvitationCodes(pb: PocketBase, count: number) {
  const codes = generateInvitationCodes(count);
  const results = [];
  
  for (const code of codes) {
    try {
      const data = await pb.collection('invitation_codes').create({
        code,
        used: false,
        createdAt: new Date().toISOString()
      });
      
      results.push(data);
    } catch (error) {
      console.error('Error creating invitation code:', error);
    }
  }
  
  return { codes, results };
}

async function main() {
  try {
    // Initialize PocketBase
    const pb = new PocketBase(POCKETBASE_URL);
    
    // Authenticate as admin
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    console.log(`Generating ${COUNT} invitation codes...`);
    
    // Generate and store invitation codes
    const { codes, results } = await createInvitationCodes(pb, COUNT);
    
    console.log('Generated invitation codes:');
    codes.forEach(code => console.log(` - ${code}`));
    console.log(`\n${results.length} codes have been saved to the database.`);
  } catch (error) {
    console.error('Error generating invitation codes:', error);
    process.exit(1);
  }
}

main();