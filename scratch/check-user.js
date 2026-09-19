import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: users, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth Err:", authErr);
    return;
  }
  console.log("Total users:", users.users.length);
  for (const user of users.users.slice(0, 5)) {
    console.log("User:", user.email, user.id);
    const { data: drivers } = await supabase.from('drivers').select('*').eq('auth_id', user.id);
    console.log("Drivers:", drivers?.length);
    if (drivers && drivers.length > 0) {
      for (const driver of drivers) {
        const { data: apps } = await supabase.from('applications').select('*').eq('driver_id', driver.id);
        console.log("  Apps for driver", driver.id, ":", apps?.length);
        if (apps) {
          apps.forEach(app => console.log("    - app:", app.id, app.status));
        }
      }
    }
  }
}

check();
