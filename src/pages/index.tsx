import { Button } from "antd";
import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h1>LINE Points System</h1>
      <Link href="/api/auth/login">
        <button type="button">Login with LINE</button>
      </Link>
    </div>
  );
}
