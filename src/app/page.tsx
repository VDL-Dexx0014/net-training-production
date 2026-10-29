// src/app/page.tsx
// Landing/home page

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/Header'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8 mt-12">
          <h2 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight">
            New Element Training
          </h2>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild className="bg-slate-900 text-white hover:bg-slate-800 font-bold text-base px-8">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
