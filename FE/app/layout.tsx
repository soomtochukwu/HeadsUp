import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'



export const metadata: Metadata = {
  title: 'Flipen',
  description: 'Where Fortune Favors the Bold',
  other: {
    'talentapp:project_verification': 'be280b1621739c5e41e340f9e9813d323f09920f24e7b7b3b90f30752b9fcac126866fb4df36ba65131f66ec94d17138fb2defd8472e9e3cd8e73c660a8ae082',
  },
}
// 
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>

          {children}
        </Providers>
      </body>
    </html>
  )
}
