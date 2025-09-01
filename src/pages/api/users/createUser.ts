import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function createUser(userId: string, token: string) {
  try {
    const res = await axios.post(`${API_URL}/auth/register`, {
            userId,
            token,
          });
    return res.data;
  } catch (error: any) {
    console.error('API error', error.response?.data || error.message);
    return null;
  }
}