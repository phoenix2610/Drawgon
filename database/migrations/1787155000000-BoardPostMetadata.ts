import { MigrationInterface, QueryRunner } from "typeorm";

export class BoardPostMetadata1787155000000 implements MigrationInterface {
    name = 'BoardPostMetadata1787155000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "boards" ADD "post_title" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "boards" ADD "post_details" text`);
        await queryRunner.query(`ALTER TABLE "boards" ADD "post_tags" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "boards" ADD "post_media" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "boards" DROP COLUMN "post_media"`);
        await queryRunner.query(`ALTER TABLE "boards" DROP COLUMN "post_tags"`);
        await queryRunner.query(`ALTER TABLE "boards" DROP COLUMN "post_details"`);
        await queryRunner.query(`ALTER TABLE "boards" DROP COLUMN "post_title"`);
    }
}