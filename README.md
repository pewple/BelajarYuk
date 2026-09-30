# Belajar Yuk!

Aplikasi belajar interaktif berbahasa Indonesia untuk balita usia ±3 tahun.
Tiga permainan: **Mengenal Huruf**, **Belajar Bicara**, dan **Berhitung 1–10**.

Tidak butuh file audio — semua suara bawaan dihasilkan saat aplikasi berjalan
(Web Speech API untuk pengucapan, Web Audio API untuk efek suara). Suara dan
gambar buatan sendiri bersifat opsional dan menggantikan bawaan satu per satu.

## Versi seret-dan-lepas (untuk dibagikan)

```bash
npm run package
```

Hasilnya di folder `release/`:

| Berkas | Kegunaan |
| --- | --- |
| `release/Belajar-Yuk/` | Klik dua kali `index.html`, **atau** seret seluruh folder ke <https://app.netlify.com/drop> / hosting statis mana pun |
| `release/Belajar-Yuk.zip` | Folder yang sama, dizip untuk dikirim |

Folder itu berdiri sendiri: tanpa Node, tanpa internet, tanpa instalasi. Isinya
sudah menyertakan `BACA-SAYA.txt` (panduan untuk pengguna), `Perbarui-Media.bat`,
dan folder `media/` siap diisi. Pengguna akhir cukup menaruh berkas suara/gambar,
klik dua kali `Perbarui-Media.bat`, lalu muat ulang.

Bisa dibuka langsung dari disk (`file://`) karena bundelnya berupa skrip biasa,
bukan `<script type="module">` yang diblokir browser pada `file://`.
`scripts/package.mjs` menolak membuat paket kalau syarat itu tidak terpenuhi.

## Menjalankan

```bash
npm install
npm run dev
```

Lalu buka <http://localhost:5173>.

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan Vite |
| `npm run build` | Cek TypeScript + build produksi ke `dist/` |
| `npm run preview` | Melihat hasil build produksi |
| `npm run media` | Membuat ulang `public/media/manifest.js` dari isi `public/media/` |
| `npm run package` | Build + bungkus jadi `release/Belajar-Yuk/` dan `.zip` |
| `npm test` | Menjalankan tes Vitest |

## Tumpukan teknologi

React 19 · TypeScript · Vite · Tailwind CSS v4 · lucide-react · Vitest + React Testing Library

## Struktur

```
src/
  hooks/useAudio.ts        Web Speech (id-ID / en-US) + efek suara Web Audio
  hooks/useArrowKeys.ts    Navigasi papan ketik untuk kartu
  data/curriculum.ts       Huruf A-Z, kartu kata A-Z, set objek berhitung, tema warna
  data/navigation.ts       Tiga pilihan di layar utama
  media/manifest.ts        Membaca media/manifest.js saat aplikasi berjalan
  media/clips.ts           Rekaman suara sendiri -> menggantikan mesin suara
  media/pictures.ts        Gambar sendiri -> menggantikan ikon lucide
  media/slots.ts           Daftar lengkap semua slot yang bisa diganti
  components/              ScreenFrame, StepButton, PulseRing, LangToggle, CardArt, Celebration
  screens/                 Home, Alphabet, Pronunciation, Counting, MediaCheck (#media)
  test/                    Setup jsdom + tes integrasi
public/media/              Suara dan gambar sendiri (audio/, images/, manifest.js)
packaging/                 Berkas untuk pengguna akhir: Perbarui-Media.bat/.ps1, BACA-SAYA.txt
scripts/                   media-manifest.mjs, package.mjs
```

## Dasar pedagogis

Keputusan desain di aplikasi ini mengikuti praktik pembelajaran anak usia dini:

**Multisensori & berbasis main.** Setiap ketukan selalu memasangkan perubahan
visual dengan umpan balik suara seketika — cincin denyut + pengucapan pada huruf,
"pop" + objek memudar pada berhitung. Pasangan visual–auditori inilah yang
membangun ingatan huruf dan bilangan di usia ini, bukan pengulangan pasif.

**Kesadaran fonologis.** Huruf diucapkan dengan nama yang ditulis ulang secara
ortografis (`B` → "be", `G` → "ge", `H` → "ha") supaya mesin suara membacanya
benar. Ada tombol **ID / EN** di layar Mengenal Huruf untuk memilih bahasa nama
huruf; pilihannya tersimpan dan juga berlaku untuk tombol huruf di Belajar
Bicara. Kata Indonesia selalu diucapkan dalam Bahasa Indonesia, apa pun
pilihannya. Di Belajar Bicara, huruf dan kata punya tombol terpisah: anak bisa
mendengar bunyi hurufnya sendiri, lalu kata utuhnya. Seluruh 26 huruf punya
kartunya sendiri; Q, X, Y dan Z memakai kata serapan karena Bahasa Indonesia
tidak punya padanan asli yang dikenal balita.

**Beban kognitif & motorik rendah.** Satu layar = satu keputusan. Maksimal tiga
elemen interaktif utama, semuanya besar (kartu huruf 224–288 px, tombol navigasi
80–96 px, objek hitung 96–160 px), berbentuk membulat, dengan status tekan
`active:scale-95` yang jelas. Tidak ada target yang bergerak terus-menerus.
Tombol pulang selalu di tempat yang sama. Ketukan ganda pada objek yang sudah
dihitung diabaikan diam-diam — tidak ada suara "salah".

