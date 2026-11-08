export interface WarehouseResponseDto {
  companyId: string;
  warehouseId: string;
  siteId: string;
  name: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
