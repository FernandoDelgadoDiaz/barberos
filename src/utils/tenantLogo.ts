import { supabase } from '../config/supabase'

export const TENANT_LOGO_BUCKET = 'tenant-logos'
const OWNED_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/i

/** Only resolves a known tenant-prefixed Storage path, never an arbitrary URL. */
export function getTenantLogoUrl(tenantId: string, path: string | null | undefined): string | null {
  if (!path || !path.startsWith(tenantId + '/') || !OWNED_PATH.test(path)) return null
  return supabase.storage.from(TENANT_LOGO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Normalize supported raster images to small, transparent PNGs (no EXIF). */
export async function prepareTenantLogo(file: File): Promise<Blob> {
  const allowedType = /^(image\/jpeg|image\/png|image\/webp|image\/heic|image\/heif)$/i.test(file.type)
  const allowedName = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  if (!allowedType && !allowedName) throw new Error('Seleccioná una imagen JPG, PNG o WebP válida.')
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('El logo debe pesar menos de 10 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No pudimos abrir esta imagen. Probá con JPG o PNG.'))
      img.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('La imagen no tiene dimensiones válidas.')
    const create = (side: number) => new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = side
      canvas.height = side
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No pudimos procesar el logo en este dispositivo.'))
      const scale = Math.min((side - 24) / img.naturalWidth, (side - 24) / img.naturalHeight)
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale
      ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No pudimos optimizar el logo.')), 'image/png')
    })
    let output = await create(384)
    if (output.size > 1048576) output = await create(256)
    if (output.size > 1048576) throw new Error('La imagen optimizada pesa más de 1 MB.')
    return output
  } finally {
    URL.revokeObjectURL(url)
  }
}
