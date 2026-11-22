import { NUMERIC_PRECISION } from '../common/constants/numeric';
import { APPROVAL_STEP_LABELS } from '../approvals/approval.constant';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MODULE_LIST } from '../common/constants/modules';
import { CODE_GROUPS } from '../common/constants/code';
import { DOCUMENT_STATUS_LABELS } from '../common/constants/document-status';
import { PERMISSION_ACTION_LABELS } from '../common/constants/permissions';
import {
  INVENTORY_VARIANTS,
  INVENTORY_STATUS_LABELS,
} from '../inventory/inventory.constant';
import { ACCESS_SCOPE_OPTIONS } from '../identity/users/user.constant';

/** 고정 시스템 정의만 제공한다. 회사별 데이터·사용자 권한은 포함하지 않는다. */
@UseGuards(JwtAuthGuard)
@Controller('system')
export class MetadataController {
  @Get('metadata')
  metadata() {
    return {
      modules: MODULE_LIST,
      numericPrecision: NUMERIC_PRECISION,
      approvalStepTypes: Object.entries(APPROVAL_STEP_LABELS).map(
        ([value, label]) => ({ value, label }),
      ),
      documentStatuses: Object.entries(DOCUMENT_STATUS_LABELS).map(
        ([value, label]) => ({ value, label }),
      ),
      codeGroups: Object.entries(CODE_GROUPS).map(([codeId, definition]) => ({
        codeId,
        ...definition,
      })),
      inventoryVariants: INVENTORY_VARIANTS,
      inventoryStatuses: Object.entries(INVENTORY_STATUS_LABELS).map(
        ([value, label]) => ({ value, label }),
      ),
      accessScopes: ACCESS_SCOPE_OPTIONS,
      permissionActions: Object.entries(PERMISSION_ACTION_LABELS).map(
        ([value, label]) => ({ value, label }),
      ),
    };
  }
}
