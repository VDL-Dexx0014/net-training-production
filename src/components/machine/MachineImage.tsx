// src/components/machine/MachineImage.tsx
// Reusable bevelled-rectangle image display component for machines

'use client'

import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizeConfig = {
  sm: { width: 40, height: 40, iconSize: 'h-4 w-4' },
  md: { width: 80, height: 80, iconSize: 'h-6 w-6' },
  lg: { width: 160, height: 120, iconSize: 'h-8 w-8' },
} as const

interface MachineImageProps {
  src: string | null
  alt: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MachineImage({ src, alt, size = 'md', className }: MachineImageProps) {
  const config = sizeConfig[size]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border-2 border-slate-200 bg-slate-100 flex-shrink-0',
        'shadow-[inset_2px_2px_4px_rgba(255,255,255,0.9),inset_-2px_-2px_4px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.08)]',
        className
      )}
      style={{ width: config.width, height: config.height }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes={`${config.width}px`}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <ImageIcon className={cn(config.iconSize, 'text-slate-300')} />
        </div>
      )}
    </div>
  )
}
