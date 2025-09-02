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

  const stopScanner = (reader: BrowserQRCodeReader | null, videoEl: HTMLVideoElement | null) => {
    // try reader methods first (typed via unknown)
    if (reader) {
      const r = reader as unknown as {
        reset?: () => Promise<void> | void;
        stop?: () => void;
        stopContinuousDecode?: () => void;
      };
      try {
        if (typeof r.reset === "function") {
          (r.reset as () => void)();
          return;
        }
        if (typeof r.stopContinuousDecode === "function") {
          r.stopContinuousDecode();
          return;
        }
        if (typeof r.stop === "function") {
          r.stop();
          return;
        }
      } catch (e) {
        // swallow
      }
    }

    // fallback: stop tracks on the video element
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

  // pick a back camera deviceId if possible
  const pickBackCameraDeviceId = async (): Promise<string | undefined> => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return undefined;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      // labels may be empty until permission granted - try match common back camera labels
      const back = videoInputs.find((d) =>
        /back|rear|environment|camera 1|camera 0/i.test(d.label || "")
      );
      return back?.deviceId || videoInputs[0]?.deviceId;
    } catch (err) {
      console.warn("enumerateDevices failed", err);
      return undefined;
    }
  };

  const ensurePermissionAndStream = async (videoEl: HTMLVideoElement) => {
    try {
      // Trigger permission prompt using facingMode: environment
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      // assign immediately so video element gets the stream (helps some browsers)
      try {
        videoEl.srcObject = stream;
      } catch {}
      setPermissionGranted(true);
      return stream;
    } catch (err: any) {
      setPermissionGranted(false);
      throw err;
    }
  };

  const startScanner = async () => {
    setError(null);
    setScannedUser(null);
    setTestTextScan("");
    const videoEl = videoRef.current;
    if (!videoEl) {
      setError("Video element not mounted");
      return;
    }

    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    try {
      // Request permission & initial stream (user gesture required on some mobiles)
      await ensurePermissionAndStream(videoEl);

      // after permission, try to pick a back camera deviceId for more reliable scanning on phones
      const deviceId = await pickBackCameraDeviceId();

      const constraints = deviceId
        ? ({ deviceId: { exact: deviceId } } as MediaTrackConstraints)
        : ({ facingMode: { ideal: "environment" } } as MediaTrackConstraints);

      setIsRunning(true);

      await codeReader.decodeFromVideoDevice(
        constraints as string,
        videoEl,
        async (result, err) => {
          if (!isRunning) return;

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

            // stop after successful scan
            setIsRunning(false);
            stopScanner(codeReaderRef.current, videoEl);
          }

          if (err && (err as any).name !== "NotFoundException") {
            console.error("ZXing error:", err);
          }
        }
      );
    } catch (e: any) {
      console.error("startScanner error:", e);
      setError(String(e?.message || e));
      setIsRunning(false);
      // ensure no stream left running
      stopScanner(codeReaderRef.current, videoEl);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    stopScanner(codeReaderRef.current, videoRef.current);
  };

  // Clean up on unmount
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
        <>
          <div>
            <p>User ID: {scannedUser.userId}</p>
            <p>Points: {scannedUser.points}</p>
          </div>
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Scan QR Code</h2>

      {/* Controls: start/stop - explicit start helps mobile browsers that require a user gesture */}
      <div style={{ marginBottom: 8 }}>
        {!isRunning ? (
          <button
            onClick={async () => {
              // clicking this provides a user gesture for mobile autoplay/getUserMedia
              await startScanner();
            }}
          >
            Start camera
          </button>
        ) : (
          <button onClick={handleStop}>Stop camera</button>
        )}
      </div>

      {/* Helpful hint for mobile where permissions / secure context matter */}
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        <div>Tips:</div>
        <ul>
          <li>Use the back camera for scanning (Start camera → allow permission).</li>
          <li>Open page on HTTPS or localhost. On iOS, use Safari and grant Camera permission.</li>
          <li>If nothing happens, check browser console (remote debug) for errors.</li>
        </ul>
      </div>

      {/* Video element used by ZXing. playsInline, autoPlay and muted help mobile autoplay policies. */}
      <video
        ref={videoRef}
        style={{ width: "100%", maxHeight: 480, background: "#000" }}
        playsInline
        autoPlay
        muted
      />

      {/* show permission state for debugging */}
      {permissionGranted === false && (
        <p style={{ color: "orange" }}>
          Camera permission not granted. Open site settings or try again.
        </p>
      )}
    </div>
  );
}
//