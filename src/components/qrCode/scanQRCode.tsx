"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { fetchUserByUserId } from "@/pages/api/users/getUser";

export default function ScanQRCode() {
  const [scannedUser, setScannedUser] = useState<any | null>(null);
  const [testTextScan, setTestTextScan] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    if (!videoRef.current) return;

    let active = true;

    codeReader
      .decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (result, err) => {
          if (!active) return;

          if (result) {
            const userId = result.getText();
            console.log("Scanned userId:", userId);
            setTestTextScan(userId);

            try {
              const userData = await fetchUserByUserId(userId);
              if (!userData || !userData.exists) {
                setError("User not found");
                return;
              }
              setScannedUser(userData.user);
            } catch (e: any) {
              setError(e.message || "API error");
            }
            active = false;
          }

          if (err && err.name !== "NotFoundException") {
            console.error(err);
          }
        }
      )
      .catch((err) => console.error("Camera error", err));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div>testTextScan: {testTextScan}</div>
      {scannedUser && (
        <>
          <div>
            <p>User ID: {scannedUser.userId}</p>
            <p>Points: {scannedUser.points}</p>
          </div>
        </>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <h2>Scan QR Code</h2>
      <video ref={videoRef} style={{ width: "100%" }} />
      
    </div>
  );
}
