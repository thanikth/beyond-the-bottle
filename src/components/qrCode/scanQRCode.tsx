import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { fetchUserByUserId } from "@/pages/api/users/getUser";

type ScannedUser = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  points?: number;
};

export default function ScanQRCode() {
  const [scannedUser, setScannedUser] = useState<ScannedUser | null>(null);
  const [testTextScan, setTestTextScan] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  const stopScanner = (reader: BrowserQRCodeReader | null, videoEl: HTMLVideoElement | null) => {
    if (reader) {
      const r = reader as unknown as {
        reset?: () => void;
        stop?: () => void;
        stopContinuousDecode?: () => void;
      };
      if (typeof r.reset === "function") {
        try { r.reset(); } catch {}
        return;
      }
      if (typeof r.stopContinuousDecode === "function") {
        try { r.stopContinuousDecode(); } catch {}
        return;
      }
      if (typeof r.stop === "function") {
        try { r.stop(); } catch {}
        return;
      }
    }

    if (videoEl) {
      const stream = videoEl.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
        try { videoEl.srcObject = null; } catch {}
      }
    }
  };

  useEffect(() => {
    let active = true;
    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    const startDecode = async () => {
      let attempts = 0;
      while (!videoRef.current && attempts < 20) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      const videoEl = videoRef.current;
      if (!videoEl) {
        console.error("Video element not available — cannot start scanner");
        setError("Camera element not available");
        return;
      }

      try {
        await codeReader.decodeFromVideoDevice(
          undefined,
          videoEl,
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
                setError(e?.message || "API error");
              }

              active = false;
              stopScanner(codeReader, videoEl);
            }

            if (err && err.name !== "NotFoundException") {
              console.error("ZXing error:", err);
            }
          }
        );
      } catch (e) {
        console.error("Camera start error:", e);
        setError(String(e));
      }
    };

    startDecode();

    return () => {
      active = false;
      try {
        stopScanner(codeReaderRef.current, videoRef.current);
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
      {/* เพิ่ม attributes ที่ช่วยให้มือถือ/เบราว์เซอร์เล่นกล้องได้ดีขึ้น */}
      <video ref={videoRef} style={{ width: "100%" }} playsInline autoPlay muted />
    </div>
  );
}