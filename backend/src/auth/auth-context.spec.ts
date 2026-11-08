import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
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
import { LoginDto } from './dto/login.dto';
import { CreatePurchaseRequestDto } from '../purchase/purchase-request/dto/create-purchase-request.dto';

jest.setTimeout(90000);
const secret = 'isolated-auth-test-secret-not-a-deployment-credential';
let db: DataSource,
  dispose: () => Promise<void>,
  auth: AuthService,
  jwt: JwtService,
  strategy: JwtStrategy,
  app: INestApplication;
beforeAll(async () => {
  const fixture = await postgresTestDatabase([User, Role, RolePermission]);
  db = fixture.dataSource;
  dispose = fixture.close;
  const users = new UsersService(db.getRepository(User));
  const roles = new RolesService(
    db.getRepository(Role),
    db.getRepository(RolePermission),
  );
  jwt = new JwtService({ secret, signOptions: { expiresIn: '1h' } });
  auth = new AuthService(users, roles, jwt);
  strategy = new JwtStrategy(
    auth,
    new ConfigService({ jwt: { accessSecret: secret } }),
  );
  const module = await Test.createTestingModule({
    imports: [PassportModule],
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: auth },
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
  for (const entity of [RolePermission, Role, User])
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
    .save({ companyId: 'A', roleId: 'BUYER', permissionId: 'vendor:read' });
  await db
    .getRepository(RolePermission)
    .save({ companyId: 'B', roleId: 'BUYER', permissionId: 'vendor:delete' });
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
    permissions: ['vendor:read'],
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
    .save({ companyId: 'A', roleId: 'READER', permissionId: 'material:read' });
  const payload = await jwt.verifyAsync<JwtPayload>(login.accessToken);
  expect(payload).not.toHaveProperty('roleId');
  expect(await strategy.validate(payload)).toMatchObject({
    roleId: 'READER',
    siteId: 'S2',
    deptId: 'D2',
    accessScope: AccessScope.OWN_DEPARTMENT,
    permissions: ['material:read'],
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
      permissions: ['vendor:delete'],
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
      permissions: ['vendor:delete'],
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
    permissions: ['vendor:read'],
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
