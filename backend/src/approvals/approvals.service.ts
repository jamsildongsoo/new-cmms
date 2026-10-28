import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import { User } from '../identity/users/entities/user.entity';
import { Department } from '../organization/departments/entities/department.entity';
import { UserContext } from '../auth/types/user-context.type';
import { DocumentStatus } from '../common/constants/document-status';
import { assertDraft } from '../common/utils/document-status.util';
import { ApprovalActionDto } from './dto/approval-action.dto';
import {
  ApprovalResponseDto,
  ApprovalUserInfoDto,
  ApprovalStepResponseDto,
} from './dto/approval-response.dto';
import { ApprovalStepInputDto } from './dto/approval-step-input.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import {
  ApprovalStep,
  ApprovalStepType,
} from './entities/approval-step.entity';
import { Approval } from './entities/approval.entity';
import { SOURCE_DOCUMENTS } from './source-documents';

type ApprovalBox = 'submit' | 'pending' | 'processed' | 'closed' | 'reference';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepository: Repository<Approval>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async searchUsers(
    userContext: UserContext,
    query: string,
  ): Promise<ApprovalUserInfoDto[]> {
    const keyword = query.trim();
    if (!keyword) {
      return [];
    }
    const pattern = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
    const users = await this.userRepository
      .createQueryBuilder('u')
      .where('u.companyId = :companyId', { companyId: userContext.companyId })
      .andWhere("u.deleteYn = 'N'")
      .andWhere('(u.userId ILIKE :pattern OR u.name ILIKE :pattern)', {
        pattern,
      })
      .orderBy('u.userId', 'ASC')
      .limit(10)
      .getMany();
    const directory = await this.loadDirectory(
      userContext.companyId,
      users.map((user) => user.userId),
    );
    return users.map((user) => directory.get(user.userId)!);
  }

  async findUserInfo(
    userContext: UserContext,
    userId: string,
  ): Promise<ApprovalUserInfoDto> {
    const user = await this.userRepository.findOneBy({
      companyId: userContext.companyId,
      userId: userId.trim(),
      deleteYn: 'N',
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return (await this.loadDirectory(userContext.companyId, [user.userId])).get(
      user.userId,
    )!;
  }

  private async loadDirectory(
    companyId: string,
    userIds: string[],
  ): Promise<Map<string, ApprovalUserInfoDto>> {
    const directory = new Map<string, ApprovalUserInfoDto>();
    const ids = [...new Set(userIds)];
    if (ids.length === 0) {
      return directory;
    }
    const users = await this.userRepository.findBy({
      companyId,
      userId: In(ids),
    });
    const deptIds = [...new Set(users.map((user) => user.deptId))];
    const departments = deptIds.length
      ? await this.departmentRepository.findBy({
          companyId,
          deptId: In(deptIds),
        })
      : [];
    const deptNames = new Map(departments.map((d) => [d.deptId, d.name]));
    for (const user of users) {
      directory.set(user.userId, {
        userId: user.userId,
        userName: user.name,
        deptId: user.deptId,
        deptName: deptNames.get(user.deptId) ?? null,
        title: user.title,
        position: user.position,
      });
    }
    return directory;
  }

  async create(
    userContext: UserContext,
    dto: CreateApprovalDto,
  ): Promise<ApprovalResponseDto> {
    const approvalId = dto.approvalId ?? randomUUID();
    const existingApproval = await this.approvalRepository.findOneBy({
      companyId: userContext.companyId,
      approvalId,
    });
    if (existingApproval) {
      throw new ConflictException('Approval already exists');
    }

    const approval = this.approvalRepository.create({
      companyId: userContext.companyId,
      approvalId,
      refModule: this.normalizeNullableString(dto.refModule),
      refId: this.normalizeNullableString(dto.refId),
      title: this.requireTrimmedString(dto.title, 'title'),
      contentJson: this.requireContentJson(dto.contentJson),
      submitterId: userContext.userId,
      status: DocumentStatus.DRAFT,
      attachmentId: this.normalizeNullableString(dto.attachmentId),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });
    const savedApproval = await this.approvalRepository.save(approval);
    await this.replaceDraftSteps(
      userContext,
      savedApproval.approvalId,
      dto.steps,
    );

    if (dto.submit === true) {
      return this.submit(userContext, savedApproval.approvalId);
    }

    return this.findOne(userContext, savedApproval.approvalId);
  }

  async findBox(
    userContext: UserContext,
    box: ApprovalBox,
  ): Promise<ApprovalResponseDto[]> {
    this.assertValidBox(box);
    const approvals = await this.findVisibleApprovals(userContext);
    const approvalIds = approvals.map((approval) => approval.approvalId);
    const steps = await this.findSteps(userContext.companyId, approvalIds);
    const stepsByApprovalId = this.groupSteps(steps);
    const filteredApprovals = approvals.filter((approval) =>
      this.isInBox(
        userContext,
        approval,
        stepsByApprovalId.get(approval.approvalId) ?? [],
        box,
      ),
    );

    const directory = await this.loadDirectory(
      userContext.companyId,
      filteredApprovals.flatMap((approval) =>
        (stepsByApprovalId.get(approval.approvalId) ?? []).map((s) => s.userId),
      ),
    );
    return filteredApprovals.map((approval) =>
      this.toResponse(
        approval,
        stepsByApprovalId.get(approval.approvalId) ?? [],
        directory,
      ),
    );
  }

  async findOne(
    userContext: UserContext,
    approvalId: string,
  ): Promise<ApprovalResponseDto> {
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    const steps = await this.findSteps(userContext.companyId, [
      approval.approvalId,
    ]);

    if (!this.canView(userContext, approval, steps)) {
      throw new ForbiddenException('Approval is not visible to this user');
    }

    return this.toResponse(
      approval,
      steps,
      await this.loadDirectory(
        userContext.companyId,
        steps.map((step) => step.userId),
      ),
    );
  }

  async update(
    userContext: UserContext,
    approvalId: string,
    dto: UpdateApprovalDto,
  ): Promise<ApprovalResponseDto> {
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    assertDraft(approval.status);

    if (dto.refModule !== undefined) {
      approval.refModule = this.normalizeNullableString(dto.refModule);
    }
    if (dto.refId !== undefined) {
      approval.refId = this.normalizeNullableString(dto.refId);
    }
    if (dto.title !== undefined) {
      approval.title = this.requireTrimmedString(dto.title, 'title');
    }
    if (dto.contentJson !== undefined) {
      approval.contentJson = this.requireContentJson(dto.contentJson);
    }
    if (dto.attachmentId !== undefined) {
      approval.attachmentId = this.normalizeNullableString(dto.attachmentId);
    }

    approval.updatedBy = userContext.userId;
    approval.updatedAt = new Date();
    await this.approvalRepository.save(approval);

    if (dto.steps !== undefined) {
      await this.replaceDraftSteps(userContext, approval.approvalId, dto.steps);
    }

    return this.findOne(userContext, approval.approvalId);
  }

  async remove(
    userContext: UserContext,
    approvalId: string,
  ): Promise<ApprovalResponseDto> {
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    assertDraft(approval.status);

    approval.deleteYn = 'Y';
    approval.updatedBy = userContext.userId;
    approval.updatedAt = new Date();

    return this.toResponse(
      await this.approvalRepository.save(approval),
      await this.findSteps(userContext.companyId, [approval.approvalId]),
      new Map(),
    );
  }

  async submit(
    userContext: UserContext,
    approvalId: string,
  ): Promise<ApprovalResponseDto> {
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    assertDraft(approval.status);

    const steps = await this.findSteps(userContext.companyId, [
      approval.approvalId,
    ]);
    if (!steps.some((step) => step.type === ApprovalStepType.APPROVER)) {
      throw new BadRequestException('At least one approver is required');
    }

    const now = new Date();
    for (const step of steps) {
      if (step.type === ApprovalStepType.SUBMITTER) {
        step.status = 'Y';
        step.actedAt = now;
      }
      if (step.type === ApprovalStepType.REFERENCE) {
        step.status = 'Y';
      }
    }

    approval.status = DocumentStatus.PROGRESS;
    approval.submittedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(steps);
    await this.approvalRepository.save(approval);
    await this.syncSourceStatus(approval);

    return this.findOne(userContext, approval.approvalId);
  }

  async approve(
    userContext: UserContext,
    approvalId: string,
    dto: ApprovalActionDto,
  ): Promise<ApprovalResponseDto> {
    const { approval, steps, currentStep } = await this.findActionContext(
      userContext,
      approvalId,
    );
    const now = new Date();

    currentStep.status = 'Y';
    currentStep.comment = this.normalizeNullableString(dto.comment);
    currentStep.actedAt = now;

    const nextApprover = this.findCurrentApprover(
      steps.filter((step) => step.stepNo !== currentStep.stepNo),
    );
    if (!nextApprover) {
      approval.status = DocumentStatus.CONFIRMED;
      approval.completedAt = now;
    }

    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(currentStep);
    await this.approvalRepository.save(approval);
    await this.syncSourceStatus(approval);

    return this.findOne(userContext, approval.approvalId);
  }

  async reject(
    userContext: UserContext,
    approvalId: string,
    dto: ApprovalActionDto,
  ): Promise<ApprovalResponseDto> {
    const { approval, currentStep } = await this.findActionContext(
      userContext,
      approvalId,
    );
    const now = new Date();

    currentStep.status = 'N';
    currentStep.comment = this.normalizeNullableString(dto.comment);
    currentStep.actedAt = now;

    approval.status = DocumentStatus.REJECTED;
    approval.completedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(currentStep);
    await this.approvalRepository.save(approval);
    await this.syncSourceStatus(approval);

    return this.findOne(userContext, approval.approvalId);
  }

  async cancel(
    userContext: UserContext,
    approvalId: string,
  ): Promise<ApprovalResponseDto> {
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    if (approval.status !== DocumentStatus.PROGRESS) {
      throw new ConflictException(
        'Only in-progress approvals can be cancelled',
      );
    }

    const now = new Date();
    approval.status = DocumentStatus.CANCELLED;
    approval.completedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalRepository.save(approval);
    await this.syncSourceStatus(approval);
    return this.findOne(userContext, approval.approvalId);
  }

  private async syncSourceStatus(approval: Approval): Promise<void> {
    const source = approval.refModule && SOURCE_DOCUMENTS[approval.refModule];
    if (!source || !approval.refId) {
      return;
    }
    await this.approvalRepository.manager.update(
      source.entity,
      { companyId: approval.companyId, [source.idField]: approval.refId },
      { status: approval.status },
    );
  }

  private async findActionContext(
    userContext: UserContext,
    approvalId: string,
  ) {
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    if (approval.status !== DocumentStatus.PROGRESS) {
      throw new ConflictException(
        'Only in-progress approvals can be processed',
      );
    }

    const steps = await this.findSteps(userContext.companyId, [
      approval.approvalId,
    ]);
    const currentStep = this.findCurrentApprover(steps);
    if (!currentStep || currentStep.userId !== userContext.userId) {
      throw new ForbiddenException('Approval is not pending for this user');
    }

    return { approval, steps, currentStep };
  }

  private async findVisibleApprovals(
    userContext: UserContext,
  ): Promise<Approval[]> {
    const userSteps = await this.approvalStepRepository.find({
      where: {
        companyId: userContext.companyId,
        userId: userContext.userId,
      },
    });
    const stepApprovalIds = userSteps.map((step) => step.approvalId);
    const approvalIds = [...new Set(stepApprovalIds)];
    const where = [
      {
        companyId: userContext.companyId,
        submitterId: userContext.userId,
        deleteYn: 'N',
      },
      ...(approvalIds.length > 0
        ? [
            {
              companyId: userContext.companyId,
              approvalId: In(approvalIds),
              deleteYn: 'N',
            },
          ]
        : []),
    ];

    return this.approvalRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private isInBox(
    userContext: UserContext,
    approval: Approval,
    steps: ApprovalStep[],
    box: ApprovalBox,
  ): boolean {
    if (box === 'submit') {
      return approval.submitterId === userContext.userId;
    }
    if (box === 'pending') {
      return (
        approval.status === DocumentStatus.PROGRESS &&
        this.findCurrentApprover(steps)?.userId === userContext.userId
      );
    }
    if (box === 'processed') {
      return (
        approval.status === DocumentStatus.PROGRESS &&
        steps.some(
          (step) =>
            step.type === ApprovalStepType.APPROVER &&
            step.userId === userContext.userId &&
            step.status === 'Y',
        )
      );
    }
    if (box === 'closed') {
      return (
        (approval.status === DocumentStatus.CONFIRMED ||
          approval.status === DocumentStatus.REJECTED ||
          approval.status === DocumentStatus.CANCELLED) &&
        (approval.submitterId === userContext.userId ||
          steps.some(
            (step) =>
              step.type === ApprovalStepType.APPROVER &&
              step.userId === userContext.userId,
          ))
      );
    }
    return steps.some(
      (step) =>
        step.type === ApprovalStepType.REFERENCE &&
        step.userId === userContext.userId,
    );
  }

  private canView(
    userContext: UserContext,
    approval: Approval,
    steps: ApprovalStep[],
  ): boolean {
    return (
      approval.submitterId === userContext.userId ||
      steps.some((step) => step.userId === userContext.userId)
    );
  }

  private findCurrentApprover(steps: ApprovalStep[]): ApprovalStep | undefined {
    return steps
      .filter(
        (step) =>
          step.type === ApprovalStepType.APPROVER &&
          (step.status === null || step.status.trim() === ''),
      )
      .sort((a, b) => a.stepNo - b.stepNo)[0];
  }

  private async replaceDraftSteps(
    userContext: UserContext,
    approvalId: string,
    steps: ApprovalStepInputDto[] | undefined,
  ): Promise<void> {
    const normalizedSteps = this.normalizeSteps(steps);
    await this.approvalStepRepository.delete({
      companyId: userContext.companyId,
      approvalId,
    });

    const approvalSteps = [
      this.approvalStepRepository.create({
        companyId: userContext.companyId,
        approvalId,
        stepNo: 0,
        type: ApprovalStepType.SUBMITTER,
        userId: userContext.userId,
        status: null,
      }),
      ...normalizedSteps.map((step, index) =>
        this.approvalStepRepository.create({
          companyId: userContext.companyId,
          approvalId,
          stepNo: index + 1,
          type: step.type,
          userId: step.userId,
          status: null,
        }),
      ),
    ];

    await this.approvalStepRepository.save(approvalSteps);
  }

  private normalizeSteps(steps: ApprovalStepInputDto[] | undefined): {
    type: ApprovalStepType;
    userId: string;
  }[] {
    if (!Array.isArray(steps)) {
      return [];
    }

    return steps.map((step) => {
      if (
        step.type !== ApprovalStepType.APPROVER &&
        step.type !== ApprovalStepType.REFERENCE
      ) {
        throw new BadRequestException(
          'step type must be APPROVER or REFERENCE',
        );
      }
      return {
        type: step.type,
        userId: this.requireTrimmedString(step.userId, 'step.userId'),
      };
    });
  }

  private async findApprovalOrThrow(
    companyId: string,
    approvalId: string,
  ): Promise<Approval> {
    const approval = await this.approvalRepository.findOneBy({
      companyId,
      approvalId: this.requireTrimmedString(approvalId, 'approvalId'),
      deleteYn: 'N',
    });

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    return approval;
  }

  private findSteps(
    companyId: string,
    approvalIds: string[],
  ): Promise<ApprovalStep[]> {
    if (approvalIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.approvalStepRepository.find({
      where: {
        companyId,
        approvalId: In(approvalIds),
      },
      order: {
        approvalId: 'ASC',
        stepNo: 'ASC',
      },
    });
  }

  private groupSteps(steps: ApprovalStep[]): Map<string, ApprovalStep[]> {
    const groupedSteps = new Map<string, ApprovalStep[]>();
    for (const step of steps) {
      groupedSteps.set(step.approvalId, [
        ...(groupedSteps.get(step.approvalId) ?? []),
        step,
      ]);
    }
    return groupedSteps;
  }

  private assertSubmitter(userContext: UserContext, approval: Approval): void {
    if (approval.submitterId !== userContext.userId) {
      throw new ForbiddenException(
        'Only the submitter can change this approval',
      );
    }
  }

  private assertValidBox(box: string): asserts box is ApprovalBox {
    if (
      box !== 'submit' &&
      box !== 'pending' &&
      box !== 'processed' &&
      box !== 'closed' &&
      box !== 'reference'
    ) {
      throw new BadRequestException('Invalid approval box');
    }
  }

  private requireContentJson(value: unknown): unknown {
    if (value === undefined || value === null) {
      throw new BadRequestException('contentJson is required');
    }
    return value;
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

  private toResponse(
    approval: Approval,
    steps: ApprovalStep[],
    directory: Map<string, ApprovalUserInfoDto>,
  ): ApprovalResponseDto {
    return {
      companyId: approval.companyId,
      approvalId: approval.approvalId,
      refModule: approval.refModule,
      refId: approval.refId,
      title: approval.title,
      contentJson: approval.contentJson,
      submitterId: approval.submitterId,
      status: approval.status,
      attachmentId: approval.attachmentId,
      submittedAt: approval.submittedAt,
      completedAt: approval.completedAt,
      deleteYn: approval.deleteYn,
      createdBy: approval.createdBy,
      createdAt: approval.createdAt,
      updatedBy: approval.updatedBy,
      updatedAt: approval.updatedAt,
      steps: steps.map((step) => this.toStepResponse(step, directory)),
    };
  }

  private toStepResponse(
    step: ApprovalStep,
    directory: Map<string, ApprovalUserInfoDto>,
  ): ApprovalStepResponseDto {
    const info = directory.get(step.userId);
    return {
      userName: info?.userName ?? null,
      deptId: info?.deptId ?? null,
      deptName: info?.deptName ?? null,
      title: info?.title ?? null,
      position: info?.position ?? null,
      companyId: step.companyId,
      approvalId: step.approvalId,
      stepNo: step.stepNo,
      type: step.type,
      userId: step.userId,
      status: step.status,
      comment: step.comment,
      actedAt: step.actedAt,
    };
  }
}
