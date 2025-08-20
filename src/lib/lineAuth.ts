import axios from "axios";

const LINE_AUTH_URL = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const LINE_PROFILE_URL = "https://api.line.me/v2/profile";

export const getLineLoginUrl = () => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINE_CHANNEL_ID!,
    redirect_uri: process.env.LINE_CALLBACK_URL!,
    state: "random_state_string",
    scope: "profile openid email",
  });
  return `${LINE_AUTH_URL}?${params.toString()}`;
};

export const getToken = async (code: string) => {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.LINE_CALLBACK_URL!,
    client_id: process.env.LINE_CHANNEL_ID!,
    client_secret: process.env.LINE_CHANNEL_SECRET!,
  });

  const res = await axios.post(LINE_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
};

export const getProfile = async (accessToken: string) => {
  const res = await axios.get(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
};
