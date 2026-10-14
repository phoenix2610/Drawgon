import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityTables1787134736666 implements MigrationInterface {
    name = 'CommunityTables1787134736666'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bookmarks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "board_id" uuid NOT NULL, "user_id" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bookmarks_board_user" UNIQUE ("board_id", "user_id"), CONSTRAINT "PK_7f976ef6cecd37a53bd11685f32" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_19e782d106bc2034e17c677319" ON "bookmarks"  ("board_id") `);
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "board_id" uuid NOT NULL, "user_id" text NOT NULL, "parent_comment_id" uuid, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_706cd9416275b3556f2e5850d6" ON "comments"  ("board_id") `);
        await queryRunner.query(`CREATE TABLE "votes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "board_id" uuid NOT NULL, "user_id" text NOT NULL, "value" smallint NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_votes_board_user" UNIQUE ("board_id", "user_id"), CONSTRAINT "PK_f3d9fd4a0af865152c3f59db8ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bc25b248127bac387daa0748e2" ON "votes"  ("board_id") `);
        await queryRunner.query(`ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_19e782d106bc2034e17c6773195" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_58a0fbaee65cd8959a870ee678c" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_706cd9416275b3556f2e5850d64" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_bc25b248127bac387daa0748e22" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_27be2cab62274f6876ad6a31641" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_27be2cab62274f6876ad6a31641"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_bc25b248127bac387daa0748e22"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_706cd9416275b3556f2e5850d64"`);
        await queryRunner.query(`ALTER TABLE "bookmarks" DROP CONSTRAINT "FK_58a0fbaee65cd8959a870ee678c"`);
        await queryRunner.query(`ALTER TABLE "bookmarks" DROP CONSTRAINT "FK_19e782d106bc2034e17c6773195"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc25b248127bac387daa0748e2"`);
        await queryRunner.query(`DROP TABLE "votes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_706cd9416275b3556f2e5850d6"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19e782d106bc2034e17c677319"`);
        await queryRunner.query(`DROP TABLE "bookmarks"`);
    }

}
