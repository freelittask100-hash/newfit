# Final Steps to Fix Authentication

## Current Issue
Getting 500 error with `x_sb_error_code: unexpected_failure` during sign-up.

## Immediate Solution (5 minutes)

### Step 1: Disable Email Confirmation Temporarily

This will help us isolate whether the issue is with email sending or the database trigger.

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: `cvaontzsqtufotqycfdd`
3. Navigate to: **Authentication** → **Providers** → **Email**
4. Find **"Confirm email"** toggle
5. **Turn it OFF** (disable it)
6. Click **Save**
7. **Test sign-up immediately** - it should work now

### Step 2: Check Postgres Logs for Detailed Error

1. Go to **Supabase Dashboard** → **Logs** → **Postgres Logs**
2. Filter by time when you tried to sign up
3. Look for errors containing:
   - `ERROR:`
   - `handle_new_user`
   - `profiles`
   - `user_roles`

### Step 3: If Sign-Up Works Without Email Confirmation

This means the issue is specifically with the email sending, not the database. Solutions:

**Option A: Keep Email Confirmation Disabled** (for development)
- Users can sign up and sign in immediately
- No email verification needed
- Good for testing

**Option B: Fix MailerSend Configuration**
- Check MailerSend dashboard for errors
- Verify sender email is confirmed
- Check API key permissions
- Verify domain DNS records

**Option C: Use Different Email Provider**
- Try SendGrid (100 emails/day free)
- Try Resend (3,000 emails/month free)
- Configure in Supabase SMTP settings

### Step 4: If Sign-Up Still Fails (Even Without Email Confirmation)

This means there's a database trigger issue. Try this SQL fix:

```sql
-- Run this in Supabase SQL Editor

-- Drop and recreate the trigger with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, name, email, address)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Testing Checklist

After applying fixes:

- [ ] Can you sign up with a new email?
- [ ] Do you see a success message?
- [ ] Can you sign in immediately (if email confirmation is disabled)?
- [ ] Does the user appear in Supabase Dashboard → Authentication → Users?
- [ ] Does the profile appear in Database → profiles table?

## If All Else Fails

Contact Supabase support with:
- Project ID: `cvaontzsqtufotqycfdd`
- Error code: `unexpected_failure`
- Request ID from logs: `019a6709-3e89-769b-9386-a1fac858f72b`
- Mention: "500 error during sign-up, database trigger may be failing"

## Quick Test Command

After disabling email confirmation, test with:
```
Email: test@example.com
Password: testpass123
Name: Test User
```

Should work immediately without email verification.
