# TODO: Implement Google OAuth Login

## Tasks
- [ ] Update `src/pages/Auth.tsx` to add Google login button and handle OAuth flow
- [ ] Test Google login functionality
- [ ] Configure Supabase dashboard for Google OAuth provider

## Details
- Add a "Sign in with Google" button in the Auth component
- Use `supabase.auth.signInWithOAuth({ provider: 'google' })` for Google login
- Handle OAuth redirect and session management (already handled by existing code)
- Ensure Google login works alongside existing email/password login
