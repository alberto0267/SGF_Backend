export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos hasta que expira el access token
}

export interface MeResponse {
  uuid: string;
  email: string;
  role: string;
  name: string;
  companyName: string | null;
  active: boolean;
}
