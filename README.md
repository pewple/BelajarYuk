# Belajar Yuk!

Aplikasi belajar interaktif berbahasa Indonesia untuk balita usia ±3 tahun.
Delapan permainan: **Mengenal Huruf**, **Belajar Bicara**, **Berhitung 1–10**,
**Menulis** (menelusuri huruf dan angka dengan jari), **Pola** (melanjutkan barisan
bentuk berwarna), **Memori** (mencari pasangan kartu), **Labirin** (mengikuti urutan
huruf atau angka sampai ke tujuan), dan **Kasir** (menghitung uang kembalian selangkah
demi selangkah). Huruf dan angka bisa ditulis Latin atau Arab (hijaiyah).

Nomor versi (`v1.1.0`, dari `package.json`) tampil kecil di pojok kanan atas setiap
halaman. Di bawah layar utama ada catatan singkat untuk orang tua: aplikasi bisa dipasang
dan dibuka tanpa internet, berjalan hanya di perangkat ini, **tanpa cookie**, tanpa akun,
tanpa pelacak, dan tidak mengirim data ke mana pun (pengaturan dan catatan belajar disimpan
di penyimpanan lokal perangkat). Bagian "bisa dipasang" disembunyikan bila aplikasi sudah
terpasang atau dibuka dari folder (`file://`).

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

## Otomatis tayang di Netlify (dari GitHub)

Repo ini terhubung ke Netlify. Setiap `git push` ke cabang `main` memicu build di
Netlify sesuai `netlify.toml`:

1. `npm run build:site` = **tes dulu, baru build**. Kalau ada tes yang gagal,
   build gagal dan **situs yang sedang tayang tidak berubah**.
2. Hasil `dist/` dipublikasikan. Berkas hasil build (`/assets/*`) di-cache lama;
   `index.html` dan `media/` selalu dicek ulang, jadi rekaman baru langsung terbaca.

Node 22 dipakai (`.nvmrc` + `NODE_VERSION`), karena Vite 8 butuh Node ≥ 20.19.

**Mengganti suara/gambar tanpa alat pengembang:** taruh berkas di
`public/media/audio/` atau `public/media/images/`, commit, push. Langkah
`prebuild` membuat ulang `manifest.js` otomatis — tidak perlu `npm run media`.

## Dipasang sebagai aplikasi (PWA)

Di alamat https (mis. situs Netlify) dan `localhost`, aplikasi bisa **dipasang** dan
**dibuka tanpa internet**:

- **Android / Chrome / Edge:** menu ⋮ › *Instal aplikasi* (atau *Tambahkan ke layar utama*).
- **iPhone / iPad (Safari):** tombol Bagikan › *Tambah ke Layar Utama*.
- **Komputer (Chrome/Edge):** ikon pasang di ujung kanan bilah alamat.

Sesudah itu ia punya ikon sendiri, terbuka layar penuh tanpa bilah browser, dan tetap
jalan di pesawat atau di mobil tanpa sinyal — asalkan sudah pernah dibuka sekali
dengan internet.

Cara kerjanya (semua dibuat otomatis saat `npm run build`):

| Berkas | Isi |
| --- | --- |
| `public/manifest.webmanifest` | Nama, warna, dan ikon aplikasi |
| `public/icons/*.png` | Ikon 192, 512, *maskable* 512, dan ikon iOS 180 (digambar oleh `npm run icons`) |
| `scripts/sw-template.js` | Isi *service worker*; `scripts/make-sw.mjs` mengisinya dan menulis `dist/sw.js` |
| `src/pwa.ts` | Mendaftarkannya — hanya di build produksi dan hanya lewat http(s) |

- **Aplikasi** (halaman, skrip, ikon) disimpan saat kunjungan pertama dan dibuka dari
  simpanan itu seketika; pembaruan diambil di belakang layar dan muncul pada kunjungan
  berikutnya — tidak pernah di tengah permainan anak. Nama versi adalah hash isi berkas,
  jadi setiap build yang berbeda otomatis menggantikan simpanan lama.
