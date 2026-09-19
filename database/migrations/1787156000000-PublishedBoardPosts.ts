import { MigrationInterface, QueryRunner } from "typeorm";

export class PublishedBoardPosts1787156000000 implements MigrationInterface {
    name = 'PublishedBoardPosts1787156000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "boards" ADD "published_from_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_boards_published_from_id" ON "boards" ("published_from_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_boards_published_from_id"`);
        await queryRunner.query(`ALTER TABLE "boards" DROP COLUMN "published_from_id"`);
    }
}