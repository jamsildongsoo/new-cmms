import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { Company } from './entities/company.entity';
import { UserContext } from '../../auth/types/user-context.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('Company information updates', () => {
  it('updates business/contact information without changing the tenant code', async () => {
    const company = {
      companyId: 'CR',
      name: 'Company',
      deleteYn: 'N',
    } as Company;
    const repository = {
      findOneBy: jest.fn(async () => company),
      save: jest.fn(async (value: Company) => value),
    };
    const service = new CompaniesService(
      repository as unknown as Repository<Company>,
    );
    const saved = await service.updateMine(
      { companyId: 'CR', userId: 'admin' } as UserContext,
      {
        registrationNumber: ' 123-45 ',
        contactName: ' 담당자 ',
        phoneNumber: ' 02-1234 ',
      },
    );
    expect(saved).toMatchObject({
      companyId: 'CR',
      registrationNumber: '123-45',
      contactName: '담당자',
      phoneNumber: '02-1234',
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({
      companyId: 'CR',
      deleteYn: 'N',
    });
  });

  it('exposes authenticated read/update endpoints without company creation or deletion', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CompaniesController)).toContain(
      JwtAuthGuard,
    );
    const methods = Object.getOwnPropertyNames(CompaniesController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) =>
        Reflect.getMetadata(
          METHOD_METADATA,
          Object.getOwnPropertyDescriptor(CompaniesController.prototype, name)!
            .value,
        ),
      );
    expect(methods.sort((a, b) => a - b)).toEqual(
      [RequestMethod.GET, RequestMethod.PATCH].sort((a, b) => a - b),
    );
  });
});
