import { Button } from "antd";

export default function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h1>LINE Points System</h1>
      <a href="/api/auth/login">
        <Button type="primary" size="large">Login with LINE</Button>
      </a>
    </div>
  );
}
