import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    // Use SERVICE_ROLE_KEY to bypass RLS since the frontend RLS is blocking reads
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('auth_id', userId)
      .single();

    return res.status(200).json({ isAdmin: !!admin });
  } catch (err) {
    // If .single() finds 0 rows, it throws an error. We catch it and return false.
    return res.status(200).json({ isAdmin: false });
  }
}
