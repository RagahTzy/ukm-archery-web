<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UKM Panahan Web App — Agent Rules

## Project Overview
- **Framework**: Next.js 16.2.3 (App Router)
- **React**: 19.2.4
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + custom CSS variables
- **Backend**: Supabase (Auth + Database + Storage)
- **Export**: xlsx (SheetJS)

## Key Conventions

### File Structure
```
app/
├── layout.tsx           # Root layout + Geist fonts
├── globals.css          # Theme variables, animations
├── page.tsx             # Landing page
├── login/page.tsx       # Login (client component)
├── register/page.tsx    # Register (client component)
├── forgot-password/     # Request password reset
├── reset-password/      # Reset password via email token
└── dashboard/
    ├── admin/page.tsx   # Admin dashboard (manajemen anggota, rekap absensi)
    ├── member/page.tsx  # Member dashboard (profil, absensi)
    └── absen/page.tsx   # Camera-based attendance
```

### Component Patterns
- **Client components**: `'use client'` at top (login, register, dashboards)
- **Server components**: Default (layout, page.tsx)
- **Inline styles**: `<style>{`...`}</style>` for complex designs (login, register, dashboards)
- **Fonts**: Playfair Display (headings) + DM Sans (body) via Google Fonts `@import`

### Supabase Integration
- Client: `lib/supabaseClient.ts` → `createClient(url, anonKey)`
- **RLS Enabled** on `profiles` table
- Policies:
  - `profiles_select_own` — user reads own profile
  - `profiles_insert_own` — user inserts own profile (via trigger)
  - `profiles_update_own` — user updates own profile (role/status protected by trigger)
  - `profiles_admin_read_all` — admin reads all via `is_admin_user()` SECURITY DEFINER function
  - `profiles_admin_all` — service_role bypasses all (backend only)
- Trigger: `handle_new_user()` auto-creates profile on sign-up
- Trigger: `prevent_role_status_change()` blocks self role/status changes

### Authentication Flow
1. Register → `supabase.auth.signUp` → profile created with `role: 'member', status: 'pending'`
2. Admin approves → `status: 'approved'` in Supabase Dashboard
3. Login → `supabase.auth.signInWithPassword` → check `profiles.role` + `status`
4. Redirect: `admin` → `/dashboard/admin`, else → `/dashboard/member`
5. Forgot password → `supabase.auth.resetPasswordForEmail` with `redirectTo: /reset-password`
6. Reset password → `supabase.auth.updateUser({ password })`

### Roles
- `admin` — full access (manajemen anggota, rekap absensi, export Excel)
- `member` — profil, absensi hari ini, riwayat absensi
- **No `bendahara` role** (removed)

### Database Tables Required
| Table | Key Columns |
|---|---|
| `profiles` | `id`, `name`, `email`, `role` (admin/member), `status` (pending/approved/rejected) |
| `attendance` | `id`, `user_id`, `date`, `status`, `photo_url` |
| `kas_payments` | `id`, `user_id`, `month`, `pertemuan_1`...`pertemuan_8` (boolean) |
| `transactions` | `id`, `title`, `amount`, `type` (masuk/keluar), `description`, `created_by`, `created_at` |
| Storage: `attendance-photos` | Bucket for attendance photo uploads |

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Commands
```bash
npm run dev      # Development server
npm run build    # Production build (TypeScript + Next.js)
npm run start    # Run production build
npm run lint     # ESLint
```

### Testing Checklist
- [ ] Login with admin → redirect to `/dashboard/admin`
- [ ] Login with member → redirect to `/dashboard/member`
- [ ] Register → status `pending` → admin approves → can login
- [ ] Forgot password → email sent → link works → reset password → can login
- [ ] Admin dashboard: manajemen anggota shows all 43 users
- [ ] Admin can change role via dropdown (member/admin only)
- [ ] Attendance page: camera access → photo upload → record in attendance table
- [ ] Export Excel works on admin rekap absensi & bendahara (legacy)

### Common Pitfalls
1. **RLS infinite recursion** — never use subquery to same table in policy; use SECURITY DEFINER function
2. **Session not ready after signIn** — call `supabase.auth.getSession()` before querying profiles
3. **Redirect URLs in Supabase** — must include `/reset-password` and `/dashboard/absen` for production
4. **Camera permission** — HTTPS required in production (localhost works)
5. **Build vs Dev** — `npm run build` catches TypeScript errors that dev misses

### Code Style
- Indonesian language for UI text, comments, variable names
- `aku`/`kamu` not `saya`/`anda`
- Inline styles for complex dashboards (no separate CSS files)
- Tailwind classes only in `globals.css` via `@import "tailwindcss"` + CSS variables

### Deployment
- Vercel (production): `panahan-unila.vercel.app`
- Supabase project: `ivyvvfhprdvgwiajnjzy`
- Environment variables set in Vercel dashboard