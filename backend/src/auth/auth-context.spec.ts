import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { UserProfileController } from '../identity/users/user-profile.controller';
import { UsersController } from '../identity/users/users.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { postgresTestDatabase } from '../../test/support/pglite';
import { User, AccessScope } from '../identity/users/entities/user.entity';
import { UsersService } from '../identity/users/users.service';
import { Role } from '../identity/roles/entities/role.entity';
import { RolePermission } from '../identity/roles/entities/role-permission.entity';
import { RolesService } from '../identity/roles/roles.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtPayload } from './types/jwt-payload.type';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryService } from './login-history.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { Company } from '../organization/companies/entities/company.entity';
import { Site } from '../organization/sites/entities/site.entity';
import { Department } from '../organization/departments/entities/department.entity';
import { LoginDto } from './dto/login.dto';
import { CreatePurchaseRequestDto } from '../purchase/purchase-request/dto/create-purchase-request.dto';

jest.setTimeout(90000);
const secret = 'isolated-auth-test-secret-not-a-deployment-credential';
let db: DataSource,
  dispose: () => Promise<void>,
  auth: AuthService,
  jwt: JwtService,
  strategy: JwtStrategy,
  app: INestApplication,
  users: UsersService,
  history: LoginHistoryService;
beforeAll(async () => {
  const fixture = await postgresTestDatabase([
    User,
    Role,
    RolePermission,
    LoginHistory,
    Company,
    Site,
    Department,
  ]);
  db = fixture.dataSource;
  dispose = fixture.close;
  users = new UsersService(db.getRepository(User));
  const roles = new RolesService(
    db.getRepository(Role),
    db.getRepository(RolePermission),
  );
  jwt = new JwtService({ secret, signOptions: { expiresIn: '1h' } });
  history = new LoginHistoryService(
    db.getRepository(LoginHistory),
    new ConfigService({ app: { loginHistoryRetentionDays: 0 } }),
  );
  const configService = new ConfigService({ jwt: { accessSecret: secret }, app: { apiPrefix: '' } });
  auth = new AuthService(users, roles, jwt, history, configService);
  strategy = new JwtStrategy(
    auth,
    new ConfigService({ jwt: { accessSecret: secret } }),
  );
  const module = await Test.createTestingModule({
    imports: [PassportModule],
    controllers: [AuthController, UserProfileController, UsersController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: UsersService, useValue: users },
      { provide: LoginHistoryService, useValue: history },
      { provide: ConfigService, useValue: configService },
      PermissionsGuard,
      { provide: JwtStrategy, useValue: strategy },
      JwtAuthGuard,
    ],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
});
afterAll(async () => {
  if (app) await app.close();
  if (dispose) await dispose();
});
beforeEach(async () => {
  for (const entity of [
    LoginHistory,
    RolePermission,
    Role,
    User,
    Company,
    Site,
    Department,
  ])
    await db.getRepository(entity).clear();
  await db.getRepository(User).save({
    companyId: 'A',
    userId: 'owner',
    name: '사용자',
    passwordHash: await hash('test-password', 4),
    roleId: 'BUYER',
    siteId: 'S1',
    deptId: 'D1',
    accessScope: AccessScope.OWN_SITE,
    deleteYn: 'N',
    createdBy: 'system',
  });
  await db
    .getRepository(RolePermission)
    .save({ companyId: 'A', roleId: 'BUYER', permissionId: 'VENDOR:read' });
  await db
    .getRepository(RolePermission)
    .save({ companyId: 'B', roleId: 'BUYER', permissionId: 'VENDOR:delete' });
});
it('builds login context from the company-bound DB user and permissions', async () => {
  const response = await auth.login({
    companyId: 'A',
    userId: 'owner',
    password: 'test-password',
  });
  expect(response.user).toMatchObject({
    companyId: 'A',
    userId: 'owner',
    roleId: 'BUYER',
    siteId: 'S1',
    deptId: 'D1',
    permissions: ['VENDOR:read'],
  });
  expect(response.user).not.toHaveProperty('passwordHash');
  await expect(
    auth.login({ companyId: 'B', userId: 'owner', password: 'test-password' }),
  ).rejects.toThrow();
  await expect(
    auth.login({ companyId: 'A', userId: 'owner', password: 'wrong' }),
  ).rejects.toThrow();
});
it('rebuilds role, site, department and scope from DB instead of trusting old JWT claims', async () => {
  const login = await auth.login({
    companyId: 'A',
    userId: 'owner',
    password: 'test-password',
  });
  await db.getRepository(User).update(
    { companyId: 'A', userId: 'owner' },
    {
      roleId: 'READER',
      siteId: 'S2',
      deptId: 'D2',
      accessScope: AccessScope.OWN_DEPARTMENT,
    },
  );
  await db
    .getRepository(RolePermission)
    .save({ companyId: 'A', roleId: 'READER', permissionId: 'MATL:read' });
  const payload = await jwt.verifyAsync<JwtPayload>(login.accessToken);
  expect(payload).not.toHaveProperty('roleId');
  expect(await strategy.validate(payload)).toMatchObject({
    roleId: 'READER',
    siteId: 'S2',
    deptId: 'D2',
    accessScope: AccessScope.OWN_DEPARTMENT,
    permissions: ['MATL:read'],
  });
});
it('rejects a deleted user even when the previously issued token signature is valid', async () => {
  const login = await auth.login({
    companyId: 'A',
    userId: 'owner',
    password: 'test-password',
  });
  await db
    .getRepository(User)
    .update({ companyId: 'A', userId: 'owner' }, { deleteYn: 'Y' });
  await expect(
    strategy.validate(await jwt.verifyAsync<JwtPayload>(login.accessToken)),
  ).rejects.toThrow();
});
it('rejects client modifications of the signed company or user and expired tokens', async () => {
  const login = await auth.login({
    companyId: 'A',
    userId: 'owner',
    password: 'test-password',
  });
  const [header, encoded, signature] = login.accessToken.split('.');
  const payload = JSON.parse(
    Buffer.from(encoded, 'base64url').toString(),
  ) as JwtPayload;
  const modified = Buffer.from(
    JSON.stringify({ ...payload, companyId: 'B', sub: 'admin' }),
  ).toString('base64url');
  await expect(
    jwt.verifyAsync(`${header}.${modified}.${signature}`),
  ).rejects.toThrow();
  const expired = await jwt.signAsync(
    { sub: 'owner', companyId: 'A' },
    { expiresIn: -1 },
  );
  await expect(jwt.verifyAsync(expired)).rejects.toThrow();
});
it('rejects supplied login roles and business-request actor overrides at the DTO boundary', async () => {
  const settings = { whitelist: true, forbidNonWhitelisted: true };
  const login = await validate(
    plainToInstance(LoginDto, {
      companyId: 'A',
      userId: 'owner',
      password: 'test-password',
      permissions: ['VENDOR:delete'],
      roleId: 'ADMIN',
    }),
    settings,
  );
  expect(login.map((e) => e.property).sort()).toEqual([
    'permissions',
    'roleId',
  ]);
  const document = await validate(
    plainToInstance(CreatePurchaseRequestDto, {
      requestId: 'b47f2cba-e1f1-44a2-b540-a708bf198240',
      title: '문서',
      items: [],
      companyId: 'B',
      userId: 'admin',
      createdBy: 'admin',
      permissions: ['VENDOR:delete'],
    }),
    settings,
  );
  expect(document.map((e) => e.property).sort()).toEqual([
    'companyId',
    'createdBy',
    'permissions',
    'userId',
  ]);
});

const client = () =>
  request(app.getHttpServer() as Parameters<typeof request>[0]);
it('refreshes an expired access session with the HttpOnly cookie and rejects revoked sessions', async () => {
  const login = await client()
    .post('/auth/login')
    .send({ companyId: 'A', userId: 'owner', password: 'test-password' })
    .expect(201);
  expect(login.body).not.toHaveProperty('refreshToken');
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
  const refreshed = await client()
    .post('/auth/refresh')
    .set('Cookie', cookie)
    .expect(201);
  expect((refreshed.body as { user: UserContext }).user.companyId).toBe('A');
  await client()
    .get('/auth/me')
    .set('Authorization', `Bearer ${(refreshed.body as { accessToken: string }).accessToken}`)
    .expect(200);
  await client().post('/auth/refresh').expect(401);
  await db.getRepository(User).update(
    { companyId: 'A', userId: 'owner' },
    { tokenVersion: 1 },
  );
  await client().post('/auth/refresh').set('Cookie', cookie).expect(401);
  const logout = await client().post('/auth/logout').set('Cookie', cookie).expect(201);
  expect(logout.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
});
it('validates Bearer authentication through the real Passport strategy and reloads current DB context', async () => {
  await client().get('/auth/me').expect(401);
  const login = await client()
    .post('/auth/login')
    .send({ companyId: 'A', userId: 'owner', password: 'test-password' })
    .expect(201);
  const accessToken = (login.body as { accessToken: string }).accessToken;
  const current = await client()
    .get('/auth/me?companyId=B&userId=admin')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  expect(current.body).toMatchObject({
    companyId: 'A',
    userId: 'owner',
    permissions: ['VENDOR:read'],
  });
  expect(current.body).not.toHaveProperty('passwordHash');
  await db
    .getRepository(RolePermission)
    .delete({ companyId: 'A', roleId: 'BUYER' });
  const updated = await client()
    .get('/auth/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  expect((updated.body as { permissions: string[] }).permissions).toEqual([]);
  await db
    .getRepository(User)
    .update({ companyId: 'A', userId: 'owner' }, { deleteYn: 'Y' });
  await client()
    .get('/auth/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(401);
});
it.each([
  { sub: 'owner' },
  { companyId: 'A' },
  { sub: '', companyId: 'A' },
  { sub: 'owner', companyId: null },
  { sub: ['owner'], companyId: 'A' },
  { sub: 'owner', companyId: 'A'.repeat(31) },
])(
  'rejects signed tokens with malformed tenant/subject claims before looking up a user: %j',
  async (claims) => {
    const lookup = jest.spyOn(auth, 'buildUserContext');
    try {
      const token = await jwt.signAsync(claims);
      await client()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(lookup).not.toHaveBeenCalled();
    } finally {
      lookup.mockRestore();
    }
  },
);
it('rejects absent expiration, expired tokens, other secrets and other algorithms through Passport', async () => {
  const tokens = [
    await new JwtService({ secret }).signAsync({
      sub: 'owner',
      companyId: 'A',
    }),
    await jwt.signAsync({ sub: 'owner', companyId: 'A' }, { expiresIn: -1 }),
    await new JwtService({ secret: 'another-customer-secret' }).signAsync(
      { sub: 'owner', companyId: 'A' },
      { expiresIn: '1h' },
    ),
    await jwt.signAsync(
      { sub: 'owner', companyId: 'A' },
      { algorithm: 'HS384' },
    ),
  ];
  for (const token of tokens)
    await client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
});
it('does not query an arbitrary user for an absent tenant or subject', async () => {
  const users = jest.spyOn(db.getRepository(User), 'findOneBy');
  try {
    expect(
      await auth.buildUserContext(undefined as unknown as string, 'owner'),
    ).toBeNull();
    expect(
      await auth.buildUserContext('A', undefined as unknown as string),
    ).toBeNull();
    expect(users).not.toHaveBeenCalled();
  } finally {
    users.mockRestore();
  }
});

async function loginToken() {
  const response = await client()
    .post('/auth/login')
    .send({ companyId: 'A', userId: 'owner', password: 'test-password' })
    .expect(201);
  return (response.body as { accessToken: string }).accessToken;
}

it('keeps self-service identity routes authenticated and independent from administrator permissions', async () => {
  await client().get('/users/me/profile').expect(401);
  await client().patch('/users/me/profile').send({ email: null }).expect(401);
  await client().patch('/users/me/password').send({}).expect(401);
  const token = await loginToken();
  const authorization = `Bearer ${token}`;
  const context = await client()
    .get('/auth/me')
    .set('Authorization', authorization)
    .expect(200);
  expect(context.body.permissions).not.toContain('USER:read');
  expect(context.body.permissions).not.toContain('USER:update');
  await client()
    .get('/users/me/profile')
    .set('Authorization', authorization)
    .expect(200);
  await client()
    .get('/users/other')
    .set('Authorization', authorization)
    .expect(403);
  await client()
    .patch('/users/other')
    .set('Authorization', authorization)
    .send({ email: 'other@example.com' })
    .expect(403);
  await client()
    .get('/auth/profile')
    .set('Authorization', authorization)
    .expect(404);
  await client()
    .patch('/auth/profile')
    .set('Authorization', authorization)
    .send({})
    .expect(404);
  await client()
    .patch('/auth/password')
    .set('Authorization', authorization)
    .send({})
    .expect(404);
});

it('allows every authenticated user to read their own named profile and update only contact fields', async () => {
  await db
    .getRepository(Company)
    .save({ companyId: 'A', name: '회사 A', createdBy: 'system' });
  await db.getRepository(Site).save({
    companyId: 'A',
    siteId: 'S1',
    name: '사업장 1',
    createdBy: 'system',
  });
  await db.getRepository(Department).save({
    companyId: 'A',
    deptId: 'D1',
    name: '설비팀',
    createdBy: 'system',
  });
  const token = await loginToken();
  const profile = await client()
    .get('/users/me/profile?companyId=B&userId=admin')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(profile.body).toMatchObject({
    companyId: 'A',
    userId: 'owner',
    companyName: '회사 A',
    siteName: '사업장 1',
    deptName: '설비팀',
    name: '사용자',
  });
  expect(profile.body).not.toHaveProperty('passwordHash');
  expect(profile.body).not.toHaveProperty('tokenVersion');
  const updated = await client()
    .patch('/users/me/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ email: ' person@example.com ', phoneNumber: ' 010-1234-5678 ' })
    .expect(200);
  expect(updated.body).toMatchObject({
    email: 'person@example.com',
    phoneNumber: '010-1234-5678',
    roleId: 'BUYER',
  });
  await client()
    .patch('/users/me/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ email: 'invalid' })
    .expect(400);
  for (const key of [
    'companyId',
    'userId',
    'name',
    'roleId',
    'deptId',
    'tokenVersion',
    'passwordHash',
  ]) {
    await client()
      .patch('/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ [key]: 'override' })
      .expect(400);
  }
  const empty = await client()
    .patch('/users/me/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ email: '', phoneNumber: null })
    .expect(200);
  expect(empty.body).toMatchObject({ email: null, phoneNumber: null });
  expect(
    (
      await db
        .getRepository(User)
        .findOneByOrFail({ companyId: 'A', userId: 'owner' })
    ).tokenVersion,
  ).toBe(0);
});

it('changes a password atomically, revokes all previously issued tokens and requires the new password', async () => {
  const first = await loginToken(),
    second = await loginToken();
  const api = () =>
    client()
      .patch('/users/me/password')
      .set('Authorization', `Bearer ${first}`);
  await api()
    .send({ currentPassword: 'wrong', newPassword: 'next-password-123' })
    .expect(400);
  await api()
    .send({ currentPassword: 'test-password', newPassword: 'short1' })
    .expect(400);
  await api()
    .send({ currentPassword: 'test-password', newPassword: 'a'.repeat(12) })
    .expect(400);
  await api()
    .send({ currentPassword: 'test-password', newPassword: 'test-password' })
    .expect(400);
  await api()
    .send({
      currentPassword: 'test-password',
      newPassword: '한'.repeat(24) + 'A1',
    })
    .expect(400);
  await api()
    .send({
      currentPassword: 'test-password',
      newPassword: 'next-password-123',
      userId: 'other',
    })
    .expect(400);
  await api()
    .send({
      currentPassword: 'test-password',
      newPassword: 'next-password-123',
    })
    .expect(200);
  for (const token of [first, second])
    await client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  await client()
    .post('/auth/login')
    .send({ companyId: 'A', userId: 'owner', password: 'test-password' })
    .expect(401);
  const fresh = await client()
    .post('/auth/login')
    .send({ companyId: 'A', userId: 'owner', password: 'next-password-123' })
    .expect(201);
  await client()
    .get('/auth/me')
    .set(
      'Authorization',
      `Bearer ${(fresh.body as { accessToken: string }).accessToken}`,
    )
    .expect(200);
  const user = await db
    .getRepository(User)
    .findOneByOrFail({ companyId: 'A', userId: 'owner' });
  expect(user.tokenVersion).toBe(1);
  expect(user.passwordHash).not.toBe('next-password-123');
});

it('revokes tokens for an administrator password reset as well', async () => {
  const token = await loginToken();
  await users.update({ companyId: 'A', userId: 'admin' } as never, 'owner', {
    password: 'reset-password-123',
  });
  await client()
    .get('/auth/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(401);
});

it('records success and failure without secrets and isolates paged history behind a company-bound permission', async () => {
  const token = await loginToken();
  await client()
    .post('/auth/login')
    .set('X-Forwarded-For', '203.0.113.99')
    .set('User-Agent', 'isolated-test-browser')
    .send({ companyId: 'A', userId: 'owner', password: 'wrong' })
    .expect(401);
  await client()
    .post('/auth/login')
    .send({ companyId: 'B', userId: 'unknown', password: 'wrong' })
    .expect(401);
  await client().get('/auth/login-history').expect(401);
  await client()
    .get('/auth/login-history')
    .set('Authorization', `Bearer ${token}`)
    .expect(403);
  await db.getRepository(RolePermission).save({
    companyId: 'A',
    roleId: 'BUYER',
    permissionId: 'LOGHIST:read',
  });
  const response = await client()
    .get('/auth/login-history?result=failure&page=1&limit=1')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(response.body).toMatchObject({
    total: 1,
    page: 1,
    limit: 1,
    items: [
      {
        companyId: 'A',
        userId: 'owner',
        success: false,
        failureReason: 'INVALID_PASSWORD',
        userAgent: 'isolated-test-browser',
      },
    ],
  });
  expect(
    (response.body as { items: { ipAddress: string }[] }).items[0].ipAddress,
  ).not.toBe('203.0.113.99');
  expect(JSON.stringify(response.body)).not.toMatch(
    /test-password|Bearer|passwordHash|accessToken/,
  );
  for (const query of [
    'companyId=B',
    'page=0',
    'limit=101',
    'result=other',
    'from=invalid',
    'from=2026-11-14&to=2026-11-13',
  ]) {
    await client()
      .get(`/auth/login-history?${query}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  }
  const none = await client()
    .get('/auth/login-history?userId=absent')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(none.body).toMatchObject({ total: 0, items: [] });
});

it('enforces the configured retention cutoff without deleting recent history', async () => {
  await history.record('A', 'old', false, 'INVALID_PASSWORD', {});
  await history.record('A', 'recent', true, null, {});
  await db
    .getRepository(LoginHistory)
    .update(
      { userId: 'old' },
      { attemptedAt: new Date(Date.now() - 91 * 86400000) },
    );
  const retention = new LoginHistoryService(
    db.getRepository(LoginHistory),
    new ConfigService({ app: { loginHistoryRetentionDays: 90 } }),
  );
  await retention.prune();
  expect(await db.getRepository(LoginHistory).find()).toEqual([
    expect.objectContaining({ userId: 'recent' }),
  ]);
});

it('allows only one concurrent password replacement and never resets token versions through profile edits', async () => {
  const context = await auth.buildUserContext('A', 'owner');
  const attempts = await Promise.allSettled([
    users.changePassword(context!, {
      currentPassword: 'test-password',
      newPassword: 'first-password-123',
    }),
    users.changePassword(context!, {
      currentPassword: 'test-password',
      newPassword: 'second-password-123',
    }),
  ]);
  expect(
    attempts.filter((attempt) => attempt.status === 'fulfilled'),
  ).toHaveLength(1);
  await users.updateProfile(context!, { email: 'new@example.com' });
  const current = await db
    .getRepository(User)
    .findOneByOrFail({ companyId: 'A', userId: 'owner' });
  expect(current.tokenVersion).toBe(1);
  expect(current.email).toBe('new@example.com');
});

it('uses Korean date boundaries and returns an exact paged history count', async () => {
  await history.record('A', 'boundary', true, null, {});
  await history.record('A', 'outside', true, null, {});
  await history.record('B', 'foreign', true, null, {});
  await db
    .getRepository(LoginHistory)
    .update(
      { companyId: 'A', userId: 'boundary' },
      { attemptedAt: new Date('2026-11-13T15:00:00Z') },
    );
  await db
    .getRepository(LoginHistory)
    .update(
      { companyId: 'A', userId: 'outside' },
      { attemptedAt: new Date('2026-11-13T14:59:59Z') },
    );
  expect(
    await history.list({ companyId: 'A' } as never, {
      from: '2026-11-14',
      to: '2026-11-14',
      page: 1,
      limit: 1,
    }),
  ).toMatchObject({
    total: 1,
    items: [expect.objectContaining({ userId: 'boundary' })],
  });
  expect(
    await history.list({ companyId: 'A' } as never, { page: 2, limit: 1 }),
  ).toMatchObject({
    total: 2,
    page: 2,
    items: [expect.objectContaining({ userId: 'outside' })],
  });
});
