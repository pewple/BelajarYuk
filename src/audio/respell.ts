/**
 * Respelling Indonesian for an English voice.
 *
 * Only used on a device with no Indonesian voice - see EN_VOICE_RESPELL.
 */

/** The tag used when an English voice has to stand in for a missing id-ID one. */
export const EN_FALLBACK_TAG = 'en-US';

/**
 * Phonetic respellings, used *only* when the device has no `id-ID` voice.
 *
 * Asking for `id-ID` on a machine that has none does not fail loudly - the
 * engine quietly substitutes its default voice and reads the Indonesian
 * spelling with English letter rules, so "Belajar Yuk" comes out
 * "buh-LAY-jar YUCK". These respellings hand that English voice something
 * that lands closer to the Indonesian vowels instead.
 *
 * The moment a real Indonesian voice is installed this table is ignored
 * entirely and the proper spellings (words.ts) are used, so it can never make a
 * correctly-configured device worse.
 *
 * Tune by ear - these are approximations, not a pronunciation standard.
 * Keys are lowercase with trailing punctuation stripped.
 */
export const EN_VOICE_RESPELL: Record<string, string> = {
  // Phrases
  'belajar yuk': 'buh-lah-jar yook',
  'ayo hitung': 'ah-yoh hee-toong',

  // Numbers
  nol: 'nohl',
  satu: 'sah-too',
  dua: 'doo-ah',
  tiga: 'tee-gah',
  empat: 'uhm-paht',
  lima: 'lee-mah',
  enam: 'uh-nahm',
  tujuh: 'too-jooh',
  delapan: 'duh-lah-pahn',
  sembilan: 'sum-bee-lahn',
  sepuluh: 'suh-poo-looh',

  // Praise
  hebat: 'heh-baht',
  pintar: 'peen-tar',
  'bagus sekali': 'bah-goos suh-kah-lee',
  keren: 'kuh-ren',
  'wah, pintar': 'wah, peen-tar',

  // Words used to build spoken amounts of money ("dua puluh lima ribu rupiah")
  ribu: 'ree-boo',
  seribu: 'suh-ree-boo',
  ratus: 'rah-toos',
  seratus: 'suh-rah-toos',
  puluh: 'poo-looh',
  belas: 'buh-lahs',
  sebelas: 'suh-buh-lahs',
  rupiah: 'roo-pee-ah',
  harganya: 'hahr-gah-nyah',
  dibayar: 'dee-bah-yar',
  kembaliannya: 'kuhm-bah-lee-ahn-nyah',
  ayo: 'ah-yoh',
  hitung: 'hee-toong',
  salah: 'sah-lah',
  kembali: 'kuhm-bah-lee',

  // Pola's kinds
  baris: 'bah-ris',
  kotak: 'koh-tahk',

  // Memori and Menulis
  sama: 'sah-mah',
  yang: 'yahng',
  garisnya: 'gah-ris-nyah',

  // Pola: colours and instructions
  merah: 'meh-rah',
  biru: 'bee-roo',
  kuning: 'koo-ning',
  hijau: 'hee-jow',
  lanjutkan: 'lahn-joot-kahn',
  polanya: 'poh-lah-nyah',
  coba: 'choh-bah',
  lagi: 'lah-ghee',

  // Instructions and the rest screen
  ketuk: 'kuh-took',
  hurufnya: 'hoo-roof-nyah',
  gambarnya: 'gahm-bar-nyah',
  sudah: 'soo-dah',
  dulu: 'doo-loo',
  jumpa: 'joom-pah',

  // The maze
  ikuti: 'ee-koo-tee',
  huruf: 'hoo-roof',
  angka: 'ahng-kah',
  dari: 'dah-ree',
  sampai: 'sahm-pie',
  cari: 'chah-ree',
  hore: 'hoh-reh',
  pilih: 'pee-leeh',
  atau: 'ah-tow',
  acak: 'ah-chahk',

  // Arabic letter names (hijaiyah), as Indonesian children say them. "ha" is
  // already above: ح and ه share it.
  alif: 'ah-leef',
  ba: 'bah',
  ta: 'tah',
  tsa: 'tsah',
  jim: 'jeem',
  kho: 'kho',
  dal: 'dahl',
  dzal: 'zahl',
  ro: 'roh',
  zai: 'zy',
  sin: 'seen',
  syin: 'sheen',
  shod: 'shohd',
  dhod: 'dhohd',
  tho: 'thoh',
  zho: 'zhoh',
  ain: 'ayn',
  ghoin: 'ghoyn',
  fa: 'fah',
  qof: 'qohf',
  kaf: 'kahf',
  lam: 'lahm',
  mim: 'meem',
  nun: 'noon',
  wau: 'wow',
  ya: 'yah',

  // Arabic word cards, as an Indonesian voice would read the spelling
  arnab: 'ar-nahb',
  bab: 'bahb',
  tuffah: 'too-fah',
  tsalj: 'tsahlj',
  jubn: 'joobn',
  halib: 'hah-leeb',
  khubz: 'khoobz',
  dubb: 'doob',
  dzahab: 'zah-hahb',
  "ra's": 'rahs',
  zahrah: 'zah-rah',
  samak: 'sah-mahk',
  syams: 'shahms',
  shunduq: 'shoon-dook',
  "dhau'": 'dhow',
  "tha'ir": 'thah-eer',
  zharf: 'zharf',
  ghabah: 'ghah-bah',
  fam: 'fahm',
  qamar: 'qah-mar',
  kitab: 'kee-tahb',
  laymun: 'lie-moon',
  "ma'": 'mah',
  najm: 'nahjm',
  hadiyyah: 'hah-dee-yah',
  ward: 'wahrd',
  yad: 'yahd',

  // Arabic numbers 1-10
  wahid: 'wah-heed',
  itsnan: 'its-nahn',
  tsalatsah: 'tsah-lah-tsah',
  "arba'ah": 'ar-bah-ah',
  khamsah: 'kham-sah',
  sittah: 'sit-tah',
  "sab'ah": 'sab-ah',
  tsamaniyah: 'tsah-mah-nee-yah',
  "tis'ah": 'tis-ah',
  asyarah: 'ah-shah-rah',

  // Letter names (the Indonesian ones, not the English toggle)
  a: 'ah',
  be: 'bay',
  ce: 'chay',
  de: 'day',
  e: 'ay',
  ef: 'eff',
  ge: 'gheh',
  ha: 'hah',
  i: 'ee',
  je: 'jay',
  ka: 'kah',
  el: 'ell',
  em: 'em',
  en: 'en',
  o: 'oh',
  pe: 'pay',
  ki: 'kee',
  er: 'air',
  es: 'ess',
  te: 'tay',
  u: 'oo',
  ve: 'vay',
  we: 'way',
  eks: 'ex',
  ye: 'yeh',
  zet: 'zett',

  // Word cards
  apel: 'ah-pell',
  buku: 'boo-koo',
  cangkir: 'chahng-keer',
  daun: 'dah-oon',
  'es krim': 'ess kreem',
  foto: 'foh-toh',
  gunung: 'goo-noong',
  hati: 'hah-tee',
  ikan: 'ee-kahn',
  jam: 'jahm',
  kucing: 'koo-ching',
  lampu: 'lahm-poo',
  mobil: 'moh-beel',
  nyamuk: 'nyah-mook',
  ombak: 'ohm-bahk',
  pisang: 'pee-sahng',
  quran: 'koor-ahn',
  rumah: 'roo-mah',
  susu: 'soo-soo',
  telur: 'tuh-loor',
  ulat: 'oo-laht',
  vitamin: 'vee-tah-meen',
  wortel: 'wor-tell',
  'x-ray': 'ex ray',
  yoyo: 'yoh-yoh',
  zebra: 'zeh-brah',
};

/** One entry from the table, keeping any trailing punctuation so "!" keeps its lift. */
function respellOne(text: string): string | null {
  const bare = text.replace(/[!.,?]+$/, '');
  const suffix = text.slice(bare.length);
  const hit = EN_VOICE_RESPELL[bare.toLowerCase()];
  return hit === undefined ? null : hit + suffix;
}

/**
 * The English-voice spelling of `text`, or null when there is none.
 *
 * A whole phrase is looked up first ("belajar yuk"). Failing that, longer text
 * is respelled word by word - which is what lets "Harganya tiga ribu rupiah.
 * Dibayar lima ribu rupiah." work without listing every possible sentence -
 * but only when *every* word is known. One unknown word makes the whole thing
 * null, because a half-respelled sentence sounds worse than an honest accent.
 */
export function respellForEnglishVoice(text: string): string | null {
  const trimmed = text.trim();

  const whole = respellOne(trimmed);
  if (whole !== null) return whole;

  const words = trimmed.split(/\s+/);
  if (words.length < 2) return null;

  const respelled: string[] = [];
  for (const word of words) {
    const hit = respellOne(word);
    if (hit === null) return null;
    respelled.push(hit);
  }
  return respelled.join(' ');
}
