export interface WarehouseResponseDto {
  companyId: string;
  warehouseId: string;
  siteId: string | null;
  name: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
