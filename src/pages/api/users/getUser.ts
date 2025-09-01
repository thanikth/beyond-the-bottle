import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchUserByUserId(userId: string) {
  try {
    const res = await axios.get(`${API_URL}/users/${userId}`);
    return res.data;
  } catch (error: any) {
    console.error('API error', error.response?.data || error.message);
    return null;
  }
}
