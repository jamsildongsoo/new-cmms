import { ApprovalQueryDto } from './dto/approval-query.dto';
import { normalizePaginationQuery } from '../common/utils/pagination.util';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { ApprovalStepResult, ApprovalStepType } from './approval.constant';

/** 결재 참여자·현재 순번·owner+D를 검사한다. 결재 결과 저장과 원본 상태 동기화는 순차 처리한다. */
import { PurchaseOrderService } from '../purchase/purchase-order/purchase-order.service';
import { PurchaseRequestService } from '../purchase/purchase-request/purchase-request.service';
import { WorkPermitService } from '../maintenance/work-permit/work-permit.service';
import { WorkRequestService } from '../maintenance/work-request/work-request.service';
import { WorkOrderService } from '../maintenance/work-order/work-order.service';
import { PreventiveMaintenanceService } from '../maintenance/preventive-maintenance/preventive-maintenance.service';
import { ModuleCode } from '../common/constants/modules';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { User } from '../identity/users/entities/user.entity';
import { Department } from '../organization/departments/entities/department.entity';
import { UserContext } from '../auth/types/user-context.type';
import { DocumentStatus } from '../common/constants/document-status';
import { assertDraft } from '../common/utils/document-status.util';
import { ApprovalActionDto } from './dto/approval-action.dto';
import {
  ApprovalResponseDto,
  ApprovalListItemDto,
  ApprovalUserInfoDto,
  ApprovalStepResponseDto,
} from './dto/approval-response.dto';
import { ApprovalStepInputDto } from './dto/approval-step-input.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { ApprovalStep } from './entities/approval-step.entity';
import { Approval } from './entities/approval.entity';
import { SOURCE_DOCUMENTS } from './source-documents';

type ApprovalBox = 'submit' | 'pending' | 'processed' | 'closed' | 'reference';

@Injectable()
export class ApprovalsService {
  private inTransaction = false;
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

  private inScope<T extends { withManager(manager: EntityManager): T }>(
    service: T,
    manager = this.inTransaction ? this.approvalRepository.manager : undefined,
  ): T {
    return manager ? service.withManager(manager) : service;
  }

