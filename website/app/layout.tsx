import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LumedIn Analytics',
  description: 'AI-powered event attendee analysis and networking insights',
  icons: {
    icon: '/media/logo.png',
    shortcut: '/media/logo.png',
    apple: '/media/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="icon" href="/media/logo.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
