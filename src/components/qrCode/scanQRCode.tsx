// ...existing code...
"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
// import { fetchUserByUserId } from "@/pages/api/users/getUser"; // removed - use fetch to /api instead

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
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  // helper: call your API route instead of importing server code
  const fetchUserByUserId = async (userId: string) => {
    try {
      const url = `/api/users/getUser?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`API error ${res.status} ${txt}`);
      }
      // expecting JSON like { exists: boolean, user: {...} }
      const data = await res.json();
      return data;
    } catch (e: any) {
      throw new Error(e?.message || "Network error");
    }
  };

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
      codeReaderRef.current = null;
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
    isRunningRef.current = false;
  };

  const pickBackCameraDeviceId = async (): Promise<string | undefined> => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return undefined;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videoInputs);
      // prefer device that looks like back/rear/environment
      const back = videoInputs.find((d) => /back|rear|environment|camera 1|camera 0/i.test(d.label || ""));
      return back?.deviceId || videoInputs[0]?.deviceId;
    } catch (err) {
      console.warn("enumerateDevices failed", err);
      return undefined;
    }
  };

  const detectTorchSupport = async (videoEl: HTMLVideoElement | null) => {
    setTorchAvailable(false);
    if (!videoEl) return;
    const stream = videoEl.srcObject as MediaStream | null;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track?.getCapabilities) return;
    try {
      const caps = track.getCapabilities() as any;
      if (caps && caps.torch) {
        setTorchAvailable(true);
      } else {
        setTorchAvailable(false);
      }
    } catch {
      setTorchAvailable(false);
    }
  };

  const setTorch = async (on: boolean) => {
    const videoEl = videoRef.current;
    const stream = videoEl?.srcObject as MediaStream | null;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track || !(track as any).applyConstraints) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !!on }] });
      setTorchOn(on);
    } catch (e) {
      console.warn("torch applyConstraints failed", e);
      setTorchAvailable(false);
      setTorchOn(false);
    }
  };

  useEffect(() => {
    // keep isRunningRef in sync with state for callbacks
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // initial permission probe + populate device list
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (mounted) setError("Camera API not available in this browser");
        return;
      }
      try {
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
          // populate cameras
          const deviceId = await pickBackCameraDeviceId();
          setSelectedDeviceId(deviceId);
          // do not auto-start on all devices; leave to explicit user action, but you can auto-start if desired
        }
      } catch (err: any) {
        if (mounted) {
          setPermissionGranted(false);
          setError(String(err?.message || err));
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = async (deviceId?: string) => {
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

    // stop any existing scanner first
    stopScanner(codeReaderRef.current, videoEl);

    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;
    isRunningRef.current = true;
    setIsRunning(true);

    try {
      // choose device; prefer provided deviceId (user selected) else pickBackCameraDeviceId
      const deviceToUse = deviceId ?? (selectedDeviceId ?? (await pickBackCameraDeviceId()));
      setSelectedDeviceId(deviceToUse);

      // start decodeFromVideoDevice with constraints aiming for phone-to-phone scanning
      await codeReader.decodeFromVideoDevice(
        deviceToUse ?? undefined,
        videoEl,
        async (result, err) => {
          if (!isRunningRef.current) return;

          if (result) {
            const text = result.getText?.() ?? "";
            const now = Date.now();
            // debounce repeated reads: accept if new or after 1200ms
            if (text && (text !== lastScannedRef.current || now - lastScanTimeRef.current > 1200)) {
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
              // keep scanning continuously for phone-to-phone scenarios
            }
          }

          // log non-critical errors (NotFoundException is expected while scanning)
          if (err && (err as any).name !== "NotFoundException") {
            console.error("ZXing error:", err);
          }
        }
      );

      // after starting, detect torch support
      setTimeout(() => detectTorchSupport(videoRef.current), 500);
    } catch (e: any) {
      console.error("startScanner error:", e);
      setError(String(e?.message || e));
      setIsRunning(false);
      isRunningRef.current = false;
      stopScanner(codeReaderRef.current, videoEl);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    stopScanner(codeReaderRef.current, videoRef.current);
    setTorchOn(false);
  };

  const handleSwitchCamera = async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videoInputs);
      if (videoInputs.length <= 1) return;
      const currentIndex = videoInputs.findIndex((d) => d.deviceId === selectedDeviceId);
      const next = videoInputs[(currentIndex + 1) % videoInputs.length];
      setSelectedDeviceId(next.deviceId);
      await startScanner(next.deviceId);
    } catch (e) {
      console.warn("switch camera failed", e);
      setError("Unable to switch camera");
    }
  };

  // cleanup on unmount
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
      <div style={{ marginBottom: 8 }}>testTextScan: {testTextScan}</div>

      {scannedUser && (
        <div style={{ marginBottom: 8 }}>
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
              // explicit user gesture
              await startScanner();
            }}
          >
            Start camera
          </button>
        ) : (
          <button onClick={handleStop}>Stop camera</button>
        )}

        <button style={{ marginLeft: 8 }} onClick={handleSwitchCamera} disabled={cameraDevices.length <= 1}>
          Switch camera
        </button>

        <button
          style={{ marginLeft: 8 }}
          onClick={async () => {
            if (!torchAvailable) return;
            await setTorch(!torchOn);
          }}
          disabled={!torchAvailable}
        >
          {torchOn ? "Torch off" : "Torch on"}
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        <div>Tips for phone-to-phone scanning:</div>
        <ul>
          <li>ใช้กล้องหลังของอุปกรณ์ที่สแกน และลดแสงสะท้อนบนหน้าจอที่แสดง QR</li>
          <li>เพิ่มความสว่างของหน้าจอที่ถูกสแกน และหันมุมเล็กน้อยเพื่อลดแสงสะท้อน</li>
          <li>ใช้เบราว์เซอร์ที่รองรับ (iOS: Safari, Android: Chrome) และหน้าเว็บต้องเป็น HTTPS หรือ localhost</li>
        </ul>
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 720 }}>
        <video
          ref={videoRef}
          style={{ width: "100%", maxHeight: 480, background: "#000", objectFit: "cover" }}
          playsInline
          autoPlay
          muted
        />
        {/* simple viewfinder */}
        <div
          aria-hidden
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "60%",
            height: "35%",
            transform: "translate(-50%, -50%)",
            border: "2px solid rgba(255,255,255,0.8)",
            borderRadius: 8,
            boxSizing: "border-box",
          }}
        />
      </div>

      {permissionGranted === false && (
        <p style={{ color: "orange" }}>
          Camera permission not granted. Grant permission or press "Start camera" and allow access.
        </p>
      )}
    </div>
  );
}