const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export async function signup(email: string, password: string, firstName?: string, lastName?: string) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(email: string, password: string) {
  const data = new URLSearchParams();
  data.append('username', email);
  data.append('password', password);
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data.toString(),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  // store token
  localStorage.setItem('intervai-token', json.access_token);
  return json;
}

export function signout() {
  localStorage.removeItem('intervai-token');
}

export function getToken() {
  return localStorage.getItem('intervai-token');
}