- **Rekaman dan gambar sendiri** (`media/`) disimpan terpisah, jadi pembaruan aplikasi
  tidak membuangnya. `media/manifest.js` selalu ditanyakan ke internet lebih dulu supaya
  rekaman baru langsung muncul; kalau offline dipakai salinan terakhir. Audio dilayani
  per potongan (Range) karena Safari mewajibkannya.
- **Versi seret-dan-lepas lewat `file://`** tidak memakai ini (browser tak mengizinkan, dan
  folder itu sudah ada di perangkat). Kalau folder yang sama diunggah ke hosting https,
  ia otomatis bisa dipasang.
- Untuk membatalkan: hapus aplikasi dari layar utama, atau di browser *Site settings ›
  Clear data*.

## Menjalankan

```bash
npm install
npm run dev
```

Lalu buka <http://localhost:5173>.

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan Vite |
| `npm run build` | Cek TypeScript + build produksi ke `dist/` (membuat ulang `manifest.js` lebih dulu) |
| `npm run build:site` | Tes + build — yang dijalankan Netlify |
| `npm run preview` | Melihat hasil build produksi |
| `npm run media` | Membuat ulang `public/media/manifest.js` dari isi `public/media/` |
| `npm run icons` | Menggambar ulang ikon aplikasi (`public/icons`) |
| `npm run package` | Build + bungkus jadi `release/Belajar-Yuk/` dan `.zip` |
| `npm test` | Menjalankan tes Vitest |

## Tumpukan teknologi

React 19 · TypeScript · Vite · Tailwind CSS v4 · lucide-react · Vitest + React Testing Library

## Struktur

```
src/
  audio/words.ts           Nama huruf, kata bilangan, pujian (teks saja)
  audio/respell.ts         Ejaan fonetik untuk suara Inggris (bila tak ada suara Indonesia)
  audio/voice.ts           Antrean suara: rekaman + Web Speech, suara asli bahasa Arab
  audio/effects.ts         Efek suara (pop, lonceng, koin, ...) lewat Web Audio
  hooks/useAudio.ts        Hanya menyambungkan modul audio ke React dan suara terpasang
  hooks/useInstruction.ts  Perintah lisan sekali + pengingat sekali; useKnowsTheDrill
  hooks/useFlash.ts        Nilai yang kembali sendiri (sorotan, goyang)
  hooks/useArrowKeys.ts    Navigasi papan ketik untuk kartu
  data/curriculum.ts       Huruf A-Z, kartu kata A-Z, set objek berhitung, tema warna
  data/navigation.ts       Pilihan di layar utama
  data/pola.ts             Bentuk, tingkat pola, dan cara membuat satu ronde
  data/memori.ts           Aturan Memori: memilih pasangan, mengocok, membalik kartu
  data/tracing.ts          Garis huruf/angka (A-Z, 0-9) dan aturan mengikuti garis dengan jari
  media/memoriVoice.ts     "Cari yang sama!", nama tiap kartu
  media/menulisVoice.ts    "Ikuti garisnya!", "Pilih huruf atau angka!"
  components/VersionBadge  Nomor versi di pojok kanan atas
  components/AppNotice     Catatan PWA dan privasi di layar utama
  data/arabicWords.ts      Dek kata Arab (28 huruf, satu kata tiap huruf)
  components/drawnIcons.ts Gambar buatan untuk kata yang tak punya ikon lucide
  components/PolaToken.tsx Bentuk berwarna (lingkaran merah, kotak biru, ...)
  components/PolaBox.tsx   Kotak berisi 2-4 bentuk (ditumpuk, atau persegi 2 x 2)
  media/polaVoice.ts       "Lanjutkan polanya!", nama warna, barisan dibacakan
  src/pwa.ts               Mendaftarkan service worker
  data/money.ts            Pembeli, pecahan uang, "seribu"/"dua belas ribu", hitung maju
  data/maze.ts             Tingkat labirin, pembuat labirin berbasis rute, aturan ketukan
  data/scripts.ts          Huruf hijaiyah (28), angka Arab ٠-٩, nama bacanya
  media/scriptVoice.ts     Nama huruf/angka Arab -> rekaman, suara Arab, atau ejaan Indonesia
  data/session.ts          Batas 15 menit, 5 permainan, 15 detik diam, ...
  data/hints.ts            Petunjuk yang memudar (aturan murni)
  data/review.ts           Tangga ulangan berjarak (Leitner)
  state/play.tsx           Hitungan permainan per modul -> gerbang tombol rumah
  components/ParentGate    Soal penjumlahan untuk orang tua
  components/RestBreak     Layar istirahat setelah 15 menit
  components/ScriptToggle  Tombol "ABC | ابت"
  media/manifest.ts        Membaca media/manifest.js saat aplikasi berjalan
  media/clips.ts           Rekaman suara sendiri -> menggantikan mesin suara
  media/pictures.ts        Gambar sendiri -> menggantikan ikon lucide
  media/slots.ts           Daftar lengkap semua slot yang bisa diganti
  media/voiceParts.ts      Kalimat disusun dari potongan (rekaman bila ada, kalau tidak suara mesin)
  media/moneyVoice.ts      Kalimat kasir
  media/mazeVoice.ts       Kalimat labirin
  components/              ScreenFrame, StepButton, PulseRing, LangToggle, CardArt, MoneyPiece, Celebration,
                           ModeChooser (layar pilihan), RoundButtons (Lanjut, tombol ikon)
  screens/                 Home, Alphabet, Pronunciation, Counting, Menulis, Pola, Memori, Labirin, Kasir, MediaCheck (#media)
  test/                    Setup jsdom + tes integrasi
public/media/              Suara dan gambar sendiri (audio/, images/, manifest.js)
packaging/                 Berkas untuk pengguna akhir: Perbarui-Media.bat/.ps1, BACA-SAYA.txt
scripts/                   media-manifest.mjs, package.mjs
```

