import { Plus_Jakarta_Sans } from 'next/font/google'

// Plus Jakarta Sans — next/font/google mengunduh & self-host font saat build
// (tanpa request ke Google di browser).
export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
})
