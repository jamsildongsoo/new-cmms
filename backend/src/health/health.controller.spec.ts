import { DataSource } from 'typeorm';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

it('reports readiness only after a successful DB round trip', async () => {
  const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
  const controller = new HealthController({ query } as unknown as DataSource);
  await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  expect(query).toHaveBeenCalledWith('SELECT 1');
});

it('returns 503 without exposing DB error details', async () => {
  const query = jest
    .fn()
    .mockRejectedValue(new Error('private database detail'));
  const controller = new HealthController({ query } as unknown as DataSource);
  await expect(controller.check()).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
  await expect(controller.check()).rejects.not.toThrow(
    'private database detail',
  );
});
