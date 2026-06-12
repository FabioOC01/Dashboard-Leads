import { useState } from 'react';
import { avatarColor, getVendedorFotoUrl, initials } from '../utils/domain';

export default function SellerAvatar({ seller = {}, vendedores = [], name, size, fontSize }) {
  const displayName = name || seller.vendedor_nombre || seller.name || seller.nombre || '';
  const photoUrl = getVendedorFotoUrl(seller, vendedores);
  const [failedUrl, setFailedUrl] = useState(null);

  const style = {
    ...(size ? { width: size, height: size } : {}),
    ...(fontSize ? { fontSize } : {}),
  };

  if (photoUrl && failedUrl !== photoUrl) {
    return (
      <img
        className="rank-av rank-av--photo"
        src={photoUrl}
        alt={displayName}
        style={style}
        onError={() => setFailedUrl(photoUrl)}
      />
    );
  }

  return (
    <span className="rank-av" style={{ ...style, background: avatarColor(displayName || '?') }}>
      {displayName ? initials(displayName) : '-'}
    </span>
  );
}
