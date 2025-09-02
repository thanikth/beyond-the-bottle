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

  // ...existing code...
  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    if (!videoRef.current) return;

    // ช่วยให้วิดีโอเล่น inline บนมือถือและตั้งค่า autoplay/muted
    videoRef.current.playsInline = true;
    videoRef.current.autoplay = true;
    videoRef.current.muted = true;

    let active = true;

    // ใช้ decodeFromConstraints เพื่อบังคับกล้องหลังและความละเอียดที่เหมาะสม
    codeReader
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
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

      // หยุดการ decode ถ้ามีเมธอดนั้น (บางเวอร์ชันของไลบรารีอาจมี)
      try {
        (codeReaderRef.current as any)?.stopContinuousDecode?.();
        // ถ้ามี reset ให้เรียกผ่าน any เพื่อหลีกเลี่ยงข้อผิดพลาดของ TS
        (codeReaderRef.current as any)?.reset?.();
      } catch (e) {
        // ignore
      }

      // หยุด media tracks ของ video เพื่อปลดกล้อง
      try {
        const videoEl = videoRef.current;
        if (videoEl && videoEl.srcObject) {
          const stream = videoEl.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          videoEl.srcObject = null;
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);
//

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
