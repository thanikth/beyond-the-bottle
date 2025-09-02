import UserQRCode from "@/components/qrCode/genQRCode";
import ScanQRCode from "@/components/qrCode/scanQRCode";
import { Button } from "antd";
import Link from 'next/link'
import { useState } from "react";

export default function Home() {
  const [isOpenCamera, setIsOpenCamera] = useState<boolean>(false);
  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h1>LINE Points System</h1>
      <Link href="/api/auth/login">
        <button type="button">Login with LINE</button>
      </Link>

      <UserQRCode userId={'U6fc80ecbab35272e6a5cfd54695a4c8b'} />

      <button role="button" onClick={() => {
              setIsOpenCamera(!isOpenCamera);
            }}>Scan QRCode</button>
            {
              isOpenCamera && (
                <ScanQRCode />
              )
            }
    </div>
  );
}
