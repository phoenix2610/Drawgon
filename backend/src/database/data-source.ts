import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getDatabaseSsl } from '../config/database-ssl';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: getDatabaseSsl(),
  uuidExtension: 'pgcrypto',
  entities: [path.join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [
    path.join(__dirname, '../../../database/migrations', '*.{ts,js}'),
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
