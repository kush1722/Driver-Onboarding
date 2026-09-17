import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, inviteCode } = req.body;

  if (!userId || !inviteCode) {
    return res.status(400).json({ error: 'Missing userId or inviteCode' });
  }

  if (inviteCode !== 'TESTER2026') {
    return res.status(403).json({ error: 'Invalid invite code' });
  }

  try {
    // Create a Supabase client with the SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if admin already exists to prevent duplicate key errors
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('auth_id', userId)
      .single();

    if (existingAdmin) {
      return res.status(200).json({ success: true, message: 'Already an admin' });
    }

    // Insert new admin bypassing RLS
    const { error: insertErr } = await supabaseAdmin
      .from('admins')
      .insert([{ auth_id: userId }]);

    if (insertErr) {
      throw insertErr;
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Admin Creation Error:", err);
    return res.status(500).json({ error: 'Failed to create admin record' });
  }
}
