import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollaboratorOpened1787300000000 implements MigrationInterface {
  name = 'CollaboratorOpened1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "board_collaborators" ADD COLUMN IF NOT EXISTS "last_opened_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "board_collaborators" DROP COLUMN IF EXISTS "last_opened_at"`,
    );
  }
}
