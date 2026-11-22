import { WorkRequest } from '../maintenance/work-request/entities/work-request.entity';
import { EntityTarget } from 'typeorm';
import { ModuleCode } from '../common/constants/modules';
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
  [ModuleCode.WRKREQ]: {
    entity: WorkRequest,
    idField: 'workRequestId',
  },
  [ModuleCode.PMAINT]: {
    entity: PreventiveMaintenance,
    idField: 'pmId',
  },
  [ModuleCode.WRKORD]: {
    entity: WorkOrder,
    idField: 'workOrderId',
  },
  [ModuleCode.PERMIT]: {
    entity: WorkPermit,
    idField: 'workPermitId',
  },
  [ModuleCode.PURREQ]: {
    entity: PurchaseRequest,
    idField: 'requestId',
  },
  [ModuleCode.PURORD]: {
    entity: PurchaseOrder,
    idField: 'orderId',
  },
};
