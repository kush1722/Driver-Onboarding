# Driver Onboarding & Verification App

A full-stack driver onboarding wizard with email OTP auth, face-match ID verification, an admin reviewer queue, and approval/rejection workflows.

## Prerequisites

1. **Supabase Project:** Create a project at [Supabase](https://supabase.com).
2. **Environment Variables:** Copy `.env.example` to `.env` and fill in your Supabase URL and Anon Key.
3. **Authentication:** In Supabase, go to Authentication > Providers and enable Email OTP.
4. **Storage:** In Supabase, go to Storage and create a bucket named `driver-documents` (set to private).
5. **Database:** Run the SQL commands in `supabase/seed.sql` to set up tables, enums, RLS, storage policies, and seed data.
6. **Models:** Download face-api.js weights to `public/models` (see below).

## Face Models Download
The `face-api.js` models must be downloaded and placed in the `public/models/` directory.

Models required:
- `ssd_mobilenetv1_model-weights_manifest.json` and shard files
- `face_landmark_68_model-weights_manifest.json` and shard files
- `face_recognition_model-weights_manifest.json` and shard files

You can find these in the `weights` directory of the `face-api.js` GitHub repository.

## Running Locally

```bash
npm install
npm run dev
```

## Admin Access
To access the admin panel at `/admin`, you must insert your authenticated user into the `admins` table via the Supabase SQL Editor:

```sql
insert into admins (auth_id) values ('your-auth-user-uuid');
```
