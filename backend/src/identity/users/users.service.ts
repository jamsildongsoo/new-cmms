import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
import { Repository } from 'typeorm';
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

    return users.map((user) => this.toResponse(user));
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

  private toResponse(user: User): UserResponseDto {
    return {
      companyId: user.companyId,
      userId: user.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      title: user.title,
      position: user.position,
      roleId: user.roleId,
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
