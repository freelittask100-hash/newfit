import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('Running migration to fix is_hidden default...\n');
  
  try {
    // Read the migration file
    const migrationSQL = readFileSync(
      'supabase/migrations/20251110000000_fix_is_hidden_default_and_existing_products.sql',
      'utf8'
    );
    
    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('\n---\n');
    
    // Execute the migration using RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      console.log('\nTrying direct SQL execution...\n');
      
      // Try executing each statement separately
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });
        
        if (stmtError) {
          console.error(`  ❌ Failed:`, stmtError.message);
        } else {
          console.log(`  ✅ Success`);
        }
      }
    } else {
      console.log('✅ Migration executed successfully!');
    }
    
    // Verify the changes
    console.log('\nVerifying changes...\n');
    const { data: products, error: checkError } = await supabase
      .from('products')
      .select('name, is_hidden');
    
    if (checkError) {
      console.error('Error checking products:', checkError);
    } else {
      console.log('Products after migration:');
      products.forEach(p => {
        console.log(`  - ${p.name}: is_hidden = ${p.is_hidden}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

runMigration().catch(console.error);
