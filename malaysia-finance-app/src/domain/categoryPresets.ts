/** Ready-made categories for Malaysian spending, offered on the Categories screen. Names are stored as written. */
export type CategoryPreset = { name: string; icon: string };

export const CATEGORY_PRESETS: readonly CategoryPreset[] = [
  { name: 'Kopitiam & Mamak', icon: 'cafe-outline' },
  { name: 'Barang dapur', icon: 'cart-outline' },
  { name: 'Petrol', icon: 'speedometer-outline' },
  { name: 'Tol', icon: 'navigate-outline' },
  { name: "Touch 'n Go", icon: 'card-outline' },
  { name: 'Parkir', icon: 'car-sport-outline' },
  { name: 'Pengangkutan awam', icon: 'train-outline' },
  { name: 'Grab & e-hailing', icon: 'car-outline' },
  { name: 'Ansuran kereta', icon: 'car-sport-outline' },
  { name: 'Insurans & cukai jalan', icon: 'shield-checkmark-outline' },
  { name: 'Utiliti (TNB & Air)', icon: 'flash-outline' },
  { name: 'Internet & telefon', icon: 'wifi-outline' },
  { name: 'Sewa rumah', icon: 'key-outline' },
  { name: 'Pinjaman rumah', icon: 'home-outline' },
  { name: 'Yuran & tuisyen', icon: 'school-outline' },
  { name: 'Klinik & ubat', icon: 'medkit-outline' },
  { name: 'Takaful', icon: 'umbrella-outline' },
  { name: 'Zakat & sedekah', icon: 'moon-outline' },
  { name: 'Keluarga', icon: 'people-outline' },
  { name: 'Kenduri & hadiah', icon: 'gift-outline' },
  { name: 'Duit raya', icon: 'cash-outline' },
  { name: 'Haiwan peliharaan', icon: 'paw-outline' },
  { name: 'Hobi', icon: 'camera-outline' },
  { name: 'Langganan', icon: 'tv-outline' },
];
