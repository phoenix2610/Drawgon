import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @AllowAnonymous()
  @Get()
  async getHealth() {
    await this.dataSource.query('SELECT 1');
    return {
      status: 'ok',
      database: this.dataSource.isInitialized ? 'connected' : 'disconnected',
    };
  }
}
