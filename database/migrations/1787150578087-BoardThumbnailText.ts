import { MigrationInterface, QueryRunner } from 'typeorm';

export class BoardThumbnailText1787150578087 implements MigrationInterface {
  name = 'BoardThumbnailText1787150578087';

  
  
  
  
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "boards" ALTER COLUMN "thumbnail_url" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query(
      `ALTER TABLE "boards" ALTER COLUMN "thumbnail_url" TYPE character varying`,
    );
  }
}
