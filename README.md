# UKM Panahan Web App

Dokumentasi ini dibuat agar developer lain bisa memahami, menjalankan, dan mengembangkan web UKM Panahan lebih cepat.

## Ringkasan Proyek

Aplikasi ini dibangun dengan:
- `Next.js 16.2.3` (App Router)
- `React 19.2.4`
- `TypeScript`
- `Tailwind CSS v4`
- `Supabase` untuk autentikasi dan data pengguna

Fokus utama aplikasi adalah portal anggota UKM dengan halaman beranda, login, pendaftaran, dan dashboard per peran.

## Struktur Folder Utama

- `app/`
  - `layout.tsx` - layout global Next.js
  - `globals.css` - styling global dan variabel tema
  - `page.tsx` - halaman beranda publik
  - `login/page.tsx` - halaman masuk anggota
  - `register/page.tsx` - halaman pendaftaran anggota
  - `dashboard/`
    - `admin/page.tsx` - dashboard role admin
    - `bendahara/page.tsx` - dashboard role bendahara
    - `member/page.tsx` - dashboard role member
- `lib/supabaseClient.ts` - inisialisasi client Supabase
- `package.json` - dependensi dan skrip
- `next.config.ts` - konfigurasi Next.js

## Teknologi Utama

- `Next.js App Router` untuk routing dan struktur halaman
- `React` dengan komponen client di halaman login/register
- `Supabase` sebagai backend auth dan database
- `Tailwind CSS` styling global via `@import "tailwindcss"`

## Environment Variables

Agar aplikasi berjalan, set environment variable berikut di `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

`lib/supabaseClient.ts` menggunakan variabel ini untuk membuat client Supabase.

## Cara Menjalankan

1. Install dependensi:

```bash
npm install
```

2. Jalankan mode development:

```bash
npm run dev
```

3. Buka `http://localhost:3000`

4. Untuk build production:

```bash
npm run build
```

5. Untuk menjalankan hasil build:

```bash
npm start
```

## Routing dan Alur Aplikasi

- `/` - halaman beranda publik
- `/login` - halaman login
- `/register` - halaman pendaftaran
- `/dashboard/admin` - dashboard admin
- `/dashboard/bendahara` - dashboard bendahara
- `/dashboard/member` - dashboard member

Halaman login dan register adalah komponen client, sedangkan layout dan halaman beranda memakai App Router Next.js.

## Autentikasi dan Peran Pengguna

Login menggunakan Supabase auth:
- `supabase.auth.signInWithPassword` di `app/login/page.tsx`
- `supabase.auth.signUp` di `app/register/page.tsx`

Setelah login, aplikasi mengambil `profiles` dari tabel Supabase:
- `role` untuk menentukan `/dashboard/admin`, `/dashboard/bendahara`, atau `/dashboard/member`
- `status` untuk memeriksa apakah akun `pending`, `approved`, atau `rejected`

Logika utama:
- `pending` → tidak dapat masuk sampai admin setujui
- `rejected` → akun tidak bisa masuk
- `admin` → redirect ke `/dashboard/admin`
- `bendahara` → redirect ke `/dashboard/bendahara`
- selain itu → redirect ke `/dashboard/member`

## Data dan Struktur Supabase yang Diperlukan

Aplikasi mengharapkan tabel `profiles` di Supabase dengan setidaknya kolom:
- `id` (UUID user Supabase)
- `role` (`admin`, `bendahara`, `member`)
- `status` (`pending`, `approved`, `rejected`)
- `name` (nama lengkap, dikirim saat sign-up)

Contoh flow pendaftaran:
1. Pengguna mendaftar dengan `email`, `password`, dan `name`
2. Supabase menyimpan akun auth
3. Admin perlu mengatur `status` dan `role` secara manual di database
4. Setelah disetujui, pengguna bisa login

## Styling dan Desain

- Styling utama berada di `app/globals.css`
- Beberapa halaman login/register menambahkan style lokal dengan tag `<style>{`...`}</style>`
- Variabel tema global di `globals.css` memetakan ke warna dan font

## Bagian Halaman Penting

- `app/page.tsx`: tampilan homepage dengan menu akses ke login/register
- `app/login/page.tsx`: form login, validasi sederhana, redirect berdasarkan role
- `app/register/page.tsx`: form pendaftaran, validasi password minimal 6 karakter
- `app/dashboard/*`: halaman dashboard untuk tiap role (presentasi statis saat ini)

## Tips Pengembangan

- Untuk menambah halaman baru, buat folder baru di `app/` dan file `page.tsx`
- Untuk menambah fitur dashboard, kembangkan masing-masing file di `app/dashboard/`
- Gunakan `Link` dari `next/link` untuk navigasi client-side
- Gunakan `useRouter` dari `next/navigation` untuk redirect di client component
- Pastikan semua operasi Supabase dilakukan di komponen dengan `'use client'`

## Pengembangan Lanjutan

Beberapa area yang bisa ditingkatkan:
- proteksi route dashboard dengan middleware atau pemeriksaan session
- simpan data user secara global dengan context / zustand / Jotai
- buat dashboard dinamis berdasarkan data Supabase
- tambahkan halaman `profile`, `jadwal latihan`, atau `keuangan`
- gunakan `app/api/` untuk route API khusus jika butuh server-side logic

## Kontak dan Kontribusi

Jika ingin mengembangkan lebih lanjut, periksa struktur `app/` dan `lib/supabaseClient.ts` terlebih dahulu.

Untuk perubahan besar:
- tambahkan dokumen desain fitur baru di README atau `docs/`
- pisahkan komponen UI ke folder `components/`
- gunakan `tailwind.config` jika perlu konfigurasi Tailwind kustom

---

Dokumentasi ini dibuat agar developer lain bisa langsung memahami arsitektur dan langkah menjalankan web UKM Panahan. Selamat mengembangkan!
