import { MigrationInterface, QueryRunner } from 'typeorm';

export class BoardThumbnailText1787150578087 implements MigrationInterface {
  name = 'BoardThumbnailText1787150578087';

  // Thumbnails are stored as data URLs, which overflow varchar's default
  // length. TypeORM generates DROP + ADD for this change, which would discard
  // every existing thumbnail; varchar -> text is a safe widening cast in
  // Postgres, so alter the type in place instead.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "boards" ALTER COLUMN "thumbnail_url" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Narrowing back can truncate; that is inherent to reverting this change.
    await queryRunner.query(
      `ALTER TABLE "boards" ALTER COLUMN "thumbnail_url" TYPE character varying`,
    );
  }
}
