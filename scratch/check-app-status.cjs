const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data: user } = await supabase.auth.admin.getUserById('a12dadb2-7cdb-4aa3-989f-872434f7c9c4');
  console.log("User:", user?.user?.email);
  const { data: driver } = await supabase.from('drivers').select('*').eq('auth_id', 'a12dadb2-7cdb-4aa3-989f-872434f7c9c4').single();
  console.log("Driver:", driver);
  const { data: apps } = await supabase.from('applications').select('*').eq('driver_id', driver.id);
  console.log("Apps:");
  apps.forEach(app => console.log(app.id, "ocr:", app.licence_ocr_status, "face:", app.licence_face_match_status));
}
check();
