/** JWT에는 인증 주체만 담고 소속·역할·권한은 요청마다 DB에서 읽는다. */
export interface JwtPayload {
  sub: string;
  companyId: string;
  tokenVersion: number;
  exp?: number;
  iat?: number;
}
