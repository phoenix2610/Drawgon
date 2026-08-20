import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { BoardsModule } from './modules/boards/boards.module';
import { CommunityModule } from './modules/community/community.module';
import { VoiceModule } from './modules/voice/voice.module';
import { validate } from './config/env.validation';
import { auth } from './common/auth/auth.instance';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    AuthModule.forRoot({ auth, isGlobal: true }),
    DatabaseModule,
    BoardsModule,
    CommunityModule,
    VoiceModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
