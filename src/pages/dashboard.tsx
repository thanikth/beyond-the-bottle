import { useEffect, useState } from "react";
import Image from 'next/image'

type User = {
  userId: string
  displayName: string
  pictureUrl: string
  points: number
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);

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
      <Image src={user.pictureUrl} alt="profile" width={100} height={100} />
      <h2>Welcome, {user.displayName}</h2>
      <p>คะแนนสะสม: {user.points}</p>
    </div>
  );
}
