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

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    };

    // พยายามเปิด torch / ตั้ง focus ถ้าอุปกรณ์รองรับ
    const tryEnhanceCamera = (stream: MediaStream | null) => {
      try {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (!track) return;

        // ลองเปิด torch ถ้ารองรับ (secure context + rear camera)
        const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
        const supportsTorch = (capabilities as any).torch;
        if (supportsTorch) {
          try {
            // ระวัง: บางเครื่องต้องอนุญาตเฉพาะเมื่อ user interaction เกิดขึ้น
            track.applyConstraints({ advanced: [{ torch: true }] } as any);
          } catch {
            // ignore
          }
        }

        // ลองตั้ง focus mode ผ่าน applyConstraints ถ้ามี
        const focusSupport = (capabilities as any).focusMode;
        if (focusSupport && Array.isArray((capabilities as any).focusMode)) {
          try {
            track.applyConstraints({ advanced: [{ focusMode: "continuous" }] } as any);
          } catch {
            // ignore
          }
        }

        // พยายามใช้ ImageCapture เพื่อปรับ focus/zoom ถ้าเบราว์เซอร์รองรับ
        try {
          const ImageCapture = (window as any).ImageCapture;
          if (ImageCapture) {
            const imgCap = new ImageCapture(track);
            imgCap.getPhotoCapabilities?.().then((caps: any) => {
              // ถ้ารองรับ focusMode -> set to continuous หรือ single-shot (best-effort)
              if (caps.focusMode && caps.focusMode.includes("continuous")) {
                try {
                  track.applyConstraints?.({ advanced: [{ focusMode: "continuous" }] } as any);
                } catch {}
              }
              // ถ้ารองรับ torch ผ่าน photo capabilities ให้เปิด (บางอุปกรณ์)
              if (caps.torch) {
                try {
                  track.applyConstraints?.({ advanced: [{ torch: true }] } as any);
                } catch {}
              }
            }).catch(() => {});
          }
        } catch {
          // ignore
        }
      } catch {
        // ignore any failures
      }
    };

    // เรียก decode - ไลบรารีจะให้ video.srcObject
    codeReader
      .decodeFromConstraints(constraints, videoRef.current, async (result, err) => {
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
      })
      .catch((err) => {
        console.error("Camera error", err);
      });

    // หลังจากสตรีมถูกผูกกับ video แล้ว ให้ลองปรับ torch/focus (best-effort)
    const enhanceTimeout = setTimeout(() => {
      try {
        const stream = videoRef.current?.srcObject as MediaStream | null;
        tryEnhanceCamera(stream);
      } catch {
        // ignore
      }
    }, 500); // รอให้ library ผูก stream เสร็จก่อน

    return () => {
      active = false;
      clearTimeout(enhanceTimeout);

      // หยุดการ decode ถ้ามีเมธอดนั้น (บางเวอร์ชันของไลบรารีอาจมี)
      try {
        (codeReaderRef.current as any)?.stopContinuousDecode?.();
      } catch (e) {
        // ignore
      }
      // ไม่เรียก reset ที่อาจไม่มีในบางเวอร์ชัน

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

      codeReaderRef.current = null;
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
