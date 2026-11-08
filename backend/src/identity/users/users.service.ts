/** 회사별 사용자·소속을 관리하고 비밀번호 해시를 응답에서 제외한다. 기준정보 선택값은 소급 변경하지 않는다. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
import { Repository } from 'typeorm';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Role } from '../roles/entities/role.entity';
import { UserContext } from '../../auth/types/user-context.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AccessScope, User } from './entities/user.entity';

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
    const user = await this.findActiveByIdOrThrow(
      userContext.companyId,
      userId,
    );
    const validatedDto = this.validateUpdateDto(updateUserDto);

    if (validatedDto.password !== undefined) {
      user.passwordHash = await hash(
        validatedDto.password,
        PASSWORD_HASH_ROUNDS,
      );
    }
    if (validatedDto.name !== undefined) {
      user.name = validatedDto.name;
    }
    if (validatedDto.email !== undefined) {
      user.email = validatedDto.email;
    }
    if (validatedDto.phoneNumber !== undefined) {
      user.phoneNumber = validatedDto.phoneNumber;
    }
    if (validatedDto.title !== undefined) {
      user.title = validatedDto.title;
    }
    if (validatedDto.position !== undefined) {
      user.position = validatedDto.position;
    }
    if (validatedDto.roleId !== undefined) {
      user.roleId = validatedDto.roleId;
    }
    if (validatedDto.siteId !== undefined) {
      user.siteId = validatedDto.siteId;
    }
    if (validatedDto.deptId !== undefined) {
      user.deptId = validatedDto.deptId;
    }
    if (validatedDto.accessScope !== undefined) {
      user.accessScope = validatedDto.accessScope;
    }

    user.updatedBy = userContext.userId;
    user.updatedAt = new Date();

    return this.toResponse(await this.userRepository.save(user));
  }

  async remove(
    userContext: UserContext,
    userId: string,
  ): Promise<UserResponseDto> {
    const user = await this.findActiveByIdOrThrow(
      userContext.companyId,
      userId,
    );

    user.deleteYn = 'Y';
    user.updatedBy = userContext.userId;
    user.updatedAt = new Date();

    return this.toResponse(await this.userRepository.save(user));
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

  private validateUpdateDto(updateUserDto: UpdateUserDto): UpdateUserDto {
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
          : this.requireTrimmedString(updateUserDto.siteId, 'siteId'),
      deptId:
        updateUserDto.deptId === undefined
          ? undefined
          : this.requireTrimmedString(updateUserDto.deptId, 'deptId'),
      accessScope:
        updateUserDto.accessScope === undefined
          ? undefined
          : this.requireAccessScope(updateUserDto.accessScope),
    };
  }

  private requireTrimmedString(
    value: string | undefined,
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
    // 기존 연결값은 소급 변경하지 않고 삭제된 기준정보의 이름도 조회한다.
    const [site, department] = await Promise.all([
      user.siteId
        ? this.userRepository.manager.findOneBy(Site, {
            companyId: user.companyId,
            siteId: user.siteId,
          })
        : null,
      this.userRepository.manager.findOneBy(Department, {
        companyId: user.companyId,
        deptId: user.deptId,
      }),
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
      siteDeleted: site?.deleteYn === 'Y',
      deptName: department?.name ?? null,
      deptDeleted: department?.deleteYn === 'Y',
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
