import { supabase } from '../config/supabase'

export const TENANT_COVER_BUCKET = 'tenant-covers'
const MAX_INPUT_BYTES = 10 * 1024 * 1024
const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024
const MAX_IMAGE_SIDE = 1600

/** Validates the tenant prefix even if a malicious client rewrites the DB value. */
export function getTenantCoverUrl(tenantId: string, path: string | null | undefined): string | null {
  if (!path || !path.startsWith(`${tenantId}/`) || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/i.test(path)) return null
  return supabase.storage.from(TENANT_COVER_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Normalizes camera images to compressed JPEG; strips EXIF and avoids unsafe SVG. */
export async function prepareCoverImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') && !/\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error('Seleccioná una imagen compatible con tu celular.')
  }
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error('La foto debe pesar menos de 10 MB.')
  }

  const src = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No pudimos abrir esta imagen. Probá con una foto JPG o PNG.'))
      img.src = src
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('La imagen no tiene dimensiones válidas.')
    const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('No pudimos procesar la imagen en este dispositivo.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No pudimos optimizar la imagen.')), 'image/jpeg', quality)
    })
    let result = await encode(0.8)
    if (result.size > MAX_OUTPUT_BYTES) result = await encode(0.62)
    if (result.size > MAX_OUTPUT_BYTES) throw new Error('La foto es demasiado compleja. Elegí otra imagen.')
    return result
  } finally {
    URL.revokeObjectURL(src)
  }
}
