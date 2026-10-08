import { EntityTarget } from 'typeorm';
import { AppModuleKey } from '../common/constants/modules';
import { PreventiveMaintenance } from '../maintenance/preventive-maintenance/entities/preventive-maintenance.entity';
import { WorkOrder } from '../maintenance/work-order/entities/work-order.entity';
import { WorkPermit } from '../maintenance/work-permit/entities/work-permit.entity';
import { PurchaseRequest } from '../purchase/purchase-request/entities/purchase-request.entity';
import { PurchaseOrder } from '../purchase/purchase-order/entities/purchase-order.entity';

interface SourceDocument {
  entity: EntityTarget<object>;
  idField: string;
}

// Document modules whose status follows their approval (refModule -> entity).
export const SOURCE_DOCUMENTS: Record<string, SourceDocument> = {
  [AppModuleKey.PREVENTIVE_MAINTENANCE]: {
    entity: PreventiveMaintenance,
    idField: 'pmId',
  },
  [AppModuleKey.WORK_ORDER]: {
    entity: WorkOrder,
    idField: 'workOrderId',
  },
  [AppModuleKey.WORK_PERMIT]: {
    entity: WorkPermit,
    idField: 'workPermitId',
  },
  [AppModuleKey.PURCHASE_REQUEST]: {
    entity: PurchaseRequest,
    idField: 'requestId',
  },
  [AppModuleKey.PURCHASE_ORDER]: {
    entity: PurchaseOrder,
    idField: 'orderId',
  },
};