## Pengujian

`npm test` menjalankan semua tes (±1.350) dalam sekitar 20 detik di komputer 16 inti; Netlify
menjalankannya sebelum setiap build. Beberapa hal yang membuatnya cepat, supaya tidak
terhapus tanpa sengaja:

- `src/test/user.ts` — `setupUser()` dipakai semua tes, bukan `userEvent.setup()` langsung.
  `click`-nya hanya satu peristiwa klik (yang memang dipakai aplikasi); user-event penuh
  menjalankan gerak mouse, fokus, dan sebagainya, 2–3 kali lebih lambat. Selain klik tetap user-event.
- `src/test/setup.ts` mematikan penangkapan *stack trace* tiap elemen oleh React versi pengembangan
  (separuh biaya tiap render di tes, dan tak dibaca siapa pun).
- Tes yang menunggu waktu nyata (mis. hitungan Kasir yang mengosong sendiri) memakai *fake timers*.
- Satu permainan penuh dimainkan sekali per jenis, bukan di beberapa tes yang sama.

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

**Labirin: mengikuti urutan.** Sebelum mulai, ada layar pilihan: **Huruf**,
**Angka**, atau **Acak** (Acak = tiap labirin dilempar koin, hurufnya atau angkanya).
Pilihan ini tidak diingat — setiap masuk, ditanya lagi. Satu tingkat punya bentuk
yang sama untuk huruf maupun angka; yang berbeda hanya tulisannya.

Jalan menuju tujuan dilapisi huruf berurutan
(A B C ...) atau angka berurutan (1 2 3 ...). Awalnya kotak pertama menampilkan
hurufnya/angkanya sendiri dan gambar hewan hanya kecil di pojok; kotak itu
bergoyang pelan sebagai ajakan "mulai dari sini". Kotak terakhir (tujuan) sama:
hurufnya/angkanya yang besar, hadiahnya kecil di pojok, sampai hewan tiba di sana.
**Ketuk kotak pertama** untuk
memulai: baru saat itu hewan pindah ke tengah dan membesar. Sebelum itu, ketukan di
kotak lain diabaikan. Di papan ketik, tekan panah apa saja sebagai ketukan pertama.
Setelahnya, anak mengetuk kotak di sebelah
hewan yang berisi huruf/angka *berikutnya*. Cabang buntu berisi huruf/angka di
luar urutan, jadi di setiap persimpangan anak harus tahu apa yang datang
selanjutnya — itulah yang dilatih, bukan sekadar mengikuti dinding. Mengetuk
cabang buntu dijawab dengan bunyi lembut, kotak bergoyang, dan petunjuk lisan
("Cari huruf be!") — bukan hukuman — lalu kotak yang benar menyala sebentar.
Sorotan itu sengaja muncul *setelah* salah ketuk; kalau selalu menyala, tidak ada
yang perlu dipikirkan. (Pengecualiannya anak yang baru mulai: untuk mereka sorotan
menyala terus sampai mereka lancar — lihat "Petunjuk yang memudar" di bawah.) Labirin dibuat dari rute dulu (rute yang berkelok dan tidak
pernah menempel dengan dirinya sendiri), lalu cabang buntu ditambahkan, sehingga
papan selalu berupa pohon: hanya ada satu jalan, tanpa putaran. Angka dibatasi
sampai 10 — angka yang sudah dikenal dari Berhitung.

