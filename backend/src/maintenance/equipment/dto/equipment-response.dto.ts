export interface EquipmentResponseDto {
  companyId: string;
  siteId: string;
  equipmentId: string;
  name: string;
  typeCode: string;
  location: string | null;
  maker: string | null;
  model: string | null;
  spec: string | null;
  serialNo: string | null;
  installDate: string | null;
  deptId: string;
  period: number | null;
  unit: string | null;
  legalInspectionPeriod: number | null;
  legalInspectionUnit: string | null;
  attachmentId: string | null;
  note: string | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
