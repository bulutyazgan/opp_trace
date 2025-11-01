import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Luma Attendee Dashboard',
  description: 'Analyze and view Luma event attendees',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