**Kasir: menghitung kembalian.** Pembeli membeli sesuatu dan membayar dengan
uang yang lebih besar. Anak harus *menghitung sendiri* berapa kembaliannya
(dibayar − harga) lalu memberikannya dari baki berisi **empat pecahan tetap:
Rp 500, 1.000, 2.000, dan 5.000**. Soalnya ditampilkan dengan jawaban yang masih
tersembunyi (`5.000 − 3.500 = ?`) dan baru terbuka setelah benar.

Keempat pecahan selalu ada, di tempat yang sama, untuk setiap pembeli — tidak ada
yang disembunyikan karena "terlalu besar". Justru karena itu anak *bisa* memberi
terlalu banyak, dan itulah yang membuat jawabannya harus dipikirkan, bukan
disodorkan. Aplikasi menjumlahkan **hanya kembalian yang sudah diberikan** (mulai
dari nol, bukan harga ditambah kembalian), lalu menampilkan dan mengucapkan total
itu saja: "seribu... seribu lima ratus...". Begitu totalnya melewati yang seharusnya,
jawabannya "**Salah, hitung kembali**" — bunyi lembut (bukan buzzer), pesan di layar,
dan langkah yang kelebihan ditandai merah. Hitungan lalu kosong sendiri setelah
sekitar 2,6 detik (atau segera lewat tombol ulang) dan anak mencoba lagi dengan
pembeli yang sama. Tidak ada hukuman yang menumpuk. Setiap langkah ditulis seperti
struk (`1.000 + 500 = 1.500`), dan saat benar "ka-ching" berbunyi serta hitungannya
ditulis lengkap: `5.000 − 3.500 = 1.500`.

**Batas pemakaian tiap pecahan.** Untuk satu pembeli, Rp 500 hanya boleh dipakai **paling
banyak 3 kali**, Rp 1.000 empat kali, Rp 2.000 tiga kali, dan Rp 5.000 dua kali
(`PIECE_LIMITS` di `data/money.ts`). Tanpa batas, anak bisa mencapai jumlah apa pun dengan
mengetuk Rp 500 berulang-ulang — menghitung per setengah ribu, bukan memilih uang yang
tepat — dan Rp 8.000 jadi enam belas ketukan. Pecahan kecil dibatasi paling ketat, jadi jalan
keluarnya memakai pecahan yang lebih besar. Sisa pemakaian tampak sebagai **titik-titik** di
bawah tiap uang (satu titik per kali yang masih boleh, mengosong saat dipakai); uang yang
sudah habis dimatikan tetapi tetap di tempatnya (keempat uang tak pernah berpindah). Batas
itu juga terbaca oleh pembaca layar ("Masih bisa 2 kali"). Setiap pembeli tetap bisa dilayani
tepat dalam batas itu (ada tes yang memeriksanya).

Karena pecahan kecil bisa habis, ada satu jalan buntu baru, dan ia ditangani dengan aturan
lama: begitu jalan menuju kembalian yang tepat tertutup — mis. tiga kali Rp 500 untuk
Rp 3.000, sisa Rp 1.500 tak bisa dibuat tanpa Rp 500 — hitungannya dijawab **"Salah, hitung
kembali"** seperti kelebihan, lalu dikosongkan dan titik-titik penuh lagi. Anak tidak pernah
dibiarkan di baki yang tak mungkin benar. Petunjuk (sorotan) memilih uang terbesar yang
masih muat *dan* masih bisa menuntaskan hitungan.

