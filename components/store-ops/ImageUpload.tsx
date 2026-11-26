'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { prepareImage } from '@/lib/store-ops/image-compression'
import { removeDraftImage } from '@/app/actions/store-ops/media'
import StoreImage from './StoreImage'

interface ImageUploadProps {
  images: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  uploadAction: (formData: FormData) => Promise<{ success?: boolean; url?: string; error?: string }>
}

export default function ImageUpload({ images, onChange, maxImages = 5, uploadAction }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const locked = useRef(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || locked.current) return
    locked.current = true

    setError(null)
    setUploading(true)

    const next = [...images]
    try {
      if (files.length > maxImages - next.length) setError(`You can attach up to ${maxImages} photos. Extra files were not uploaded.`)
      for (const source of Array.from(files).slice(0, Math.max(0, maxImages - next.length))) {
        const prepared = await prepareImage(source)
        const formData = new FormData()
        formData.append('file', prepared.file)
        formData.append('thumbnail', prepared.thumbnail)
        const result = await uploadAction(formData)
        if (!result.success || !result.url) throw new Error(result.error || 'Upload failed')
        next.push(result.url)
        onChange([...next])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload this photo.')
    } finally {
      locked.current = false
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeImage = async (index: number) => {
    if (locked.current) return
    locked.current = true
    setUploading(true)
    setError(null)
    try {
      const result = await removeDraftImage(images[index])
      if (result.error) setError('Stored photo will be removed when you save this report.')
      onChange(images.filter((_, position) => position !== index))
    } catch { setError('Photo could not be removed. Please retry.') }
    finally { locked.current = false; setUploading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Photos ({images.length}/{maxImages})
        </label>
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      {error && (
        <p role="alert" className="text-sm text-rose-600">{error}</p>
      )}

      {images.length === 0 ? (
        <button
          type="button" disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <ImageIcon size={24} className="text-slate-300" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tap to add photos</p>
        </button>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {images.map((url, index) => (
            <div key={index} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
              <StoreImage
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                disabled={uploading}
                onClick={() => void removeImage(index)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {images.length < maxImages && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-slate-400 hover:text-slate-500 transition-colors disabled:opacity-50"
            >
              <Upload size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