  /** 회사+결재문서 잠금 안에서 결재와 단계를 먼저 저장한다. 원문 동기화는 커밋 후 별도로 실행한다. */
  private async mutate(
    user: UserContext,
    id: string,
    operation: (service: ApprovalsService) => Promise<ApprovalResponseDto>,
    synchronize: boolean,
  ) {
    const lockId = this.requireTrimmedString(id, '문서번호');
    const lock = async (manager: EntityManager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`approval:${user.companyId}:${lockId}`],
      );
    };
    const result = await this.approvalRepository.manager.transaction(
      async (manager) => {
        await lock(manager);
        const service = new ApprovalsService(
          manager.getRepository(Approval),
          manager.getRepository(ApprovalStep),
          manager.getRepository(User),
          manager.getRepository(Department),
          this.preventiveMaintenanceService,
          this.workOrderService,
          this.workRequestService,
          this.workPermitService,
          this.purchaseRequests,
          this.purchaseOrders,
        );
        service.inTransaction = true;
        return operation(service);
      },
    );
    if (synchronize && result.refModule && result.refId) {
      // 원본 동기화 실패 시 결재 결과는 유지한다. 별도 잠금 안에서 최신 결과를 읽어
      // 동시 요청의 늦은 P 동기화가 이미 완료된 C 상태를 덮어쓰지 않게 한다.
      const runner =
        this.approvalRepository.manager.connection.createQueryRunner();
      const key = `approval:${user.companyId}:${lockId}`;
      let locked = false;
      let syncing = false;
      let warning: string | undefined;
      try {
        await runner.connect();
        await runner.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
          key,
        ]);
        locked = true;
        const latest = await runner.manager.findOneBy(Approval, {
          companyId: user.companyId,
          approvalId: result.approvalId,
          deleteYn: 'N',
        });
        if (latest) {
          syncing = true;
          await this.syncSourceStatus(latest, runner.manager);
        }
      } catch (error) {
        warning =
          '결재 처리는 완료되었으나 원문 상태 반영에 실패했습니다. 관리자에게 문의해 주세요.';
        if (!syncing)
          this.logger.error({
            message:
              'Source status update failed; saved approval result is retained',
            companyId: user.companyId,
            approvalId: result.approvalId,
            refModule: result.refModule,
            refId: result.refId,
            status: result.status,
            stage: 'syncSourceStatus',
            error: error instanceof Error ? error.message : String(error),
          });
      } finally {
        try {
          if (locked)
            await runner.query(
              'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
              [key],
            );
        } catch (error) {
          this.logger.error({
            message: 'Approval synchronization lock cleanup failed',
            companyId: user.companyId,
            approvalId: result.approvalId,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          try {
            await runner.release();
          } catch (error) {
            this.logger.error(error);
          }
        }
      }
      if (warning) return { ...result, sourceSyncWarning: warning };
    }
    return synchronize ? this.findOne(user, result.approvalId) : result;
  }

  private async validateParticipants(
    user: UserContext,
    steps: readonly { type: ApprovalStepType; userId: string }[],
  ) {
    const ids = steps.map((step) => step.userId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        '같은 사용자를 결재선에 중복 지정할 수 없습니다.',
      );
    if (ids.includes(user.userId))
      throw new BadRequestException(
        '상신자 본인은 결재선에 추가할 수 없습니다.',
      );
    if (ids.some((id) => !id.trim() || id.length > 50))
      throw new BadRequestException('결재선 사용자 ID를 확인해 주세요.');
    if (!ids.length) return;
    const active = await this.userRepository.findBy({
      companyId: user.companyId,
      userId: In(ids),
      deleteYn: 'N',
    });
    if (active.length !== ids.length)
      throw new BadRequestException(
        '결재선에는 같은 회사의 활성 사용자만 지정할 수 있습니다.',
      );
  }

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
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
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
      deleteYn: 'N',
    });
    const deptIds = [...new Set(users.map((user) => user.deptId))];
    const departments = deptIds.length
      ? await this.departmentRepository.findBy({
          companyId,
          deptId: In(deptIds),
          deleteYn: 'N',
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
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        dto.approvalId ?? '',
        (service) => service.create(userContext, dto),
        dto.submit === true,
      );
    if (dto.refModule === ModuleCode.PERMIT && dto.refId) {
      const source = await this.inScope(this.workPermitService).approvalDraft(
        userContext,
        dto.refId,
      );
      dto = Object.assign({}, dto, source, { steps: dto.steps });
    }
    const approvalId = this.requireTrimmedString(
      dto.approvalId ?? '',
      '서버 채번 문서 ID',
    );
    const existingApproval = await this.approvalRepository.findOneBy({
      companyId: userContext.companyId,
      approvalId,
    });
    if (existingApproval) {
      throw new ConflictException('이미 존재하는 결재 문서입니다.');
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

  async findBox(
    userContext: UserContext,
    box: ApprovalBox,
    filter: ApprovalQueryDto = {},
  ): Promise<PaginatedResponseDto<ApprovalListItemDto>> {
    this.assertValidBox(box);
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const query = this.approvalRepository
      .createQueryBuilder('a')
      .select([
        'a.approvalId',
        'a.documentNo',
        'a.title',
        'a.submitterId',
        'a.status',
        'a.createdAt',
      ])
      .where('a.companyId = :companyId', { companyId: userContext.companyId })
      .andWhere("a.deleteYn = 'N'")
      .setParameters({
        userId: userContext.userId,
        processing: [ApprovalStepType.APPROVER, ApprovalStepType.AGREE],
        progress: DocumentStatus.PROGRESS,
        approved: ApprovalStepResult.APPROVED,
      });
    const stepExists = (alias: string, condition: string) =>
      `EXISTS (SELECT 1 FROM approval_step ${alias} WHERE ${alias}."companyId" = a."companyId" AND ${alias}."approvalId" = a."approvalId" AND ${condition})`;
    if (box === 'submit') query.andWhere('a.submitterId = :userId');
    if (box === 'pending')
      query
        .andWhere('a.status = :progress')
        .andWhere(
          stepExists(
            'pending_step',
            `pending_step."userId" = :userId AND pending_step.type IN (:...processing) AND (pending_step.status IS NULL OR BTRIM(pending_step.status) = '') AND NOT EXISTS (SELECT 1 FROM approval_step earlier WHERE earlier."companyId" = pending_step."companyId" AND earlier."approvalId" = pending_step."approvalId" AND earlier.type IN (:...processing) AND (earlier.status IS NULL OR BTRIM(earlier.status) = '') AND earlier."stepNo" < pending_step."stepNo")`,
          ),
        );
    if (box === 'processed')
      query
        .andWhere('a.status = :progress')
        .andWhere(
          stepExists(
            'processed_step',
            'processed_step."userId" = :userId AND processed_step.type IN (:...processing) AND processed_step.status = :approved',
          ),
        );
    if (box === 'closed')
      query
        .andWhere('a.status IN (:...closed)', {
          closed: [
            DocumentStatus.CONFIRMED,
            DocumentStatus.REJECTED,
            DocumentStatus.CANCELLED,
          ],
        })
        .andWhere(
          `(a."submitterId" = :userId OR ${stepExists('closed_step', 'closed_step."userId" = :userId AND closed_step.type IN (:...processing)')})`,
        );
    if (box === 'reference')
      query
        .andWhere('a.status = :confirmed', {
          confirmed: DocumentStatus.CONFIRMED,
        })
        .andWhere(
          stepExists(
            'reference_step',
            'reference_step."userId" = :userId AND reference_step.type = :reference',
          ),
        )
        .setParameter('reference', ApprovalStepType.REFERENCE);
    if (filter.status)
      query.andWhere('a.status = :status', { status: filter.status });
    if (filter.search?.trim()) {
      const search = `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      query.andWhere(
        '(a.approvalId ILIKE :search OR a.documentNo ILIKE :search OR a.title ILIKE :search OR a.submitterId ILIKE :search)',
        { search },
      );
    }
    const [items, total] = await query
      .orderBy('a.createdAt', 'DESC')
      .addOrderBy('a.approvalId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return {
      items: items.map(
        ({
          approvalId,
          documentNo,
          title,
          submitterId,
          status,
          createdAt,
        }) => ({
          approvalId,
          documentNo,
          title,
          submitterId,
          status,
          createdAt,
        }),
      ),
      total,
      page,
      limit,
    };
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
      throw new ForbiddenException('이 문서를 조회할 권한이 없습니다.');
    }

    const response = this.toResponse(
      approval,
      steps,
      await this.loadDirectory(
        userContext.companyId,
        steps.map((step) => step.userId),
      ),
    );
    if (approval.refModule === ModuleCode.PERMIT && approval.refId)
      response.sourceAttachmentIds = await this.inScope(
        this.workPermitService,
      ).relatedAttachmentIds(approval.companyId, approval.refId);
    return response;
  }

  async update(
    userContext: UserContext,
    approvalId: string,
    dto: UpdateApprovalDto,
  ): Promise<ApprovalResponseDto> {
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        approvalId,
        (service) => service.update(userContext, approvalId, dto),
        false,
      );
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    assertDraft(approval.status);

    if (approval.refModule === ModuleCode.PERMIT) {
      if (
        (dto.refModule !== undefined && dto.refModule !== approval.refModule) ||
        (dto.refId !== undefined && dto.refId !== approval.refId)
      )
        throw new BadRequestException(
          '작업허가 원본 참조는 변경할 수 없습니다.',
        );
      const source = await this.inScope(this.workPermitService).approvalDraft(
        userContext,
        approval.refId!,
      );
      dto = Object.assign({}, dto, source, { steps: dto.steps });
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
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        approvalId,
        (service) => service.remove(userContext, approvalId),
        false,
      );
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

  /** 초안 작성자·결재 참여자·연계 원문을 다시 확인한 뒤 상신한다. 화면에서 받은 원문 정보만 신뢰하지 않는다. */
  async submit(
    userContext: UserContext,
    approvalId: string,
  ): Promise<ApprovalResponseDto> {
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        approvalId,
        (service) => service.submit(userContext, approvalId),
        true,
      );
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    assertDraft(approval.status);

    const steps = await this.findSteps(userContext.companyId, [
      approval.approvalId,
    ]);
    await this.validateParticipants(
      userContext,
      steps.filter((step) => step.type !== ApprovalStepType.SUBMITTER),
    );
    if (!steps.some((step) => this.isProcessingStep(step))) {
      throw new BadRequestException(
        '결재자 또는 합의자를 한 명 이상 지정해 주세요.',
      );
    }

    if (approval.refModule === ModuleCode.PMAINT && approval.refId) {
      await this.inScope(this.preventiveMaintenanceService).assertCanSubmit(
        userContext,
        approval.refId,
      );
    }

    if (approval.refModule === ModuleCode.WRKORD && approval.refId) {
      await this.inScope(this.workOrderService).assertCanSubmit(
        userContext,
        approval.refId,
      );
    }

    if (approval.refModule === ModuleCode.WRKREQ && approval.refId) {
      await this.inScope(this.workRequestService).assertCanSubmit(
        userContext,
        approval.refId,
      );
    }

    if (
      approval.refId &&
      (approval.refModule === ModuleCode.PURREQ ||
        approval.refModule === ModuleCode.PURORD)
    )
      await (
        approval.refModule === ModuleCode.PURREQ
          ? this.inScope(this.purchaseRequests)
          : this.inScope(this.purchaseOrders)
      ).assertCanSubmit(userContext, approval.refId);

    if (approval.refModule === ModuleCode.PERMIT && approval.refId) {
      const locked = await this.inScope(this.workPermitService).approvalDraft(
        userContext,
        approval.refId,
      );
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
        step.status = ApprovalStepResult.APPROVED;
        step.actedAt = now;
      }
      if (step.type === ApprovalStepType.REFERENCE) {
        step.status = ApprovalStepResult.APPROVED;
      }
    }

    approval.status = DocumentStatus.PROGRESS;
    approval.submittedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(steps);
    await this.approvalRepository.save(approval);
    if (!this.inTransaction) await this.syncSourceStatus(approval);

    return this.findOne(userContext, approval.approvalId);
  }

  async approve(
    userContext: UserContext,
    approvalId: string,
    dto: ApprovalActionDto,
  ): Promise<ApprovalResponseDto> {
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        approvalId,
        (service) => service.approve(userContext, approvalId, dto),
        true,
      );
    const { approval, steps, currentStep } = await this.findActionContext(
      userContext,
      approvalId,
    );
    const now = new Date();

    currentStep.status = ApprovalStepResult.APPROVED;
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
    if (!this.inTransaction) await this.syncSourceStatus(approval);

    return this.findOne(userContext, approval.approvalId);
  }

  async reject(
    userContext: UserContext,
    approvalId: string,
    dto: ApprovalActionDto,
  ): Promise<ApprovalResponseDto> {
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        approvalId,
        (service) => service.reject(userContext, approvalId, dto),
        true,
      );
    const { approval, currentStep } = await this.findActionContext(
      userContext,
      approvalId,
    );
    const now = new Date();

    currentStep.status = ApprovalStepResult.REJECTED;
    currentStep.comment = this.normalizeNullableString(dto.comment);
    currentStep.actedAt = now;

    approval.status = DocumentStatus.REJECTED;
    approval.completedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalStepRepository.save(currentStep);
    await this.approvalRepository.save(approval);
    if (!this.inTransaction) await this.syncSourceStatus(approval);

    return this.findOne(userContext, approval.approvalId);
  }

  async cancel(
    userContext: UserContext,
    approvalId: string,
  ): Promise<ApprovalResponseDto> {
    if (!this.inTransaction)
      return this.mutate(
        userContext,
        approvalId,
        (service) => service.cancel(userContext, approvalId),
        true,
      );
    const approval = await this.findApprovalOrThrow(
      userContext.companyId,
      approvalId,
    );
    this.assertSubmitter(userContext, approval);
    if (approval.status !== DocumentStatus.PROGRESS) {
      throw new ConflictException('결재 중인 문서만 상신 취소할 수 있습니다.');
    }

    const now = new Date();
    approval.status = DocumentStatus.CANCELLED;
    approval.completedAt = now;
    approval.updatedBy = userContext.userId;
    approval.updatedAt = now;

    await this.approvalRepository.save(approval);
    if (!this.inTransaction) await this.syncSourceStatus(approval);
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
        '원문 모듈과 문서번호를 함께 지정해 주세요.',
      );
    if (!refModule) return ownAttachmentId;
    if (!Object.hasOwn(SOURCE_DOCUMENTS, refModule)) {
      throw new BadRequestException('지원하지 않는 원문 모듈입니다.');
    }
    const source = SOURCE_DOCUMENTS[refModule];
    const document = (await this.approvalRepository.manager.findOneBy(
      source.entity,
      { companyId, [source.idField]: refId!, deleteYn: 'N' },
    )) as { attachmentId: string | null } | null;
    if (!document) throw new NotFoundException('원문 문서를 찾을 수 없습니다.');
    return document.attachmentId ?? null;
  }

  private async syncSourceStatus(
    approval: Approval,
    manager?: EntityManager,
  ): Promise<void> {
    const source =
      approval.refModule &&
      Object.hasOwn(SOURCE_DOCUMENTS, approval.refModule) &&
      SOURCE_DOCUMENTS[approval.refModule];
    if (!source || !approval.refId) {
      return;
    }
    // 결재 결과는 이미 저장됐다. 후속 모듈 실패를 기록하되 결재를 롤백하지 않는다.
    try {
      if (approval.refModule === ModuleCode.PMAINT) {
        await this.inScope(
          this.preventiveMaintenanceService,
          manager,
        ).syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
      if (approval.refModule === ModuleCode.WRKORD) {
        await this.inScope(this.workOrderService, manager).syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
      if (approval.refModule === ModuleCode.WRKREQ) {
        await this.inScope(this.workRequestService, manager).syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
        );
        return;
      }
      if (approval.refModule === ModuleCode.PERMIT) {
        await this.inScope(this.workPermitService, manager).syncApprovalStatus(
          approval.companyId,
          approval.refId,
          approval.status,
          approval.updatedBy ?? approval.submitterId,
          approval.approvalId,
        );
        return;
      }
      if (
        approval.refModule === ModuleCode.PURREQ ||
        approval.refModule === ModuleCode.PURORD
      ) {
        await (
          approval.refModule === ModuleCode.PURREQ
            ? this.inScope(this.purchaseRequests, manager)
            : this.inScope(this.purchaseOrders, manager)
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
      throw new ConflictException('결재 중인 문서만 처리할 수 있습니다.');
    }

    const steps = await this.findSteps(userContext.companyId, [
      approval.approvalId,
    ]);
    const currentStep = this.findCurrentApprover(steps);
    if (!currentStep || currentStep.userId !== userContext.userId) {
      throw new ForbiddenException('현재 결재 차례가 아닙니다.');
    }

    return { approval, steps, currentStep };
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
    await this.validateParticipants(userContext, normalizedSteps);
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

    const normalized = steps.map((step) => {
      if (
        step.type !== ApprovalStepType.APPROVER &&
        step.type !== ApprovalStepType.AGREE &&
        step.type !== ApprovalStepType.REFERENCE
      ) {
        throw new BadRequestException(
          '결재선 유형은 결재·합의·참조 중에서 선택해 주세요.',
        );
      }
      return {
        type: step.type,
        userId: this.requireTrimmedString(step.userId, '결재선 사용자 ID'),
      };
    });
    return [
      ...normalized.filter((step) => step.type !== ApprovalStepType.REFERENCE),
      ...normalized.filter((step) => step.type === ApprovalStepType.REFERENCE),
    ];
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
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
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

  private assertSubmitter(userContext: UserContext, approval: Approval): void {
    if (approval.submitterId !== userContext.userId) {
      throw new ForbiddenException('상신자만 결재 문서를 변경할 수 있습니다.');
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
      throw new BadRequestException('올바른 결재 문서함을 선택해 주세요.');
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
      throw new BadRequestException('본문 문서 형식을 확인해 주세요.');
    }
    return value;
  }

  private requireTrimmedString(
    value: string | undefined,
    fieldName: string,
  ): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(
        `${fieldName === 'title' ? '제목' : fieldName} 항목을 입력해 주세요.`,
      );
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
