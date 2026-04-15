import Link from 'next/link'

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-cyan-50 via-emerald-50 to-amber-50 text-slate-900">
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-cyan-200/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-200/60 blur-3xl" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 sm:py-24">
        <div className="w-full max-w-5xl rounded-[32px] border-2 border-blue-950/70 bg-white/95 p-6 sm:p-8 md:p-10 shadow-2xl shadow-slate-200/40 backdrop-blur">
          <div className="mb-8 flex flex-col items-center justify-center gap-4 text-center sm:mb-10">
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-blue-950/70 bg-cyan-50 text-3xl sm:text-4xl font-bold text-cyan-700 shadow-inner">
              <img src="/Logo_UKM.png" alt="Logo UKM Panahan Unila" />
            </div>
            <h1 className="max-w-3xl text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900">
              UKM-U Panahan Unila
            </h1>
            <p className="max-w-2xl text-base sm:text-lg text-slate-600" style={{ fontStyle: 'italic', fontWeight: 'bold' }}>
              "Melesat, Meraih, Prestasi"
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border-2 border-blue-950/70 bg-slate-50 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Tentang UKM</h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600">Kami membantu anggota mengejar keterampilan panahan melalui program latihan dan kegiatan bersama.</p>
              <ul className="mt-6 space-y-4 text-sm sm:text-base text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">🤝</span>
                  <span>Lingkungan belajar yang suportif untuk semua level.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">🎯</span>
                  <span>Fokus pada latihan rutin, teknik, dan persiapan kompetisi.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">💜</span>
                  <span>Menjaga semangat kebersamaan dalam setiap kegiatan.</span>
                </li>
              </ul>
            </section>

            <section className="rounded-3xl border-2 border-blue-950/70 bg-slate-50 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Akses Anggota</h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600">Masuk untuk melihat jadwal latihan, kehadiran, dan perkembangan anggota secara internal.</p>
              <div className="mt-6 sm:mt-8 space-y-4">
                <Link
                  href="/login"
                  className="block rounded-2xl bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-400 px-4 sm:px-6 py-3 sm:py-4 text-center text-base sm:text-lg font-semibold text-white shadow-lg shadow-cyan-200/50 transition hover:-translate-y-0.5"
                >
                  Masuk Anggota
                </Link>
                <Link
                  href="/register"
                  className="block rounded-2xl bg-gradient-to-r from-emerald-100 via-emerald-200 to-amber-100 px-4 sm:px-6 py-3 sm:py-4 text-center text-base sm:text-lg font-semibold text-emerald-800 transition hover:from-emerald-200 hover:to-amber-200"
                >
                  Daftar Anggota Baru
                </Link>
              </div>
            </section>
          </div>

          <div className="mt-8 sm:mt-12 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border-2 border-blue-950/70 bg-slate-50 p-4 sm:p-6 text-center shadow-sm">
              <p className="text-xs sm:text-sm uppercase tracking-[0.18em] text-emerald-700">Pelatihan</p>
              <p className="mt-2 sm:mt-4 text-lg sm:text-xl font-semibold text-slate-900">Dasar Hingga Mahir</p>
            </div>
            <div className="rounded-3xl border-2 border-blue-950/70 bg-slate-50 p-4 sm:p-6 text-center shadow-sm">
              <p className="text-xs sm:text-sm uppercase tracking-[0.18em] text-amber-700">Prestasi</p>
              <p className="mt-2 sm:mt-4 text-lg sm:text-xl font-semibold text-slate-900">Kompetisi & Event</p>
            </div>
            <div className="rounded-3xl border-2 border-blue-950/70 bg-slate-50 p-4 sm:p-6 text-center shadow-sm">
              <p className="text-xs sm:text-sm uppercase tracking-[0.18em] text-cyan-700">Organisasi</p>
              <p className="mt-2 sm:mt-4 text-lg sm:text-xl font-semibold text-slate-900">Leadership</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
