-- Note: You should run this in your Supabase SQL Editor AFTER running the schema definition from the implementation plan.
-- This script relies on existing auth.users which we cannot cleanly mock in pure SQL without creating users via the API, 
-- but for testing, we can insert dummy drivers directly if we bypass the auth.uid() requirement or insert fake auth users.

-- However, inserting into auth.users is tricky. A better way for seeding a local dev environment or a fresh project 
-- is to create a test user manually via the Supabase Dashboard Authentication page, grab their UUID, and then run 
-- inserts for that specific user.

-- Alternatively, we can insert raw uuids and just skip the RLS policies when viewing as admin.

-- For demo purposes, we will insert raw records using generated UUIDs.
-- The admin UI (ApplicationsQueue) uses a `select` query without filters when acting as an admin, so it will see these records.

DO $$
DECLARE
  v_driver_id1 uuid := uuid_generate_v4();
  v_driver_id2 uuid := uuid_generate_v4();
  v_driver_id3 uuid := uuid_generate_v4();
  v_driver_id4 uuid := uuid_generate_v4();
  v_driver_id5 uuid := uuid_generate_v4();
  
  v_app_id1 uuid := uuid_generate_v4();
  v_app_id2 uuid := uuid_generate_v4();
  v_app_id3 uuid := uuid_generate_v4();
  v_app_id4 uuid := uuid_generate_v4();
  v_app_id5 uuid := uuid_generate_v4();
  
  -- Fake auth IDs just to satisfy foreign key constraints if auth.users is populated, 
  -- but actually we can't easily insert into auth.users in the cloud without bypass.
  -- WARNING: If you are on Supabase Cloud, foreign keys to auth.users will fail if the user doesn't exist.
  -- You must create users in the dashboard first, or comment out the `references auth.users(id)` in the schema for demo seeding.
BEGIN
  
  -- Assuming the schema has been modified to remove `references auth.users(id)` for demo purposes,
  -- OR you are running this locally where you can insert into auth.users.
  -- For a cloud project, you should create 5 users in the Auth dashboard, copy their UUIDs, and replace the uuid_generate_v4() calls below for auth_ids.

  /*
  INSERT INTO drivers (id, auth_id, full_name, email, phone) VALUES
    (v_driver_id1, uuid_generate_v4(), 'Alice Smith', 'alice@example.com', '555-0101'),
    (v_driver_id2, uuid_generate_v4(), 'Bob Jones', 'bob@example.com', '555-0102'),
    (v_driver_id3, uuid_generate_v4(), 'Charlie Brown', 'charlie@example.com', '555-0103'),
    (v_driver_id4, uuid_generate_v4(), 'Diana Prince', 'diana@example.com', '555-0104'),
    (v_driver_id5, uuid_generate_v4(), 'Eve Adams', 'eve@example.com', '555-0105');

  INSERT INTO applications (id, driver_id, status, face_match_status, face_match_distance) VALUES
    (v_app_id1, v_driver_id1, 'draft', null, null),
    (v_app_id2, v_driver_id2, 'submitted', 'match', 0.42),
    (v_app_id3, v_driver_id3, 'under_review', 'needs_review', 0.65),
    (v_app_id4, v_driver_id4, 'approved', 'match', 0.35),
    (v_app_id5, v_driver_id5, 'rejected', 'no_match', 0.88);

  INSERT INTO vehicles (application_id, type, make, model, year, plate_number, color) VALUES
    (v_app_id1, 'car', 'Honda', 'Civic', 2019, 'ABC-1234', 'Blue'),
    (v_app_id2, 'car', 'Toyota', 'Camry', 2021, 'XYZ-9876', 'Silver'),
    (v_app_id3, 'bike', 'Yamaha', 'MT-07', 2020, 'MOTO-1', 'Black'),
    (v_app_id4, 'van', 'Ford', 'Transit', 2018, 'VAN-001', 'White'),
    (v_app_id5, 'car', 'Nissan', 'Altima', 2015, 'BAD-099', 'Red');
  */
  
END $$;
