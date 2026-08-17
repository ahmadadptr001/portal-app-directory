// Teknologi tambahan yang disimpan di browser (localStorage).
//
// Latar belakang: daftar teknologi diambil dari `app_tech` (nama unik yang
// sudah dipakai aplikasi), jadi teknologi yang baru belum punya "tempat"
// sampai dipakai oleh sebuah aplikasi. Agar bisa ditambahkan dari halaman
// Teknologi tanpa mengubah skema database, nama baru disimpan di localStorage
// (pola yang sama dengan `custom_categories` di halaman Kategori).
//
// Begitu sebuah aplikasi memakai teknologi itu, ia otomatis masuk ke daftar
// server (`app_tech`) dan bisa dibersihkan dari daftar lokal ini.

const KEY = 'custom_technologies'

export function getCustomTechnologies(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
  } catch {
    return []
  }
}

export function saveCustomTechnologies(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // abaikan (mis. storage penuh / mode privat)
  }
}

export function addCustomTechnology(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return getCustomTechnologies()
  const next = Array.from(new Set([...getCustomTechnologies(), trimmed]))
  saveCustomTechnologies(next)
  return next
}

export function removeCustomTechnology(name: string): string[] {
  const next = getCustomTechnologies().filter((x) => x !== name)
  saveCustomTechnologies(next)
  return next
}

export function renameCustomTechnology(oldName: string, newName: string): string[] {
  const trimmed = newName.trim()
  const next = getCustomTechnologies().map((x) => (x === oldName ? trimmed : x))
  saveCustomTechnologies(next)
  return next
}
