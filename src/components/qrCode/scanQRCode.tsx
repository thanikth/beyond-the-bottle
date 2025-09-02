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
          videoRef.current?.parentElement?.appendChild(container);
        }

        html5Qr = new Html5Qrcode(elementId);

        const config = {
          fps: 15,
          qrbox: Math.min(window.innerWidth, 360),
          aspectRatio: 1.333,
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        };

        // handlers
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

        function onScanFailure(_errorMessage: any) {
          // per-frame decode error (ignore)
        }

        // พยายามเริ่มด้วยลำดับที่ให้กล้องหลังเป็นค่าเริ่มต้น
        const startWithExactEnvironment = async () => {
          try {
            await html5Qr?.start(
              { facingMode: { exact: "environment" } } as any,
              config,
              onScanSuccess,
              onScanFailure
            );
            return true;
          } catch {
            return false;
          }
        };

        const startWithBackCameraId = async () => {
          try {
            const cams = await Html5Qrcode.getCameras();
            const back = (cams || []).find((c) => /back|rear|environment/i.test(c.label));
            if (back?.id) {
              await html5Qr?.start(back.id, config, onScanSuccess, onScanFailure);
              return true;
            }
          } catch {
            // ignore
          }
          return false;
        };

        const startWithIdealEnvironment = async () => {
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
        };

        // ลองลำดับ: exact -> cameraId (จาก getCameras) -> ideal -> fallback any camera
        let started = await startWithExactEnvironment();
        if (!started) started = await startWithBackCameraId();
        if (!started) started = await startWithIdealEnvironment();

        if (!started) {
          try {
            const cams = await Html5Qrcode.getCameras();
            if (cams && cams[0]) {
              await html5Qr?.start(cams[0].id, config, onScanSuccess, onScanFailure);
              started = true;
            }
          } catch {
            // ignore
          }
        }

        if (!started) {
          throw new Error("Unable to start any camera (rear preferred)");
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
