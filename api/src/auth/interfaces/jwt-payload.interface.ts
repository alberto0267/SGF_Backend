export interface JwtPayload {
  sub: string;
  id: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