Semua jumlah kelipatan Rp 500, sehingga setiap total terdengar bersih ("seribu lima
ratus"). Anak bisa kelebihan, tapi ia selalu diberi tahu sebelum buntu. Beberapa harga berakhiran 500 supaya pecahan itu benar-benar
terpakai. Warna uang mengikuti uang kertas Rupiah asli. Ini jauh lebih sulit
daripada tiga permainan lainnya: cocok untuk anak yang sudah bisa berhitung sampai
10, bukan untuk usia 3 tahun yang baru mulai.

**Tulisan Arab (bisa diganti-ganti).** Tombol **ABC | ابت** di Mengenal Huruf,
Belajar Bicara, Berhitung, dan Labirin mengganti huruf Latin menjadi 28 huruf hijaiyah (ا ب ت …)
dan angka Latin menjadi angka Arab-Hindi (١ ٢ ٣ …). Pilihan itu satu untuk semua
permainan dan diingat di perangkat.

*Suaranya.* Urutan yang dipakai untuk setiap nama huruf/angka: (1) rekaman Anda di
`letters/ar/alif.mp3`, …, `numbers/ar/1.mp3`, … (daftar di `BACA-SAYA.txt`); (2) **suara
Arab bawaan perangkat**, yang diminta dengan tulisan Arab (ألف، باء، … واحد، اثنان …)
supaya dibaca dengan pelafalan Arab asli; (3) bila perangkat tidak punya suara Arab,
ejaan Indonesia (*alif, ba, ta*; *wahid, itsnan*) lewat suara Indonesia — perkiraan,
bukan makhraj yang baku. Tulisan Arab tidak pernah dikirim ke suara Indonesia (hasilnya
diam atau ngawur). Bagian Indonesia di kalimat yang sama ("Ikuti huruf dari … sampai …")
tetap diucapkan suara Indonesia, jadi satu kalimat bisa dibacakan dua suara.

Memasang suara Arab: Windows › Settings › Time & language › Language & region › Add a
language › Arabic › Language options › Speech; Android dan iOS umumnya sudah punya
(Android: paket suara Google, iOS: Maged/Majed); Edge memiliki suara Arab daring.
Muat ulang halaman setelahnya.

**Belajar Bicara punya dek Arab sendiri**: 28 kartu, satu kata sehari-hari untuk tiap
huruf hijaiyah (أَرْنَب kelinci, بَاب pintu, تُفَّاح apel …), ditulis dengan harakat dan
dibacakan dengan suara Arab (atau ejaan Indonesia bila tak ada), lengkap dengan bacaan
Latin dan artinya untuk orang tua. Katanya diambil dari daftar awal yang Anda berikan;
bila ada dua kata untuk satu huruf dipilih yang gambarnya mudah dikenali (أَرْنَب, bukan
أَسَد; لَيْمُون, bukan لَعِب). Gambarnya ikon lucide; empat kata yang tak punya ikon
(keju, roti, beruang, emas) digambar sendiri di `components/drawnIcons.ts`. Semuanya bisa
diganti: rekaman di `words/ar/<id huruf>.mp3`, gambar di `words/ar/<id huruf>.png`
(mis. `words/ar/alif`; daftar lengkap di halaman `#media`).

Kasir sengaja tidak ikut: Rupiah ditulis dengan angka biasa. Di mode Arab, tombol ID/EN
dimatikan (hanya ada satu cara baca).

**Gerbang orang tua pada tombol rumah.** Di dalam permainan, tombol rumah awalnya
abu-abu dengan gembok kecil. Mengetuknya memunculkan soal penjumlahan (mis. `7 + 6`)
dengan papan angka; jawabannya dua angka, jadi menekan asal hampir tak pernah lolos.
Salah, kosong, atau ketuk "Kembali bermain" = langsung kembali ke permainan, tanpa
hukuman. Benar = pulang. Setelah **5 permainan selesai di modul itu** tombol berubah
normal dan tak lagi digembok. Satu "permainan" = satu ronde Berhitung selesai, satu
labirin selesai, satu pembeli dilayani, satu pola, satu pasangan kartu Memori selesai, satu huruf
Menulis selesai, atau (di Mengenal Huruf dan Belajar Bicara) satu kartu *berbeda* yang
didengar. Hitungannya dimulai ulang setiap pindah modul. Soalnya sunyi (tidak dibacakan), dan
tombol panah/spasi di belakangnya tidak ikut menggerakkan permainan.

**Dibuka lebih awal untuk anak yang kesulitan.** Bila anak **salah 3 kali berturut-turut**
di modul itu, tombol rumah langsung dilepas (tanpa soal) selama sisa kunjungan itu: anak
yang sudah tiga kali salah bukan sedang ceroboh melainkan buntu, dan yang paling mungkin ia
inginkan adalah keluar. Satu jawaban benar di antaranya memulai hitungan dari nol; sekali
tercapai, pembukaan itu tetap sampai ia pindah modul. Yang dihitung adalah keputusan yang
bisa salah: pilihan di persimpangan Labirin, pilihan di Pola, pasangan yang tak cocok di
Memori, goresan yang melenceng di Menulis, dan di Kasir **satu hitungan utuh** (bukan tiap
uang di tengah jalan): hitungan salah dua kali lalu benar, lalu salah lagi, baru dihitung 1.
Berhitung, Mengenal Huruf, dan Belajar Bicara tidak punya jawaban salah, jadi tidak pernah
membukanya dengan cara ini.

**Istirahat setelah 15 menit.** Layar bulan yang lembut: "Sudah dulu ya! Sampai jumpa!"
(diucapkan) dengan satu tombol besar "Selesai" ke menu — tanpa "main lagi", tanpa hitung
mundur. Hanya waktu saat halaman benar-benar terlihat yang dihitung. Layar ini menunggu jeda
alami (satu permainan selesai, atau tiba di menu); kalau tidak ada jeda dalam 45 detik,
muncul juga.

Ini *dorongan*, bukan kunci: **hanya tombol rumah yang mengakhiri permainan.** Mengetuk di
mana saja selain tombol itu, atau menekan tombol papan ketik apa pun, menyingkirkan layar
istirahat dan permainan lanjut persis di tempat semula (tombol panah/spasi pertama hanya
menutup layar, tidak ikut menggerakkan permainan). Hanya Tab dan tombol pengubah (Shift,
Ctrl, Alt) yang diabaikan, supaya pengguna papan ketik masih bisa berpindah fokus; Enter/spasi
pada tombol "Selesai" itu sendiri berarti tombol itu ditekan. Ucapan perpisahan berhenti, dan
15 menit berikutnya dimulai dari awal.

**Petunjuk yang memudar.** Di Labirin dan Kasir, anak yang baru mulai mendapat petunjuk
terus-menerus: kotak berikutnya di labirin menyala; di Kasir, uang terbesar yang masih
muat menyala. Setelah **3 pilihan benar berturut-turut** petunjuk dilepas (di Labirin
hanya persimpangan sungguhan yang dihitung — yaitu ada jalan buntu di sebelah hewan);
setelah **2 pilihan salah berturut-turut** petunjuk kembali. Tingkatnya diingat per
permainan di perangkat ini. Anak yang sudah lancar tetap mendapat sorotan *sesudah*
salah ketuk, seperti sebelumnya. Berhitung dan dua modul huruf tidak punya jawaban
"salah", jadi tidak punya petunjuk yang memudar.

**Kunci ketukan ganda.** Satu ketukan balita sering berupa dua sentuhan dengan jeda
sepersekian detik. Kontrol yang sama diabaikan bila diketuk lagi dalam 0,35 detik —
tombol "Lanjut" tidak lagi melompati dua ronde, uang yang sama tidak terhitung dua kali,
panah tidak melewati satu huruf. Kontrol yang *berbeda* tidak saling menahan.

**Perintah lisan, tidak berlebihan.** Setiap modul mengucapkan apa yang harus dilakukan
saat dibuka ("Ketuk hurufnya!", "Ketuk gambarnya!", "Ayo hitung!", "Pilih huruf, angka,
atau acak!", dan pembeli di Kasir menyebut harga dan bayarannya). Tombol speaker di
pojok kanan atas mengulanginya kapan saja. Jika anak diam 15 detik, perintah diulang
*satu kali* (disentuh lagi = bisa diulang lagi), tidak lebih. Setelah 3 permainan selesai
di satu kunjungan, kalimat pembuka yang tak membawa informasi baru ("Ayo hitung!",
"Ayo hitung kembaliannya!") dihilangkan; harga dan bayaran pembeli tetap disebut.

**Ulangan berjarak (disimpan lokal).** Huruf/angka yang membuat anak salah di Labirin,
dan pembeli yang kembaliannya salah di Kasir, dicatat di tangga Leitner kecil: salah =
turun ke dasar dan segera muncul lagi; benar = naik satu anak tangga dengan jeda 10 menit
→ 1 hari → 3 hari → 1 minggu; setelah 3 anak tangga dianggap hafal. Hal yang tak pernah
salah tidak dicatat sama sekali. Huruf/angka yang jatuh tempo muncul sebagai *jalan buntu*
di labirin berikutnya (bentuk labirin tidak berubah), dan setiap pembeli ketiga di Kasir
diganti pembeli yang pernah salah (urutan tetap tidak kacau). Semuanya di `localStorage`
perangkat ini — tidak ada akun, tidak ada yang dikirim ke mana pun. Hapus data situs
untuk mengosongkannya.

**Aksesibilitas.** Semua target sentuh ≥ 64 px (termasuk pengalih ABC/ID), kontras
teks diperiksa ≥ 4,5:1 (3:1 untuk teks besar), `prefers-reduced-motion` dihormati,
setiap kontrol punya nama untuk pembaca layar, dan dialog (gerbang, istirahat) bersifat
modal dengan fokus pindah ke dalamnya.

**Pola: melanjutkan barisan.** Seperti Labirin, ada layar pilihan dulu — **Baris**, **Kotak**,
atau **Acak** (Acak = tiap ronde dilempar koin: baris atau kotak; pilihannya tidak diingat).
Lalu satu baris berulang dan satu tempat kosong bertanda "?". Anak memilih yang berikutnya
dari baki yang tidak berpindah.

- **Baris:** barisan *bentuk* ("merah, biru, merah, biru"). Tingkatnya: dua warna berulang
  (AB), yang digandakan (AAB, ABB), lalu tiga warna (ABC), masing-masing dengan beberapa
  kombinasi warna.
- **Kotak:** barisan *kotak*, tiap kotak berisi **dua sampai empat bentuk**: dua atau tiga
  ditumpuk satu di atas yang lain, empat membentuk persegi 2 × 2. Yang berulang adalah seluruh
  kotak (AB), dan kedua kotak berisi bentuk yang sama dengan susunan terbalik — jadi tahu
  warnanya saja tidak cukup, anak harus melihat letaknya. Tingkatnya: 2 bentuk (dua pasang
  warna), 3 bentuk (dua), lalu 4 bentuk (dua). Dibacakan per kotak dari atas ke bawah:
  "merah biru, biru merah, merah biru!". Kotak sengaja hanya AB agar lima kotak muat
  sebaris di layar ponsel.
- **Acak:** tiap kelompok mengikuti urutan tingkatnya sendiri (baris naik sendiri, kotak
  naik sendiri); jenis yang belum pernah muncul mulai dari tingkat pertamanya. Setiap baris menampilkan
**dua kali ulangan penuh**, sehingga hanya ada satu cara melanjutkannya; titik awal baris
berubah menurut ronde, jadi jawabannya tidak selalu "yang pertama".

Setiap bentuk punya warna **dan** rupa sendiri — lingkaran merah, kotak biru, segitiga
kuning, bintang hijau — dengan garis tepi gelap, jadi anak yang sulit membedakan warna
tetap bisa membedakan bentuk (dan kuning tetap terlihat di atas putih). Salah pilih: bunyi
lembut, bergoyang, "Coba lagi!", lalu pilihan yang benar menyala sebentar. Benar: seluruh
baris dibacakan ("merah, biru, merah, biru, merah!") sehingga anak mendengar iramanya,
bukan satu kata saja. Semua pengaman di atas berlaku di sini juga: gerbang tombol rumah,
petunjuk yang memudar (3 benar → lepas, 2 salah → kembali), kunci ketukan ganda, perintah
lisan sekali + ulang, dan ulangan berjarak (tingkat yang salah muncul lagi tiap ronde
ketiga). Warna bisa direkam di `colors/merah.mp3` dan seterusnya.

**Menulis: menelusuri huruf dan angka.** Pertama dipilih **Huruf** atau **Angka**. Lalu satu
per satu: papan putih dengan garis abu-abu sebagai pemandu, **titik kuning** tempat mulai
(bernomor bila hurufnya punya beberapa goresan), dan tinta berwarna yang mengikuti jari
selama jari tetap di garis. Goresan mengikuti urutan dan arah yang diajarkan di sekolah:
atas ke bawah, kiri ke kanan, bentuk bulat berlawanan arah jarum jam dari atas. Huruf A–Z
dan angka 1–9 lalu 0.

Aturannya sengaja sangat longgar (`data/tracing.ts`): koridor 13 satuan dari garis (papan
100 × 100), jadi jari kecil yang goyang tetap menggambar. Jari yang keluar garis cuma
berhenti menggambar — tinta tidak hilang, dan kembali ke ujung tinta melanjutkannya. Hanya
bila jauh sekali (26 satuan) terdengar bunyi lembut dan titik "ikuti aku" muncul, sekali per
penyimpangan. Menyentuh papan di tempat lain tidak menggambar apa-apa; melompat jauh di
sepanjang garis atau memotong bentuk bulat tidak bisa menyelesaikannya lebih cepat (jangkauan
ke depan dibatasi). Menyentuh huruf mengucapkan namanya; selesai mengucapkannya dengan
sorakan lalu pujian. Tombol mata (**Tunjukkan caranya**) memutar titik pemandu kapan saja;
**Lanjut** selalu ada (di papan ketik tidak ada cara menelusuri, jadi itu jalan keluarnya).

Petunjuk memudar seperti permainan lain: anak baru melihat titik biru yang berjalan di
depan jarinya sepanjang goresan; setelah **3 goresan bersih berturut-turut** titik itu hilang
(kecuali diminta), dan setelah **2 goresan yang melenceng** muncul lagi. Huruf yang goresannya
melenceng dicatat di ulangan berjarak dan muncul lagi tiap huruf ketiga. Titik pemandu tidak
bergerak sendiri bila perangkat memilih "kurangi gerak". Tombol ABC/ابت tidak ada di sini:
yang digambar selalu huruf Latin dan angka biasa.

*Belum ada:* menelusuri huruf hijaiyah dan angka ١–٩. Bentuknya bersambung, bertitik, dan
urutan goresannya punya aturan sendiri; garisnya sebaiknya dibuat atau diperiksa oleh orang
yang menulis Arab, bukan ditebak.

**Memori: mencari pasangan.** Kartu tertelungkup. Anak membalik satu, lalu satu lagi:
pasangan tetap terbuka (hijau, dengan tanda "sudah cocok"); yang tidak cocok tetap terlihat
1,8 detik lalu menutup lagi — selama itu kartu lain tidak bisa dibalik. Posisi kartu tidak
pernah berpindah dalam satu ronde. Setiap kartu yang dibalik mengucapkan namanya ("Apel",
"a"). Tingkatnya: 4, 6, lalu 8 kartu dengan **gambar yang sama**, kemudian **huruf dengan
gambar yang berawalan huruf itu** (A dan apel — hubungan yang diajarkan Belajar Bicara; di
mode Arab: huruf hijaiyah dan kartu katanya).

Anak baru mendapat dua bantuan: semua kartu **dibuka sebentar** (±4–5 detik) sebelum
ditutup, dan setelah salah tebak **pasangan yang dicari menyala**. Keduanya hilang setelah
3 tebakan benar berturut-turut dan kembali setelah 2 salah. Pasangan yang pernah salah
dicatat (ulangan berjarak) dan dimasukkan lebih dulu ke ronde berikutnya. Tombol *Kocok
ulang* mengocok lagi ronde yang sama.

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
  3. **Ejaan fonetik otomatis** (`EN_VOICE_RESPELL` di `audio/respell.ts`).
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
