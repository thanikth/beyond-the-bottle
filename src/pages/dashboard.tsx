import { useEffect, useState } from "react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then(setUser);
  }, []);

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <div onClick={() => console.log("user :: ", user)
      }>test</div>
      <img src={user.pictureUrl} alt="profile" style={{ borderRadius: "50%", width: 100 }} />
      <h2>Welcome, {user.displayName}</h2>
      <p>คะแนนสะสม: {user.points}</p>
    </div>
  );
}
