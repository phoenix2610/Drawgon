import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { VoiceGateway } from './voice.gateway';

@Module({
  imports: [BoardsModule],
  providers: [VoiceGateway],
})
export class VoiceModule {}
