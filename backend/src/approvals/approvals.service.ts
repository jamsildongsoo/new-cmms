/** 결재 참여자·현재 순번·owner+D를 검사한다. 결재 결과 저장과 원본 상태 동기화는 순차 처리한다. */
import { PurchaseOrderService } from '../purchase/purchase-order/purchase-order.service';
import { PurchaseRequestService } from '../purchase/purchase-request/purchase-request.service';
import { WorkPermitService } from '../maintenance/work-permit/work-permit.service';
import { WorkRequestService } from '../maintenance/work-request/work-request.service';
import { WorkOrderService } from '../maintenance/work-order/work-order.service';
import { PreventiveMaintenanceService } from '../maintenance/preventive-maintenance/preventive-maintenance.service';
import { AppModuleKey } from '../common/constants/modules';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  private readonly logger = new Logger(ApprovalsService.name);
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepository: Repository<Approval>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly preventiveMaintenanceService: PreventiveMaintenanceService,
    private readonly workOrderService: WorkOrderService,
    private readonly workRequestService: WorkRequestService,
    private readonly workPermitService: WorkPermitService,
    private readonly purchaseRequests: PurchaseRequestService,
    private readonly purchaseOrders: PurchaseOrderService,
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
    if (dto.refModule === 'work_permit' && dto.refId)
      dto = Object.assign(
        {},
        dto,
        await this.workPermitService.approvalDraft(userContext, dto.refId),
      );
    const approvalId = this.requireTrimmedString(
      dto.approvalId ?? '',
      '서버 채번 문서 ID',
    );
    const existingApproval = await this.approvalRepository.findOneBy({
      companyId: userContext.companyId,
      approvalId,
    });
    if (existingApproval) {
      throw new ConflictException('Approval already exists');
    }

    const refModule = this.normalizeNullableString(dto.refModule);
    const refId = this.normalizeNullableString(dto.refId);
    const attachmentId = await this.resolveAttachmentId(
      userContext.companyId,
      refModule,
      refId,
      this.normalizeNullableString(dto.attachmentId),
    );
    const approval = this.approvalRepository.create({
      companyId: userContext.companyId,
      approvalId,
      documentNo: this.normalizeNullableString(dto.documentNo) ?? '',
      refModule,
      refId,
      title: this.requireTrimmedString(dto.title, 'title'),
      contentJson: this.requireContentJson(dto.contentJson),
      submitterId: userContext.userId,
      status: DocumentStatus.DRAFT,
      attachmentId,
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

  // 결재 헤더 저장 후 결재선/상신이 실패한 생성 요청만 재개한다.
  async resumeCreate(user: UserContext, id: string, dto: CreateApprovalDto) {
    const existing = await this.findOne(user, id);
    if (existing.status !== DocumentStatus.DRAFT) return existing;
    const saved = await this.update(user, id, dto);
    return dto.submit === true ? this.submit(user, id) : saved;
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

    const response = this.toResponse(
      approval,
      steps,
      await this.loadDirectory(
        userContext.companyId,
        steps.map((step) => step.userId),
      ),
    );
    if (approval.refModule === 'work_permit' && approval.refId)
      response.sourceAttachmentIds =
        await this.workPermitService.relatedAttachmentIds(
          approval.companyId,
          approval.refId,
        );
    return response;
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

    if (approval.refModule === 'work_permit') {
      if (
        (dto.refModule !== undefined && dto.refModule !== approval.refModule) ||
        (dto.refId !== undefined && dto.refId !== approval.refId)
      )
        throw new BadRequestException(
          '작업허가 원본 참조는 변경할 수 없습니다.',
        );
      dto = Object.assign(
        {},
        dto,
        await this.workPermitService.approvalDraft(
          userContext,
          approval.refId!,
        ),
      );
    }
    const refModule =
      dto.refModule === undefined
        ? approval.refModule
        : this.normalizeNullableString(dto.refModule);
    const refId =
      dto.refId === undefined
        ? approval.refId
        : this.normalizeNullableString(dto.refId);
    const attachmentId = await this.resolveAttachmentId(
      userContext.companyId,
      refModule,
      refId,
      dto.attachmentId === undefined
        ? approval.attachmentId
        : this.normalizeNullableString(dto.attachmentId),
    );

    if (dto.documentNo !== undefined) {
      approval.documentNo = this.normalizeNullableString(dto.documentNo) ?? '';
    }
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
    approval.attachmentId = attachmentId;

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
    if (!steps.some((step) => this.isProcessingStep(step))) {
      throw new BadRequestException(
        'At least one approver or agreement step is required',
      );
    }

    if (
      approval.refModule === AppModuleKey.PREVENTIVE_MAINTENANCE &&
      approval.refId
    ) {
      await this.preventiveMaintenanceService.assertCanSubmit(
        userContext,
        approval.refId,
      );
    }

    if (approval.refModule === AppModuleKey.WORK_ORDER && approval.refId) {
      await this.workOrderService.assertCanSubmit(userContext, approval.refId);
    }

    if (approval.refModule === AppModuleKey.WORK_REQUEST && approval.refId) {
      await this.workRequestService.assertCanSubmit(
        userContext,
        approval.refId,
      );
    }

    if (
      approval.refId &&
      (approval.refModule === 'purchase_request' ||
        approval.refModule === 'purchase_order')
    )
      await (
        approval.refModule === 'purchase_request'
          ? this.purchaseRequests
          : this.purchaseOrders
      ).assertCanSubmit(userContext, approval.refId);

    if (approval.refModule === 'work_permit' && approval.refId) {
      const locked = await this.workPermitService.approvalDraft(
        userContext,
        approval.refId,
      );
      const processing = steps
        .filter((s) => this.isProcessingStep(s))
        .sort((a, b) => a.stepNo - b.stepNo);
      if (
        processing.length !== 2 ||
        processing.some(
          (s, i) =>
            s.type !== 'APPROVER' || s.userId !== locked.steps[i].userId,
        )
      )
        throw new BadRequestException('발급자→승인자 결재선이 필요합니다.');
      approval.title = locked.title;
      approval.contentJson = locked.contentJson;
    }
    // 원본의 최신 그룹을 실제 상신 시 다시 연결한다. 클라이언트의 첨부 ID는 신뢰하지 않는다.
    approval.attachmentId = await this.resolveAttachmentId(
      approval.companyId,
      approval.refModule,
      approval.refId,
      approval.attachmentId,
    );

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

  private async resolveAttachmentId(
    companyId: string,
    refModule: string | null,
    refId: string | null,
    ownAttachmentId: string | null,
  ): Promise<string | null> {
    if (Boolean(refModule) !== Boolean(refId))
      throw new BadRequestException(
        'refModule and refId must be provided together',
      );
    if (!refModule) return ownAttachmentId;
    if (!Object.hasOwn(SOURCE_DOCUMENTS, refModule)) {
      throw new BadRequestException('Unsupported approval source module');
    }
    const source = SOURCE_DOCUMENTS[refModule];
    const document = (await this.approvalRepository.manager.findOneBy(
      source.entity,
      { companyId, [source.idField]: refId!, deleteYn: 'N' },
    )) as { attachmentId: string | null } | null;
    if (!document) throw new NotFoundException('Source document not found');
    return document.attachmentId ?? null;
  }

  private async syncSourceStatus(approval: Approval): Promise<void> {
    const source =
      approval.refModule &&
      Object.hasOwn(SOURCE_DOCUMENTS, approval.refModule) &&
      SOURCE_DOCUMENTS[approval.refModule];
    if (!source || !approval.refId) {
      return;
    }
    // 결재 결과는 이미 저장됐다. 후속 모듈 실패를 기록하되 결재를 롤백하지 않는다.
    try {
      if (approval.refModule === AppModuleKey.PREVENTIVE_MAINTENANCE) {
        await this.preventiveMaintenanceService.syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
      if (approval.refModule === AppModuleKey.WORK_ORDER) {
        await this.workOrderService.syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
      if (approval.refModule === AppModuleKey.WORK_REQUEST) {
        await this.workRequestService.syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
      if (approval.refModule === 'work_permit') {
        await this.workPermitService.syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
          approval.approvalId,
        );
        return;
      }
      if (
        approval.refModule === 'purchase_request' ||
        approval.refModule === 'purchase_order'
      ) {
        await (
          approval.refModule === 'purchase_request'
            ? this.purchaseRequests
            : this.purchaseOrders
        ).syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
    } catch (error) {
      this.logger.error({
        message:
          'Source status update failed; saved approval result is retained',
        companyId: approval.companyId,
        approvalId: approval.approvalId,
        refModule: approval.refModule,
        refId: approval.refId,
        status: approval.status,
        stage: 'syncSourceStatus',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
            this.isProcessingStep(step) &&
            step.userId === userContext.userId &&
            step.status === 'Y',
        )
      );
    }
    if (box === 'closed') {
      return (
        this.isClosed(approval) &&
        (approval.submitterId === userContext.userId ||
          steps.some(
            (step) =>
              this.isProcessingStep(step) && step.userId === userContext.userId,
          ))
      );
    }
    return (
      approval.status === DocumentStatus.CONFIRMED &&
      steps.some(
        (step) =>
          step.type === ApprovalStepType.REFERENCE &&
          step.userId === userContext.userId,
      )
    );
  }

  private isClosed(approval: Approval): boolean {
    return (
      approval.status === DocumentStatus.CONFIRMED ||
      approval.status === DocumentStatus.REJECTED ||
      approval.status === DocumentStatus.CANCELLED
    );
  }

  private canView(
    userContext: UserContext,
    approval: Approval,
    steps: ApprovalStep[],
  ): boolean {
    return (
      approval.submitterId === userContext.userId ||
      // 참조함뿐 아니라 상세 URL 직접 접근도 승인 완료(C) 문서로 제한한다.
      steps.some(
        (step) =>
          step.userId === userContext.userId &&
          (step.type !== ApprovalStepType.REFERENCE ||
            approval.status === DocumentStatus.CONFIRMED),
      )
    );
  }

  // 결재와 합의는 같은 순번 체계로 처리하고 참조는 처리 차례에서 제외한다.
  private isProcessingStep(step: ApprovalStep): boolean {
    return (
      step.type === ApprovalStepType.APPROVER ||
      step.type === ApprovalStepType.AGREE
    );
  }

  private findCurrentApprover(steps: ApprovalStep[]): ApprovalStep | undefined {
    return steps
      .filter(
        (step) =>
          this.isProcessingStep(step) &&
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
        step.type !== ApprovalStepType.AGREE &&
        step.type !== ApprovalStepType.REFERENCE
      ) {
        throw new BadRequestException(
          'step type must be APPROVER, AGREE, or REFERENCE',
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
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      !('type' in value) ||
      value.type !== 'doc' ||
      ('content' in value && !Array.isArray(value.content))
    ) {
      throw new BadRequestException('contentJson must be a Tiptap document');
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
      documentNo: approval.documentNo,
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
