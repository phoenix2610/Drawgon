import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

const { migrations: _migrations, ...runtimeOptions } = dataSourceOptions;

@Module({
  imports: [TypeOrmModule.forRoot(runtimeOptions)],
})
export class DatabaseModule {}
