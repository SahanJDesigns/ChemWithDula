-- ==============================================================================
-- Migration: 003_sync_users_and_profiles.sql
-- Description: Automatically keep users and profiles tables in sync on role/name updates
-- ==============================================================================

-- Sync changes from users table to profiles table
CREATE OR REPLACE FUNCTION sync_user_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET 
    full_name = NEW.full_name,
    role = NEW.role,
    phone = COALESCE(NEW.phone, '')
  WHERE id = NEW.id
    AND (role IS DISTINCT FROM NEW.role OR full_name IS DISTINCT FROM NEW.full_name OR phone IS DISTINCT FROM NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_user_to_profile ON users;
CREATE TRIGGER trigger_sync_user_to_profile
AFTER UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_to_profile();

-- Sync changes from profiles table to users table
CREATE OR REPLACE FUNCTION sync_profile_to_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET 
    full_name = NEW.full_name,
    role = NEW.role,
    phone = COALESCE(NEW.phone, '')
  WHERE id = NEW.id
    AND (role IS DISTINCT FROM NEW.role OR full_name IS DISTINCT FROM NEW.full_name OR phone IS DISTINCT FROM NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_profile_to_user ON profiles;
CREATE TRIGGER trigger_sync_profile_to_user
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_to_user();
