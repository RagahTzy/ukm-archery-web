# UKM Panahan Web App — Development Log

## 2026-08-21

### Session: RLS Fix, Reset Password, Remove Bendahara Role

#### 19:30 — Initial Project Review
- Reviewed entire project structure (Next.js 16.2.3, Supabase, Tailwind v4)
- Identified: landing page, auth flows, 3 dashboards (admin, bendahara, member), absen page

#### 19:45 — RLS Issue on profiles Table
- **Problem**: RLS disabled on `profiles` table → security risk
- **Root cause**: Previous policies caused infinite recursion
- **Fix applied**:
  - Enabled RLS: `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`
  - Created safe policies:
    - `profiles_select_own` — user reads own profile
    - `profiles_insert_own` — user inserts own profile
    - `profiles_update_own` — user updates own (role/status protected)
    - `profiles_admin_all` — service_role bypass (backend only)
  - Added trigger `handle_new_user()` — auto-create profile on sign-up
  - Added trigger `prevent_role_status_change()` — blocks self role/status changes

#### 20:15 — Reset Password Redirect Issue
- **Problem**: Email link redirected to `panahan-unila.vercel.app/#` instead of `/reset-password`
- **Root cause**: Supabase Dashboard → Auth → URL Configuration missing redirect URLs
- **Fix**: Added to Redirect URLs:
  - `https://panahan-unila.vercel.app/reset-password`
  - `http://localhost:3000/reset-password`
- **Verified**: Reset password flow works end-to-end

#### 20:30 — Login Error: "Profil akun tidak ditemukan"
- **Problem**: After reset password, login failed with profile not found
- **Root cause**: Session not ready immediately after `signInWithPassword`
- **Fix**: Added `supabase.auth.getSession()` before querying profiles in `app/login/page.tsx`
- **Added**: Detailed error logging for debugging

#### 20:45 — Infinite Recursion in RLS Policy
- **Problem**: `profiles_update_own` policy used subquery to same table → infinite recursion
- **Additional issue**: Admin read policy also caused recursion
- **Fix**:
  - Dropped recursive policies
  - Created `prevent_role_status_change()` trigger (BEFORE UPDATE, SECURITY DEFINER)
  - Simplified `profiles_update_own` to just `auth.uid() = id`
  - Created `is_admin_user()` function (SECURITY DEFINER) for admin read policy
  - Policy `profiles_admin_read_all` now uses `is_admin_user()` — no recursion

#### 21:00 — Remove Bendahara Role
- **Scope**: Complete removal of bendahara role from codebase
- **Changes**:
  - Deleted `app/dashboard/bendahara/` folder
  - `app/login/page.tsx`: Removed bendahara redirect → fallback to member
  - `app/dashboard/admin/page.tsx`: Removed "Bendahara" from role dropdown
  - `README.md`: Removed all bendahara references (routes, structure, roles)
- **Database**: 3 users still have `role = 'bendahara'` — will redirect to member dashboard; admin can update via dropdown

#### 21:15 — Admin Dashboard Empty Data
- **Problem**: Manajemen Anggota showed no data
- **Root cause**: Admin read policy (`profiles_admin_read_all`) used subquery → recursion → blocked reads
- **Fix**: Replaced with `is_admin_user()` SECURITY DEFINER function

#### 21:30 — Verification
- ✅ Build passes (`npm run build`)
- ✅ Login works for admin & member
- ✅ Register → pending → admin approve → login works
- ✅ Forgot/reset password flow works
- ✅ Admin dashboard shows all 43 users
- ✅ Admin can change roles (member/admin only)
- ✅ Attendance page functional
- ✅ No infinite recursion errors

#### 21:40 — Documentation Updates
- Updated `AGENTS.md` with comprehensive project rules
- Created `LOGS.md` (this file)

---

## Summary of Key Technical Decisions

| Area | Decision | Rationale |
|---|---|---|
| RLS Policies | Use SECURITY DEFINER functions for admin checks | Avoids infinite recursion from self-referencing policies |
| Role Protection | Trigger `prevent_role_status_change()` | Enforces at DB level, not just policy |
| Session Handling | `getSession()` after `signInWithPassword` | Ensures auth cookie ready for subsequent queries |
| Bendahara Removal | Code-only removal, DB roles left as-is | Non-breaking; users fall back to member dashboard |
| Styling | Inline `<style>` blocks for complex pages | Tailwind v4 + custom design system |

---

## Commands Run
```bash
# Supabase CLI
supabase login --token <token>
supabase link --project-ref ivyvvfhprdvgwiajnjzy
supabase db query --linked --file /tmp/rls_profiles_fixed.sql
supabase db query --linked --file /tmp/fix_recursion.sql
supabase db query --linked --file /tmp/admin_read_policy.sql
supabase db query --linked --file /tmp/fix_admin_read.sql

# Next.js
npm run lint
npm run build
npm run dev
```

---

## Next Steps (If Needed)
- [ ] Update 3 bendahara users to member/admin via Admin Dashboard
- [ ] Consider removing unused tables: `kas_payments`, `transactions` (bendahara legacy)
- [ ] Add middleware for route protection (currently client-side only)
- [ ] PWA configuration for mobile attendance