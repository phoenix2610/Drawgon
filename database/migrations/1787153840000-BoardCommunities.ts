import { MigrationInterface, QueryRunner } from "typeorm";

export class BoardCommunities1787153840000 implements MigrationInterface {
    name = 'BoardCommunities1787153840000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "board_communities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "board_id" uuid NOT NULL, "community_id" uuid NOT NULL, CONSTRAINT "UQ_board_communities_board_community" UNIQUE ("board_id", "community_id"), CONSTRAINT "PK_board_communities" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_board_communities_board" ON "board_communities" ("board_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_board_communities_community" ON "board_communities" ("community_id")`);
        await queryRunner.query(`ALTER TABLE "board_communities" ADD CONSTRAINT "FK_board_communities_board" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "board_communities" ADD CONSTRAINT "FK_board_communities_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`INSERT INTO "board_communities" ("board_id", "community_id") SELECT "id", "community_id" FROM "boards" WHERE "community_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "board_communities" DROP CONSTRAINT "FK_board_communities_community"`);
        await queryRunner.query(`ALTER TABLE "board_communities" DROP CONSTRAINT "FK_board_communities_board"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_board_communities_community"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_board_communities_board"`);
        await queryRunner.query(`DROP TABLE "board_communities"`);
    }
}
