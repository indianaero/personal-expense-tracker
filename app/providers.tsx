'use client'
import { SessionProvider } from 'next-auth/react'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <HeroUIProvider>
          <ToastProvider />
          {children}
        </HeroUIProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
