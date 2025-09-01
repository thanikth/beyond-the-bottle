'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { fetchUserByUserId } from '@/pages/api/users/getUser';

export default function ScanQRCode() {
  const [scannedUser, setScannedUser] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    if (!videoRef.current) return;

    let active = true;

    codeReader.decodeFromVideoDevice(
      undefined,
      videoRef.current,
      async (result, err) => {
        if (!active) return;

        if (result) {
          const userId = result.getText();
          console.log('Scanned userId:', userId);

          try {
            const userData = await fetchUserByUserId(userId);
            if (!userData || !userData.exists) {
              setError('User not found');
              return;
            }
            setScannedUser(userData.user);
          } catch (e: any) {
            setError(e.message || 'API error');
          }

          active = false;
          codeReader.stopContinuousDecode?.(); 
        }

        if (err && err.name !== 'NotFoundException') {
          console.error(err);
        }
      }
    ).catch(err => console.error('Camera error', err));

    return () => {
      active = false;
      codeReader.reset?.();
    };
  }, []);

  return (
    <div>
      <h2>:: Info scan ::</h2>
      <video ref={videoRef} style={{ width: '100%' }} />
      {scannedUser && (
        <div>
          <p>User ID: {scannedUser.userId}</p>
          <p>Points: {scannedUser.points}</p>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
