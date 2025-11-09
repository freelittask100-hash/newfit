# Manual Fix Guide for Authentication and Product Display Issues

## Issue 1: Products Not Appearing (CRITICAL - FIX THIS FIRST)

### Problem
Products created in the admin panel have `is_hidden = true` by default, so they don't appear on the website.

### Solution: Run SQL in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Update all existing products to be visible
UPDATE public.products
SET is_hidden = false
WHERE is_hidden = true;

-- Set the default value for new products to be visible
ALTER TABLE public.products
ALTER COLUMN is_hidden SET DEFAULT false;
```

6. Click **Run** or press `Ctrl+Enter`
7. You should see a success message

### Verify the Fix
After running the SQL, refresh your website and check the Products page. The "CHOCO NUT" product should now appear.

---

## Issue 2: Authentication with Email Verification

### Current Behavior
- Users sign up → Receive verification email → Must click link → Then can sign in
- Error messages were confusing

### What I've Fixed in Code
1. ✅ Updated password validation to require 8 characters (matching Supabase default)
2. ✅ Added email trimming to prevent whitespace issues
3. ✅ Improved error messages in `errorUtils.ts`
4. ✅ Re-enabled email confirmation in `supabase/config.toml`

### How It Works Now
1. User signs up with email and password
2. User receives verification email from Supabase
3. User clicks verification link in email
4. User returns to site and signs in
5. Success!

### Testing the Auth Flow

#### Test Sign Up:
1. Go to your website
2. Click "Sign Up" or go to `/auth?mode=signup`
3. Enter:
   - Name: Test User
   - Email: test@example.com (use a real email you can access)
   - Password: testpass123 (at least 8 characters)
4. Click "Sign Up"
5. You should see: "Account created! Please check your email to verify your account."
6. Check your email inbox for verification link
7. Click the verification link
8. Return to the website

#### Test Sign In:
1. Go to `/auth`
2. Enter the same email and password
3. Click "Sign In"
4. You should be signed in successfully!

### Common Issues and Solutions

**"Invalid login credentials" error:**
- Make sure you verified your email first
- Check that you're using the correct password
- Password must be at least 8 characters

**"Email not confirmed" error:**
- Check your email inbox (and spam folder)
- Look for email from `noreply@mail.app.supabase.io`
- Click the verification link

**Didn't receive verification email:**
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user
3. Click on the user
4. Click "Send verification email" button

---

## Issue 3: Admin Product Creation

### Problem
When creating products in admin panel, the validation was failing with "required" errors.

### What I've Fixed
1. ✅ Made `price` field optional in validation (since you have price_15g and price_20g)
2. ✅ Set `is_hidden` default to `false` in the form
3. ✅ Fixed the database default (via SQL above)

### How to Create Products Now
1. Sign in as admin
2. Go to Admin Dashboard → Products tab
3. Click "Add Product"
4. Fill in all required fields:
   - Name *
   - Category *
   - 15g Price *
   - 20g Price *
   - Stock *
   - Nutrition Info *
5. Optional fields: Description, Protein, Sugar, Calories, Weight, Shelf Life, Allergens
6. Upload images
7. Leave "Hide Product" unchecked (default)
8. Click "Create Product"

The product should now appear immediately on the Products page!

---

## Summary of Changes Made

### Files Modified:
1. `src/pages/Auth.tsx` - Improved auth flow and error handling
2. `src/lib/validation.ts` - Made price optional, kept password at 8 chars
3. `src/lib/errorUtils.ts` - Better error messages
4. `src/components/admin/ProductsTab.tsx` - Fixed is_hidden default
5. `src/pages/Products-updated.tsx` - Added missing category buttons
6. `supabase/config.toml` - Re-enabled email confirmation
7. `supabase/migrations/20251110000000_fix_is_hidden_default_and_existing_products.sql` - Database fix

### SQL to Run (MOST IMPORTANT):
```sql
UPDATE public.products SET is_hidden = false WHERE is_hidden = true;
ALTER TABLE public.products ALTER COLUMN is_hidden SET DEFAULT false;
```

---

## Testing Checklist

- [ ] Run the SQL in Supabase Dashboard
- [ ] Verify existing products now appear on Products page
- [ ] Create a new test account
- [ ] Verify email received
- [ ] Click verification link
- [ ] Sign in successfully
- [ ] Create a new product as admin
- [ ] Verify new product appears on Products page immediately

---

## Need Help?

If you're still having issues:
1. Check the browser console for errors (F12 → Console tab)
2. Check Supabase Dashboard → Logs for backend errors
3. Verify your .env file has correct VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
