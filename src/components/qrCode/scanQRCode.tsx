"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { fetchUserByUserId } from "@/pages/api/users/getUser";
import { Html5Qrcode } from "html5-qrcode";

export default function ScanQRCode() {
  const [scannedUser, setScannedUser] = useState<any | null>(null);
  const [testTextScan, setTestTextScan] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    const elementId = "html5qr-reader";
    let html5Qr: Html5Qrcode | null = null;
    let active = true;

    (async () => {
      try {
        // สร้าง container ถ้ายังไม่มี
        if (!document.getElementById(elementId)) {
          const container = document.createElement("div");
          container.id = elementId;
          // วางไว้ข้างๆ video element (หรือแทน video)
          videoRef.current?.parentElement?.appendChild(container);
        }

        const cameras = await Html5Qrcode.getCameras();
        const backCamera = (cameras || []).find((c) =>
          /back|rear|environment/i.test(c.label)
        );
        const cameraId = backCamera ? backCamera.id : cameras?.[0]?.id;

        html5Qr = new Html5Qrcode(elementId);

        const config = {
          fps: 15,
          qrbox: 300, // ขนาดกล่องสแกน — ปรับให้ใหญ่เพื่อให้ง่ายขึ้น
          aspectRatio: 1.333,
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        };

        await html5Qr.start(
          cameraId ?? { facingMode: { ideal: "environment" } } as any,
          config,
          async (decodedText) => {
            if (!active) return;
            setTestTextScan(decodedText);

            try {
              const userData = await fetchUserByUserId(decodedText);
              if (!userData || !userData.exists) {
                setError("User not found");
                return;
              }
              setScannedUser(userData.user);
            } catch (e: any) {
              setError(e?.message || "API error");
            }

            active = false;
            // หยุดหลังสแกนเสร็จ (ถ้าต้องการ)
            try {
              await html5Qr?.stop();
            } catch {}
          },
          (errorMessage) => {
            // per-frame decode error (ไม่ต้องแสดงทั้งหมด)
            // console.debug("scan error", errorMessage);
          }
        );
      } catch (e) {
        console.error("html5-qrcode init error", e);
        setError("Camera error");
      }
    })();

    return () => {
      active = false;
      if (html5Qr) {
        html5Qr
          .stop()
          .catch(() => {
            /* ignore */
          })
          .finally(() => {
            try {
              html5Qr?.clear();
            } catch {}
          });
      }
      // ถ้าเราเพิ่ม container ด้วยโค้ดข้างต้น อาจลบออกได้ตามต้องการ
      try {
        const el = document.getElementById(elementId);
        if (el && el.parentElement) el.parentElement.removeChild(el);
      } catch {}
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
