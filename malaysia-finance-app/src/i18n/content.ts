import { getLanguage } from './language';

/** Bahasa Malaysia for built-in names that live in data files (tax reliefs, suggested notes). English is the fallback. */
const RELIEF_MS: Record<string, string> = {
  self: 'Individu dan saudara tanggungan',
  'parents-medical': 'Ibu bapa/datuk nenek: perubatan, pergigian, keperluan khas, penjaga',
  'parents-medical-exam': 'Ibu bapa/datuk nenek: pemeriksaan perubatan lengkap',
  'disabled-equipment': 'Peralatan sokongan asas untuk OKU diri, pasangan, anak atau ibu bapa',
  'disabled-individual': 'Individu kurang upaya',
  'education-self': 'Yuran pendidikan (diri sendiri)',
  'education-upskilling': 'Pendidikan: kursus peningkatan kemahiran',
  'medical-serious': 'Perubatan: penyakit serius dan rawatan kesuburan',
  'medical-vaccination': 'Perubatan: vaksinasi (diri, pasangan, anak)',
  'medical-dental': 'Perubatan: pemeriksaan dan rawatan pergigian',
  'medical-checkup': 'Perubatan: pemeriksaan kesihatan, ujian COVID, kesihatan mental, peralatan pemantauan',
  'child-intervention': 'Anak 18 tahun ke bawah: penilaian kecacatan intelek atau intervensi awal',
  lifestyle: 'Gaya hidup: buku, komputer/telefon/tablet, internet, kursus kemahiran',
  sports: 'Gaya hidup (tambahan): peralatan sukan, kemudahan, gim, pertandingan',
  breastfeeding: 'Peralatan penyusuan susu ibu (sekali setiap 2 tahun)',
  childcare: 'Yuran taska/tadika (anak 6 tahun ke bawah)',
  sspn: 'Simpanan bersih SSPN',
  spouse: 'Suami / isteri / nafkah bekas isteri',
  'spouse-disabled': 'Suami / isteri kurang upaya',
  'child-under-18': 'Anak belum berkahwin bawah 18 tahun (setiap anak)',
  'child-fulltime-18': 'Anak belum berkahwin 18+ tahun di peringkat A-Level, sijil atau matrikulasi (setiap anak)',
  'child-higher-ed': 'Anak belum berkahwin 18+ tahun di peringkat diploma atau ijazah (setiap anak)',
  'child-disabled': 'Anak kurang upaya (setiap anak)',
  'child-disabled-higher-ed': 'Anak kurang upaya 18+ tahun di peringkat diploma atau ijazah: tambahan (setiap anak)',
  epf: 'Caruman KWSP / skim pencen yang diluluskan',
  'life-insurance': 'Insurans hayat / takaful keluarga / KWSP sukarela tambahan',
  prs: 'Anuiti tertunda dan Skim Persaraan Swasta (PRS)',
  'insurance-edu-medical': 'Premium insurans untuk faedah pendidikan atau perubatan',
  socso: 'Caruman PERKESO',
  'ev-charging': 'Kemudahan mengecas EV / mesin kompos sisa makanan',
  'housing-interest-500k': 'Faedah pinjaman rumah pertama: rumah sehingga RM500,000',
  'housing-interest-750k': 'Faedah pinjaman rumah pertama: rumah RM500,001 hingga RM750,000',
};

/** The name of a tax relief in the chosen language. */
export function reliefLabel(def: { id: string; name: string }): string {
  return getLanguage() === 'ms' ? RELIEF_MS[def.id] ?? def.name : def.name;
}

const NOTE_MS: Record<string, string> = {
  Breakfast: 'Sarapan',
  Lunch: 'Makan tengah hari',
  Dinner: 'Makan malam',
  Coffee: 'Kopi',
  Groceries: 'Barang dapur',
  Parking: 'Parkir',
  Water: 'Air',
  'Phone bill': 'Bil telefon',
  Rent: 'Sewa',
  Movie: 'Wayang',
  Pharmacy: 'Farmasi',
  Books: 'Buku',
  Tuition: 'Tuisyen',
  'Electricity (TNB)': 'Elektrik (TNB)',
};

/** A built-in suggested note in the chosen language. */
export function noteLabel(note: string): string {
  return getLanguage() === 'ms' ? NOTE_MS[note] ?? note : note;
}

const MONTHS: Record<'en' | 'ms', string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ms: ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'],
};
const SHORT_MONTHS: Record<'en' | 'ms', string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'],
};
const WEEKDAYS: Record<'en' | 'ms', string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'],
};

/** Month number 1-12 to its full name. */
export const monthName = (m: number) => MONTHS[getLanguage()][m - 1];
/** Month number 1-12 to its three-letter name. */
export const shortMonthName = (m: number) => SHORT_MONTHS[getLanguage()][m - 1];
/** Weekday 0 (Sunday) to 6 to its three-letter name. */
export const weekdayName = (d: number) => WEEKDAYS[getLanguage()][d];