**Korespondensi satu-satu.** Di Berhitung, setiap objek yang diketuk langsung
diberi angka urut dan diucapkan ("satu", "dua", "tiga"). Setiap ronde dibuka
dengan instruksi lisan **"Ayo hitung!"** — anak belum bisa membaca petunjuk di
layar. Ketukan terakhir kebetulan adalah jumlah totalnya, sehingga totalnya bisa
diumumkan langsung. Susunan objek dibuat mudah dikenali polanya: 4 sebagai
persegi 2×2, 10 sebagai dua baris lima.

**Penguatan positif.** Penyelesaian memicu konfeti, arpeggio nada mayor, angka
yang berubah dari "?" menjadi jumlahnya, dan pujian singkat yang dirotasi
("Hebat!", "Pintar!", …). Kartu ucapan menghilang setelah ±1,9 detik supaya anak
kembali melihat objek yang baru saja ia hitung.

**Bisa dijalankan dari papan ketik.** Tombol panah kiri/kanan memindah kartu di
Mengenal Huruf dan Belajar Bicara; spasi atau enter membunyikan kartu yang
sedang tampil. Balita menemukan dua tombol panah jauh sebelum bisa mengarahkan
tetikus.

## Mengganti gambar dan suara

Dua folder, tanpa mengubah kode dan **tanpa build ulang**:

| Saat pengembangan | Di paket seret-dan-lepas | Isi |
| --- | --- | --- |
| `public/media/audio/` | `media/audio/` | Rekaman suara — menggantikan mesin suara |
| `public/media/images/` | `media/images/` | Gambar sendiri — menggantikan ikon lucide |

1. Taruh berkas dengan nama yang benar (`words/apel.mp3`, `letters/id/b.mp3`,
   `numbers/3.mp3`, `ui/pop.mp3`, `counting/apel.png`, …).
2. Perbarui daftarnya: `npm run media` (pengembang) atau klik dua kali
   `Perbarui-Media.bat` (paket).
3. Muat ulang halaman.

Yang tidak ada akan otomatis kembali ke suara/ikon bawaan, jadi bisa dicicil
satu per satu. Daftar nama lengkap ada di `packaging/BACA-SAYA.txt`.

**Kenapa perlu daftar (`manifest.js`)?** Halaman web statis tidak bisa membaca
isi folder. `media/manifest.js` — skrip biasa, bukan modul, jadi tetap terbaca
lewat `file://` — memberi tahu aplikasi berkas apa saja yang ada. Dibaca saat
aplikasi berjalan, bukan saat build, itulah yang membuat paket bisa diubah
tanpa alat pengembang.

**Salah eja nama berkas tidak menimbulkan galat** — berkasnya hanya tidak
dipakai. Buka `index.html#media` untuk melihat halaman pemeriksa: status setiap
slot, tombol putar, kalimat yang harus diucapkan untuk slot yang belum ada, dan
daftar berkas yang "terdaftar tapi tidak dipakai". Halaman itu tidak punya
tautan di aplikasi, jadi anak tidak akan membukanya tanpa sengaja.

Merekam suara sendiri adalah satu-satunya cara mendapat pengucapan Bahasa
Indonesia yang benar-benar tepat di perangkat tanpa voice `id-ID`.

## Catatan teknis

- **Suara Bahasa Indonesia.** Ini penentu kualitas pengucapan. Meminta
  `id-ID` pada perangkat yang tidak punya voice Indonesia **tidak gagal
  dengan jelas** — mesin suara diam-diam memakai suara bawaannya (biasanya
  Inggris) dan membaca ejaan Indonesia dengan aturan Inggris, sehingga
  "Belajar Yuk" terdengar *buh-LAY-jar YUCK*.

  Tiga tingkat penanganannya, dari paling baik:

  1. **Rekam sendiri** ke `media/audio/` — paling tepat, dan tidak
     bergantung pada perangkat.
  2. **Pasang voice Indonesia.** Di Windows: Settings › Time & language ›
     Language & region › Bahasa Indonesia › Language options › Speech.
  3. **Ejaan fonetik otomatis** (`EN_VOICE_RESPELL` di `hooks/useAudio.ts`).
     Kalau tidak ada voice Indonesia, aplikasi menyuapi suara Inggris ejaan
     seperti `buh-lah-jar yook` dan `sah-too`, bukan ejaan Indonesia mentah.
     Hasilnya perkiraan, bukan pengucapan baku — silakan disetel sendiri.

  Tingkat 3 otomatis mati begitu voice Indonesia terpasang, jadi tidak
  pernah membuat perangkat yang sudah benar jadi lebih buruk. Tabel ejaan
  Indonesia yang sebenarnya (`LETTER_NAMES_ID`) tetap ejaan yang benar.
- **Kebijakan autoplay.** `AudioContext` dibuat dan di-`resume()` hanya dari
  gestur pengguna sungguhan (ketukan pertama di layar utama).
- **`prefers-reduced-motion`** dihormati: semua animasi dimatikan.
- Seluruh hook audio aman dipanggil di lingkungan tanpa Web Speech/Web Audio
  (mis. jsdom saat pengujian) — semua menjadi no-op.
