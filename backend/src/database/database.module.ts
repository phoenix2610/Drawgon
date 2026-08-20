import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

// The running app never executes migrations itself (that's a separate CLI
// step, see package.json's `migration:*` scripts) — but TypeORM eagerly
// resolves the `migrations` glob into loaded classes on every `initialize()`
// regardless of `migrationsRun`, which would make the app try to `require()`
// the .ts migration files outside backend/'s compiled output. Omit it here.
const { migrations: _migrations, ...runtimeOptions } = dataSourceOptions;

@Module({
  imports: [TypeOrmModule.forRoot(runtimeOptions)],
})
export class DatabaseModule {}
