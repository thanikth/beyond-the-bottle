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

        // พยายามดึงรายชื่อกล้องก่อน ถ้ามี ให้เลือกกล้องที่มี label เป็น back/rear/environment
        let cameraId: string | undefined;
        try {
          const cameras = await Html5Qrcode.getCameras();
          const backCamera = (cameras || []).find((c) =>
            /back|rear|environment/i.test(c.label)
          );
          cameraId = backCamera ? backCamera.id : cameras?.[0]?.id;
        } catch (e) {
          // ถ้าไม่ได้รับรายชื่อกล้อง (บางเบราว์เซอร์/permission) ให้ fallback ไปที่ facingMode constraints
          cameraId = undefined;
        }

        html5Qr = new Html5Qrcode(elementId);

        const config = {
          fps: 15,
          // ให้ qrbox ใหญ่ขึ้นบนมือถือ -> ช่วยให้สแกนติดง่ายขึ้น
          qrbox: Math.min(window.innerWidth, 360),
          aspectRatio: 1.333,
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        };

        // หากมี cameraId ใช้ตรง ๆ, ถ้าไม่ ให้พยายามใช้ facingMode เป็น environment (rear)
        // พยายาม exact ก่อน ถ้าไม่สำเร็จจะ fallback ไป ideal
        const startWithConstraints = async () => {
          try {
            await html5Qr?.start(
              { facingMode: { exact: "environment" } } as any,
              config,
              onScanSuccess,
              onScanFailure
            );
            return true;
          } catch {
            try {
              await html5Qr?.start(
                { facingMode: { ideal: "environment" } } as any,
                config,
                onScanSuccess,
                onScanFailure
              );
              return true;
            } catch {
              return false;
            }
          }
        };

        // success / failure handlers
        async function onScanSuccess(decodedText: string) {
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
          try {
            await html5Qr?.stop();
          } catch {}
        }

        function onScanFailure(errorMessage: any) {
          // per-frame decode error (ไม่ต้องแสดงทั้งหมด)
          // console.debug("scan error", errorMessage);
        }

        // เริ่มสแกน: ถ้ามี cameraId ใช้ก่อน ถ้าเริ่มไม่ได้ ให้ลองใช้ facingMode constraints
        let started = false;
        if (cameraId) {
          try {
            await html5Qr.start(cameraId, config, onScanSuccess, onScanFailure);
            started = true;
          } catch (e) {
            // ถ้าเริ่มด้วย cameraId ไม่ได้ ให้ลองใช้ constraints
            started = await startWithConstraints();
          }
        } else {
          started = await startWithConstraints();
        }

        if (!started) {
          throw new Error("Unable to start camera with rear-facing preference");
        }
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
