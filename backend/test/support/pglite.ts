import { PGlite } from '@electric-sql/pglite';
import { EventEmitter } from 'node:events';
import { DataSource, EntityTarget } from 'typeorm';

/** PostgreSQL WASM로 실제 SQL·numeric·rollback을 검증한다. 다중 서버 세션의 잠금 경합 검증은 별도이다. */
export async function postgresTestDatabase(entities: EntityTarget<object>[]) {
  const postgres = await PGlite.create({
    parsers: { 1700: (value: string) => value, 20: (value: string) => value },
  });
  type Result = { rows: object[]; rowCount: number; command: string };
  type Callback = (error: Error | null, result?: Result) => void;
  let tail: Promise<void> = Promise.resolve();
  class Connection extends EventEmitter {
    query(sql: string, parameters?: unknown[] | Callback, callback?: Callback) {
      const cb = typeof parameters === 'function' ? parameters : callback;
      const promise = postgres
        .query(sql, Array.isArray(parameters) ? parameters : [])
        .then((r) => ({
          rows: r.rows as object[],
          rowCount: r.affectedRows ?? r.rows.length,
          command: sql.trim().split(/\s/)[0].toUpperCase(),
        }));
      if (cb) {
        void promise.then(
          (r) => cb(null, r),
          (error) => cb(error as Error),
        );
        return;
      }
      return promise;
    }
  }
  class Pool extends EventEmitter {
    connect(
      callback: (
        error: Error | null,
        connection: Connection,
        release: () => void,
      ) => void,
    ) {
      let release!: () => void;
      const previous = tail;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      void previous.then(() => callback(null, new Connection(), release));
    }
    end(callback: (error?: Error) => void) {
      callback();
    }
  }
  const dataSource = new DataSource({
    type: 'postgres',
    driver: { Pool },
    database: 'postgres',
    entities: entities as never,
    synchronize: true,
    logging: false,
  });
  try {
    await dataSource.initialize();
  } catch (error) {
    await postgres.close();
    throw error;
  }
  return {
    dataSource,
    close: async () => {
      if(dataSource.isInitialized)await dataSource.destroy();
      await postgres.close();
    },
  };
}
