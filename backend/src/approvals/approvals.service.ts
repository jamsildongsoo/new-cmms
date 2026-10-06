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
import { UserContext } from '../auth/types/user-context.type';
import { DocumentStatus } from '../common/constants/document-status';
import { assertDraft } from '../common/utils/document-status.util';
import { ApprovalActionDto } from './dto/approval-action.dto';
import {
  ApprovalResponseDto,
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

type ApprovalBox = 'submit' | 'pending' | 'processed' | 'closed' | 'reference';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepository: Repository<Approval>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
  ) {}

  async create(
    userContext: UserContext,
    dto: CreateApprovalDto,
  ): Promise<ApprovalResponseDto> {
    const approval = this.approvalRepository.create({
      companyId: userContext.companyId,
      approvalId: randomUUID(),
      refModule: this.normalizeNullableString(dto.refModule),
      refNo: this.normalizeNullableString(dto.refNo),
      title: this.requireTrimmedString(dto.title, 'title'),
      contentJson: this.requireContentJson(dto.contentJson),
      submitterId: userContext.userId,
      status: DocumentStatus.DRAFT,
      attachmentId: this.normalizeNullableString(dto.attachmentId),
      note: this.normalizeNullableString(dto.note),
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

    return filteredApprovals.map((approval) =>
      this.toResponse(
        approval,
        stepsByApprovalId.get(approval.approvalId) ?? [],
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

    return this.toResponse(approval, steps);
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
    if (dto.refNo !== undefined) {
      approval.refNo = this.normalizeNullableString(dto.refNo);
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
    if (dto.note !== undefined) {
      approval.note = this.normalizeNullableString(dto.note);
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
      step.updatedBy = userContext.userId;
      step.updatedAt = now;
    }

    approval.status = DocumentStatus.PROGRESS;
    approval.submittedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(steps);
    await this.approvalRepository.save(approval);

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
    currentStep.updatedBy = userContext.userId;
    currentStep.updatedAt = now;

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
    currentStep.updatedBy = userContext.userId;
    currentStep.updatedAt = now;

    approval.status = DocumentStatus.REJECTED;
    approval.completedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(currentStep);
    await this.approvalRepository.save(approval);

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
    return this.findOne(userContext, approval.approvalId);
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
        createdBy: userContext.userId,
      }),
      ...normalizedSteps.map((step, index) =>
        this.approvalStepRepository.create({
          companyId: userContext.companyId,
          approvalId,
          stepNo: index + 1,
          type: step.type,
          userId: step.userId,
          status: null,
          createdBy: userContext.userId,
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
  ): ApprovalResponseDto {
    return {
      companyId: approval.companyId,
      approvalId: approval.approvalId,
      refModule: approval.refModule,
      refNo: approval.refNo,
      title: approval.title,
      contentJson: approval.contentJson,
      submitterId: approval.submitterId,
      status: approval.status,
      attachmentId: approval.attachmentId,
      submittedAt: approval.submittedAt,
      completedAt: approval.completedAt,
      note: approval.note,
      deleteYn: approval.deleteYn,
      createdBy: approval.createdBy,
      createdAt: approval.createdAt,
      updatedBy: approval.updatedBy,
      updatedAt: approval.updatedAt,
      steps: steps.map((step) => this.toStepResponse(step)),
    };
  }

  private toStepResponse(step: ApprovalStep): ApprovalStepResponseDto {
    return {
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
