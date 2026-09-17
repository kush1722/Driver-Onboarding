import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.from('applications').select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Found ${data.length} applications in the database!`);
    console.log(data);
  }
}

check();
