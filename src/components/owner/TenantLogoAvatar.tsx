import { useEffect, useState } from 'react'
import { getTenantLogoUrl } from '../../utils/tenantLogo'

type TenantLogoAvatarProps = {
  tenantId?: string | null
  logoPath?: string | null
  name?: string | null
}

/** Tenant-scoped brand mark with consistent letter fallback. */
export function TenantLogoAvatar({ tenantId, logoPath, name }: TenantLogoAvatarProps) {
  const url = tenantId ? getTenantLogoUrl(tenantId, logoPath) : null
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  const initial = (name?.trim().charAt(0) || 'B').toLocaleUpperCase('es-AR')

  return (
    <span className="premium-tenant-avatar" aria-hidden="true">
      {url && !failed ? (
        <img className="premium-tenant-avatar-image" src={url} width={40} height={40}
          alt="" onError={() => setFailed(true)} />
      ) : <span className="premium-tenant-avatar-letter">{initial}</span>}
    </span>
  )
}
