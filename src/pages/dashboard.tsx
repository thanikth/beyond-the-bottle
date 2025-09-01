import { useEffect, useState } from "react";
import Image from "next/image";
import { fetchUserByUserId } from "./api/users/getUser";
import { createUser } from "./api/users/createUser";
import router from "next/router";
import UserQRCode from "@/components/qrCode/genQRCode";
import ScanQRCode from "@/components/qrCode/scanQRCode";

type User = {
  userId: string;
  displayName: string;
  pictureUrl: string;
  points: number;
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isOpenCamera, setIsOpenCamera] = useState<boolean>(false);

  const loadUser = async () => {
    const meRes = await fetch("/api/me");
    const meData = await meRes.json();
    console.log("meData :: ", meData);

    if (meRes.status !== 200) {
      setUser(null);
      console.error("Unauthorized or invalid token");
      router.push("/");
      return;
    } else {
      const userData = await fetchUserByUserId(meData.userId);

      if (!userData) {
        console.error("Backend API GET user failed or network error");
        return;
      } else {
        if (!userData.exists) {
          const newUser = await createUser(meData.userId, meData.token);
          if (!newUser) {
            console.error("Failed to create user");
            setUser(null);
            router.push("/");
            return;
          } else {
            console.info("User created successfully");
            const bodyUser = {
              userId: meData.userId,
              displayName: meData.displayName,
              pictureUrl: meData.pictureUrl,
              points: newUser.points || 0,
              roles: newUser.roles || [],
            };
            setUser(bodyUser);
          }
        } else {
          console.log("User login successfully");
          const bodyUser = {
            userId: meData.userId,
            displayName: meData.displayName,
            pictureUrl: meData.pictureUrl,
            points: userData.user.points || 0,
            roles: userData.user.roles || [],
          };
          setUser(bodyUser);
        }
      }
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <div onClick={() => console.log("user :: ", user)}>test</div>
      {user && (
        <Image src={user.pictureUrl} alt="profile" width={100} height={100} />
      )}
      <UserQRCode userId={user.userId} />
      <h2>Welcome, {user.displayName}</h2>
      <p>คะแนนสะสม: {user.points}</p>

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
