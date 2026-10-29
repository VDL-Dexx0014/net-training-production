// src/components/machine/MachineImageUpload.tsx
// Image upload widget for machine photos, wraps MachineImage with upload functionality

'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MachineImage } from './MachineImage'
import { Camera, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MachineImageUploadProps {
  machineCode: string
  currentImageUrl: string | null
  onImageUploaded: (url: string) => void
  onImageRemoved: () => void
  disabled?: boolean
}

export function MachineImageUpload({
  machineCode,
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  disabled = false,
}: MachineImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const displayUrl = previewUrl || currentImageUrl

  const handleClick = () => {
    if (disabled || uploading) return
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be re-selected
    e.target.value = ''

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Show local preview
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setUploading(true)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const storagePath = `machines/${machineCode.trim()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('machine-images')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.error('Failed to upload image')
        setPreviewUrl(null)
        return
      }

      const { data } = supabase.storage
        .from('machine-images')
        .getPublicUrl(storagePath)

      // Add cache-busting parameter
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`
      onImageUploaded(publicUrl)
      setPreviewUrl(null)
      toast.success('Image uploaded')
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload image')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || uploading) return
    setPreviewUrl(null)
    onImageRemoved()
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || uploading}
        className="relative group cursor-pointer disabled:cursor-not-allowed"
      >
        <MachineImage src={displayUrl} alt="Machine photo" size="lg" />

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          {uploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      {/* Remove button */}
      {displayUrl && !uploading && !disabled && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
