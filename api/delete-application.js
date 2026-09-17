import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Use the Service Role Key to bypass RLS!
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, applicationId } = req.body;

  if (!userId || !applicationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // 1. Verify the requester is actually an Admin
    const { data: adminCheck, error: adminErr } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('auth_id', userId)
      .single();

    if (adminErr || !adminCheck) {
      return res.status(403).json({ error: 'Unauthorized: You are not an admin' });
    }

    // 2. Fetch the application's driver to find the auth_id
    const { data: appData } = await supabaseAdmin
      .from('applications')
      .select('driver_id')
      .eq('id', applicationId)
      .single();
      
    let authIdToDelete = null;
    if (appData && appData.driver_id) {
      const { data: driverData } = await supabaseAdmin
        .from('drivers')
        .select('auth_id')
        .eq('id', appData.driver_id)
        .single();
      if (driverData && driverData.auth_id) {
        authIdToDelete = driverData.auth_id;
      }
    }

    // 3. Delete related records first (just in case ON DELETE CASCADE is not set)
    await supabaseAdmin.from('documents').delete().eq('application_id', applicationId);
    await supabaseAdmin.from('vehicles').delete().eq('application_id', applicationId);
    
    // 4. Delete the application
    const { error: deleteErr } = await supabaseAdmin
      .from('applications')
      .delete()
      .eq('id', applicationId);

    if (deleteErr) {
      throw deleteErr;
    }
    
    // 5. Delete the driver record
    if (appData && appData.driver_id) {
      await supabaseAdmin.from('drivers').delete().eq('id', appData.driver_id);
    }

    // 6. Permanently erase the user from Supabase Auth!
    if (authIdToDelete) {
      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(authIdToDelete);
      if (authDeleteErr) console.error("Failed to delete auth user:", authDeleteErr);
    }

    return res.status(200).json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    console.error("Delete Application Error:", error);
    return res.status(500).json({ error: 'Failed to delete application' });
  }
}
