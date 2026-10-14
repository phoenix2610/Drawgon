import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { CollaboratorRole } from '../../../database/entities/board-collaborator.entity';

const ROLES: CollaboratorRole[] = ['editor', 'viewer'];

export class InviteCollaboratorDto {
  @IsOptional()
  @IsString()
  @MaxLength(41)
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: CollaboratorRole;
}

export class UpdateCollaboratorDto {
  @IsIn(ROLES)
  role!: CollaboratorRole;
}

export class InviteLinkDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: CollaboratorRole;
}
