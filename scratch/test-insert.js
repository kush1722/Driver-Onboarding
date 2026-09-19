import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
  const { data: driver } = await supabase.from('drivers').select('id').eq('email', 'tenthani@gmail.com').single();
  console.log("Driver ID:", driver.id);
  
  const { data: newApp, error: createErr } = await supabase
    .from('applications')
    .insert([{ driver_id: driver.id, status: 'draft' }])
    .select()
    .single();
    
  console.log("Create Err:", createErr);
  console.log("New App:", newApp);
}

testInsert();
