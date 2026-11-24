import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../identity/users/entities/user.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Equipment } from '../../maintenance/equipment/entities/equipment.entity';
import { Material } from '../../inventory/material/entities/material.entity';

export interface DirectoryUser {
  userId: string;
  userName: string;
  deptId: string | null;
  deptName: string | null;
  title: string | null;
  position: string | null;
}

export interface DirectoryDepartment {
  deptId: string;
  deptName: string;
}

@Injectable()
export class DirectoryService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(Equipment) private readonly equipment: Repository<Equipment>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
  ) {}

  async searchUsers(companyId: string, query: string): Promise<DirectoryUser[]> {
    const keyword = query.trim();
    if (!keyword) return [];
    const pattern = this.pattern(keyword);
    const users = await this.users
      .createQueryBuilder('u')
      .where('u.companyId = :companyId', { companyId })
      .andWhere("u.deleteYn = 'N'")
      .andWhere('(u.userId ILIKE :pattern OR u.name ILIKE :pattern)', { pattern })
      .orderBy('u.userId', 'ASC')
      .limit(10)
      .getMany();
    const deptIds = [...new Set(users.map((user) => user.deptId).filter((id): id is string => !!id))];
    const departments = deptIds.length
      ? await this.departments.findBy({ companyId, deptId: In(deptIds), deleteYn: 'N' })
      : [];
    const names = new Map(departments.map((dept) => [dept.deptId, dept.name]));
    return users.map((user) => ({
      userId: user.userId,
      userName: user.name,
      deptId: user.deptId,
      deptName: user.deptId ? (names.get(user.deptId) ?? null) : null,
      title: user.title,
      position: user.position,
    }));
  }

  async searchDepartments(companyId: string, query: string): Promise<DirectoryDepartment[]> {
    const keyword = query.trim();
    if (!keyword) return [];
    const departments = await this.departments
      .createQueryBuilder('d')
      .where('d.companyId = :companyId', { companyId })
      .andWhere("d.deleteYn = 'N'")
      .andWhere('(d.deptId ILIKE :pattern OR d.name ILIKE :pattern)', {
        pattern: this.pattern(keyword),
      })
      .orderBy('d.deptId', 'ASC')
      .limit(10)
      .getMany();
    return departments.map((dept) => ({ deptId: dept.deptId, deptName: dept.name }));
  }

  async searchEquipment(companyId: string, query: string) {
    const keyword = query.trim();
    if (!keyword) return [];
    const rows = await this.equipment.createQueryBuilder('e')
      .select(['e.equipmentId', 'e.name', 'e.siteId'])
      .where('e.companyId = :companyId', { companyId })
      .andWhere("e.deleteYn = 'N'")
      .andWhere('(e.equipmentId ILIKE :pattern OR e.name ILIKE :pattern)', { pattern: this.pattern(keyword) })
      .orderBy('e.equipmentId', 'ASC').limit(10).getMany();
    return rows.map(({ equipmentId, name, siteId }) => ({ equipmentId, name, siteId }));
  }

  async searchMaterials(companyId: string, query: string) {
    const keyword = query.trim();
    if (!keyword) return [];
    const rows = await this.materials.createQueryBuilder('m')
      .select(['m.materialId', 'm.name'])
      .where('m.companyId = :companyId', { companyId })
      .andWhere("m.deleteYn = 'N'")
      .andWhere('(m.materialId ILIKE :pattern OR m.name ILIKE :pattern)', { pattern: this.pattern(keyword) })
      .orderBy('m.materialId', 'ASC').limit(10).getMany();
    return rows.map(({ materialId, name }) => ({ materialId, name }));
  }

  private pattern(value: string) {
    return `%${value.slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`;
  }
}
