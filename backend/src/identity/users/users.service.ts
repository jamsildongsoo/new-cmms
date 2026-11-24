/** 회사별 사용자·소속을 관리하고 비밀번호 해시를 응답에서 제외한다. 기준정보 선택값은 소급 변경하지 않는다. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { Repository } from 'typeorm';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Role } from '../roles/entities/role.entity';
import { UserContext } from '../../auth/types/user-context.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AccessScope, User } from './entities/user.entity';
import { Company } from '../../organization/companies/entities/company.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findActiveById(companyId: string, userId: string): Promise<User | null> {
    return this.userRepository.findOneBy({
      companyId,
      userId,
      deleteYn: 'N',
    });
  }

  async profile(context: UserContext) {
    const user = await this.findActiveByIdOrThrow(
      context.companyId,
      context.userId,
    );
    const manager = this.userRepository.manager;
    const [company, site, department, role] = await Promise.all([
      manager.findOneBy(Company, { companyId: user.companyId, deleteYn: 'N' }),
      user.siteId
        ? manager.findOneBy(Site, {
            companyId: user.companyId,
            siteId: user.siteId,
            deleteYn: 'N',
          })
        : null,
      user.deptId
        ? manager.findOneBy(Department, {
            companyId: user.companyId,
            deptId: user.deptId,
            deleteYn: 'N',
          })
        : null,
      manager.findOneBy(Role, {
        companyId: user.companyId,
        roleId: user.roleId,
        deleteYn: 'N',
      }),
    ]);
    return {
      companyId: user.companyId,
      companyName: company?.name ?? null,
      userId: user.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      title: user.title,
      position: user.position,
      siteId: user.siteId,
      siteName: site?.name ?? null,
      deptId: user.deptId,
      deptName: department?.name ?? null,
      roleId: user.roleId,
      roleName: role?.name ?? null,
      accessScope: user.accessScope,
    };
  }

  async updateProfile(context: UserContext, dto: UpdateProfileDto) {
    await this.findActiveByIdOrThrow(context.companyId, context.userId);
    const patch = {
      ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
      ...(dto.phoneNumber !== undefined && {
        phoneNumber: dto.phoneNumber?.trim() || null,
      }),
    };
    if (Object.keys(patch).length) {
      await this.userRepository.update(
        { companyId: context.companyId, userId: context.userId, deleteYn: 'N' },
        {
          ...patch,
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      );
    }
    return this.profile(context);
  }

  async changePassword(context: UserContext, dto: ChangePasswordDto) {
    const user = await this.findActiveByIdOrThrow(
      context.companyId,
      context.userId,
    );
    if (!(await compare(dto.currentPassword, user.passwordHash)))
      throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');
    if (
      dto.newPassword.length < 10 ||
      Buffer.byteLength(dto.newPassword, 'utf8') > 72 ||
      !/[A-Za-z]/.test(dto.newPassword) ||
      !/\d/.test(dto.newPassword)
    )
      throw new BadRequestException(
        '새 비밀번호는 영문과 숫자를 포함한 10자 이상, 72바이트 이내로 입력해 주세요.',
      );
    if (await compare(dto.newPassword, user.passwordHash))
      throw new BadRequestException(
        '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.',
      );
    const result = await this.userRepository.update(
      {
        companyId: user.companyId,
        userId: user.userId,
        deleteYn: 'N',
        tokenVersion: user.tokenVersion,
        passwordHash: user.passwordHash,
      },
      {
        passwordHash: await hash(dto.newPassword, PASSWORD_HASH_ROUNDS),
        tokenVersion: () => '"tokenVersion" + 1',
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    );
    if (result.affected !== 1)
      throw new ConflictException(
        '비밀번호가 이미 변경되었습니다. 다시 로그인해 주세요.',
      );
    return { message: '비밀번호를 변경했습니다. 다시 로그인해 주세요.' };
  }

  // 선택 목록만 활성 값으로 제한한다. 저장 시 기준정보를 다시 조회하지 않는다.
  async findOptions(userContext: UserContext) {
    const where = { companyId: userContext.companyId, deleteYn: 'N' };
    const [sites, departments, roles] = await Promise.all([
      this.userRepository.manager.find(Site, {
        where,
        order: { siteId: 'ASC' },
      }),
      this.userRepository.manager.find(Department, {
        where,
        order: { deptId: 'ASC' },
      }),
      this.userRepository.manager.find(Role, {
        where,
        order: { roleId: 'ASC' },
      }),
    ]);
    return {
      sites: sites.map((row) => ({ id: row.siteId, name: row.name })),
      departments: departments.map((row) => ({
        id: row.deptId,
        name: row.name,
      })),
      roles: roles.map((row) => ({ id: row.roleId, name: row.name })),
    };
  }

  async findAll(userContext: UserContext): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      where: {
        companyId: userContext.companyId,
        deleteYn: 'N',
      },
      order: {
        userId: 'ASC',
      },
    });

    return Promise.all(users.map((user) => this.toResponse(user)));
  }

  async findOne(
    userContext: UserContext,
    userId: string,
  ): Promise<UserResponseDto> {
    const user = await this.findActiveByIdOrThrow(
      userContext.companyId,
      userId,
    );
    return this.toResponse(user);
  }

  async create(
    userContext: UserContext,
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const validatedDto = this.validateCreateDto(createUserDto);
    const existingUser = await this.userRepository.findOneBy({
      companyId: userContext.companyId,
      userId: validatedDto.userId,
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const user = this.userRepository.create({
      companyId: userContext.companyId,
      userId: validatedDto.userId,
      passwordHash: await hash(validatedDto.password, PASSWORD_HASH_ROUNDS),
      name: validatedDto.name,
      email: validatedDto.email,
      phoneNumber: validatedDto.phoneNumber,
      title: validatedDto.title,
      position: validatedDto.position,
      roleId: validatedDto.roleId,
      siteId: validatedDto.siteId,
      deptId: validatedDto.deptId,
      accessScope: validatedDto.accessScope,
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.userRepository.save(user));
  }

  async update(
    userContext: UserContext,
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.findActiveByIdOrThrow(userContext.companyId, userId);
    const allowEmptyOrganization =
      user.roleId === 'ADMIN' &&
      user.accessScope === AccessScope.COMPANY_ALL &&
      user.siteId === null &&
      user.deptId === null &&
      (updateUserDto.roleId === undefined || updateUserDto.roleId === 'ADMIN') &&
      (updateUserDto.accessScope === undefined ||
        updateUserDto.accessScope === AccessScope.COMPANY_ALL);
    const validatedDto = this.validateUpdateDto(
      updateUserDto,
      allowEmptyOrganization,
    );
    const nextSiteId =
      validatedDto.siteId === undefined ? user.siteId : validatedDto.siteId;
    const nextDeptId =
      validatedDto.deptId === undefined ? user.deptId : validatedDto.deptId;
    if (
      (!allowEmptyOrganization && (!nextSiteId || !nextDeptId)) ||
      (allowEmptyOrganization && Boolean(nextSiteId) !== Boolean(nextDeptId))
    ) {
      throw new BadRequestException('siteId and deptId are required together');
    }

    await this.userRepository.update(
      { companyId: userContext.companyId, userId },
      {
        name: validatedDto.name,
        email: validatedDto.email,
        phoneNumber: validatedDto.phoneNumber,
        title: validatedDto.title,
        position: validatedDto.position,
        roleId: validatedDto.roleId,
        siteId: validatedDto.siteId,
        deptId: validatedDto.deptId,
        accessScope: validatedDto.accessScope,
        ...(validatedDto.password !== undefined && {
          passwordHash: await hash(validatedDto.password, PASSWORD_HASH_ROUNDS),
          tokenVersion: () => '"tokenVersion" + 1',
        }),
        updatedBy: userContext.userId,
        updatedAt: new Date(),
      },
    );
    return this.toResponse(
      await this.findActiveByIdOrThrow(userContext.companyId, userId),
    );
  }

  async remove(
    userContext: UserContext,
    userId: string,
  ): Promise<UserResponseDto> {
    const user = await this.findActiveByIdOrThrow(
      userContext.companyId,
      userId,
    );

    await this.userRepository.update(
      { companyId: user.companyId, userId: user.userId },
      {
        deleteYn: 'Y',
        tokenVersion: () => '"tokenVersion" + 1',
        updatedBy: userContext.userId,
        updatedAt: new Date(),
      },
    );
    const removed = await this.userRepository.findOneByOrFail({
      companyId: user.companyId,
      userId: user.userId,
    });
    return this.toResponse(removed);
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    userId: string,
  ): Promise<User> {
    const user = await this.findActiveById(companyId, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private validateCreateDto(
    createUserDto: CreateUserDto,
  ): Required<CreateUserDto> {
    const userId = this.requireTrimmedString(createUserDto.userId, 'userId');
    const password = this.requireTrimmedString(
      createUserDto.password,
      'password',
    );
    const name = this.requireTrimmedString(createUserDto.name, 'name');
    const roleId = this.requireTrimmedString(createUserDto.roleId, 'roleId');
    const siteId = this.requireTrimmedString(createUserDto.siteId, 'siteId');
    const deptId = this.requireTrimmedString(createUserDto.deptId, 'deptId');
    const accessScope = this.requireAccessScope(createUserDto.accessScope);

    return {
      userId,
      password,
      name,
      email: this.normalizeNullableString(createUserDto.email),
      phoneNumber: this.normalizeNullableString(createUserDto.phoneNumber),
      title: this.normalizeNullableString(createUserDto.title),
      position: this.normalizeNullableString(createUserDto.position),
      roleId,
      siteId,
      deptId,
      accessScope,
    };
  }

  private validateUpdateDto(
    updateUserDto: UpdateUserDto,
    allowEmptyOrganization = false,
  ): UpdateUserDto {
    return {
      password:
        updateUserDto.password === undefined
          ? undefined
          : this.requireTrimmedString(updateUserDto.password, 'password'),
      name:
        updateUserDto.name === undefined
          ? undefined
          : this.requireTrimmedString(updateUserDto.name, 'name'),
      email:
        updateUserDto.email === undefined
          ? undefined
          : this.normalizeNullableString(updateUserDto.email),
      phoneNumber:
        updateUserDto.phoneNumber === undefined
          ? undefined
          : this.normalizeNullableString(updateUserDto.phoneNumber),
      title:
        updateUserDto.title === undefined
          ? undefined
          : this.normalizeNullableString(updateUserDto.title),
      position:
        updateUserDto.position === undefined
          ? undefined
          : this.normalizeNullableString(updateUserDto.position),
      roleId:
        updateUserDto.roleId === undefined
          ? undefined
          : this.requireTrimmedString(updateUserDto.roleId, 'roleId'),
      siteId:
        updateUserDto.siteId === undefined
          ? undefined
          : allowEmptyOrganization && !updateUserDto.siteId?.trim()
            ? null
            : this.requireTrimmedString(updateUserDto.siteId, 'siteId'),
      deptId:
        updateUserDto.deptId === undefined
          ? undefined
          : allowEmptyOrganization && !updateUserDto.deptId?.trim()
            ? null
            : this.requireTrimmedString(updateUserDto.deptId, 'deptId'),
      accessScope:
        updateUserDto.accessScope === undefined
          ? undefined
          : this.requireAccessScope(updateUserDto.accessScope),
    };
  }

  private requireTrimmedString(
    value: string | null | undefined,
    fieldName: string,
  ): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private normalizeNullableString(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmedValue = value.trim();
    return trimmedValue === '' ? null : trimmedValue;
  }

  private requireAccessScope(value: AccessScope | undefined): AccessScope {
    if (!value || !Object.values(AccessScope).includes(value)) {
      throw new BadRequestException('accessScope is invalid');
    }
    return value;
  }

  private async toResponse(user: User): Promise<UserResponseDto> {
    // 기존 ID를 유지하며 이름 조회는 활성 기준정보만 대상으로 한다.
    const [site, department] = await Promise.all([
      user.siteId
        ? this.userRepository.manager.findOneBy(Site, {
            companyId: user.companyId,
            siteId: user.siteId,
            deleteYn: 'N',
          })
        : null,
      user.deptId
        ? this.userRepository.manager.findOneBy(Department, {
            companyId: user.companyId,
            deptId: user.deptId,
            deleteYn: 'N',
          })
        : null,
    ]);
    return {
      companyId: user.companyId,
      userId: user.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      title: user.title,
      position: user.position,
      roleId: user.roleId,
      siteId: user.siteId,
      siteName: site?.name ?? null,
      deptName: department?.name ?? null,
      deptId: user.deptId,
      accessScope: user.accessScope,
      deleteYn: user.deleteYn,
      createdBy: user.createdBy,
      createdAt: user.createdAt,
      updatedBy: user.updatedBy,
      updatedAt: user.updatedAt,
    };
  }
}
