// ...existing code...
"use client";
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
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const stopScanner = (reader: BrowserQRCodeReader | null, videoEl: HTMLVideoElement | null) => {
    if (reader) {
      const r = reader as unknown as {
        reset?: () => Promise<void> | void;
        stop?: () => void;
        stopContinuousDecode?: () => void;
      };
      try {
        if (typeof r.reset === "function") {
          (r.reset as () => void)();
        } else if (typeof r.stopContinuousDecode === "function") {
          r.stopContinuousDecode();
        } else if (typeof r.stop === "function") {
          r.stop();
        }
      } catch {}
    }

    if (videoEl) {
      const stream = videoEl.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        try {
          videoEl.srcObject = null;
        } catch {}
      }
    }
  };

  const pickBackCameraDeviceId = async (): Promise<string | undefined> => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return undefined;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      if (videoInputs.length === 0) return undefined;
      // try to pick a back camera by label (if labels available)
      const back = videoInputs.find((d) => /back|rear|environment|camera 1|camera 0/i.test(d.label || ""));
      return back?.deviceId || videoInputs[0]?.deviceId;
    } catch (err) {
      console.warn("enumerateDevices failed", err);
      return undefined;
    }
  };

  // prompt permission immediately (attempt). many mobile browsers still require a user gesture,
  // but we try and then auto-start scanning if allowed.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (mounted) setError("Camera API not available in this browser");
        return;
      }
      try {
        // request a short stream to trigger permission prompt and to get device labels
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        // stop temp tracks but keep permission info
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        if (mounted) {
          setPermissionGranted(true);
          // try to auto-start scanner after permission granted
          try {
            await startScanner();
          } catch (e) {
            // startScanner will manage its own errors
          }
        }
      } catch (err: any) {
        if (mounted) {
          setPermissionGranted(false);
          // don't spam error if user simply hasn't granted permission yet
          setError(String(err?.message || err));
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = async () => {
    setError(null);
    setScannedUser(null);
    setTestTextScan("");
    lastScannedRef.current = null;
    lastScanTimeRef.current = 0;

    const videoEl = videoRef.current;
    if (!videoEl) {
      setError("Video element not mounted");
      return;
    }

    if (!navigator?.mediaDevices) {
      setError("Media devices API not available");
      return;
    }

    // create reader and keep reference
    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    try {
      // pick back camera deviceId if available; decodeFromVideoDevice expects deviceId string or undefined
      const deviceId = await pickBackCameraDeviceId();
      setIsRunning(true);

      await codeReader.decodeFromVideoDevice(
        deviceId ?? undefined,
        videoEl,
        async (result, err) => {
          if (!isRunning) return;

          if (result) {
            const text = result.getText?.() ?? "";
            const now = Date.now();
            // debounce repeated reads: only accept if different or after 1500ms
            if (text && (text !== lastScannedRef.current || now - lastScanTimeRef.current > 1500)) {
              lastScannedRef.current = text;
              lastScanTimeRef.current = now;
              setTestTextScan(text);

              try {
                const userData = await fetchUserByUserId(text);
                if (!userData || !userData.exists) {
                  setError("User not found");
                } else {
                  setScannedUser(userData.user);
                }
              } catch (e: any) {
                setError(e?.message || "API error");
              }
              // DO NOT stop the scanner automatically — keep scanning phone screen continuously
              // if you want to stop after first detection, call stopScanner(...) here.
            }
          }

          // log non-critical errors (NotFoundException is normal while scanning)
          if (err && (err as any).name !== "NotFoundException") {
            console.error("ZXing error:", err);
          }
        }
      );
    } catch (e: any) {
      console.error("startScanner error:", e);
      setError(String(e?.message || e));
      setIsRunning(false);
      stopScanner(codeReaderRef.current, videoEl);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    stopScanner(codeReaderRef.current, videoRef.current);
  };

  // cleanup
  useEffect(() => {
    return () => {
      try {
        stopScanner(codeReaderRef.current, videoRef.current);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div>testTextScan: {testTextScan}</div>

      {scannedUser && (
        <div>
          <p>User ID: {scannedUser.userId}</p>
          <p>Points: {scannedUser.points}</p>
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Scan QR Code</h2>

      <div style={{ marginBottom: 8 }}>
        {!isRunning ? (
          <button
            onClick={async () => {
              // explicit user gesture to improve success on mobile
              await startScanner();
            }}
          >
            Start camera
          </button>
        ) : (
          <button onClick={handleStop}>Stop camera</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        <div>Tips for phone-to-phone scanning:</div>
        <ul>
          <li>Use the back camera and hold it steady, reduce screen glare on the scanned phone.</li>
          <li>Increase brightness on the phone showing the QR code and reduce reflections.</li>
          <li>Open the page on HTTPS or localhost. On iOS use Safari; on Android use Chrome for best support.</li>
        </ul>
      </div>

      <video
        ref={videoRef}
        style={{ width: "100%", maxHeight: 480, background: "#000", objectFit: "cover" }}
        playsInline
        autoPlay
        muted
      />

      {permissionGranted === false && (
        <p style={{ color: "orange" }}>
          Camera permission not granted. Grant permission or press "Start camera" and allow access.
        </p>
      )}
    </div>
  );
}
// ...existing