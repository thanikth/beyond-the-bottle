import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function UserQRCode({ userId }: { userId: string }) {
  const [showQR, setShowQR] = useState(false);

  return (
    <div>
      <button onClick={() => setShowQR(!showQR)}>
        {showQR ? 'Hide QR Code' : 'Show QR Code'}
      </button>

      {showQR && (
        <div style={{ marginTop: '20px' }}>
          <QRCodeSVG value={userId} size={200} />
        </div>
      )}
    </div>
  );
}
