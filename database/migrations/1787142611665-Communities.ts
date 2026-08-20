import { MigrationInterface, QueryRunner } from "typeorm";

export class Communities1787142611665 implements MigrationInterface {
    name = 'Communities1787142611665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "communities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slug" character varying(64) NOT NULL, "name" character varying(120) NOT NULL, "description" text, "created_by" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fea1fe83c86ccde9d0a089e7ea2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_communities_slug" ON "communities"  ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_39793f5d3c7464578d8b03f436" ON "communities"  ("created_by") `);
        await queryRunner.query(`CREATE TYPE "public"."community_members_role_enum" AS ENUM('owner', 'moderator', 'member')`);
        await queryRunner.query(`CREATE TABLE "community_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "community_id" uuid NOT NULL, "user_id" text NOT NULL, "role" "public"."community_members_role_enum" NOT NULL DEFAULT 'member', "joined_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_community_members_community_user" UNIQUE ("community_id", "user_id"), CONSTRAINT "PK_03dff82f9cfcb02498e9f5fc640" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_46eb2c3e2d8b84acbd9a78974a" ON "community_members"  ("community_id") `);
        await queryRunner.query(`ALTER TABLE "boards" ADD "community_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_174a05626ddc2c01556220fa33" ON "boards"  ("community_id") `);
        await queryRunner.query(`ALTER TABLE "communities" ADD CONSTRAINT "FK_communities_creator" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "boards" ADD CONSTRAINT "FK_boards_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_members" ADD CONSTRAINT "FK_46eb2c3e2d8b84acbd9a78974ab" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_members" ADD CONSTRAINT "FK_59ac0a0f039c16f8429ec9bda5d" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_members" DROP CONSTRAINT "FK_59ac0a0f039c16f8429ec9bda5d"`);
        await queryRunner.query(`ALTER TABLE "community_members" DROP CONSTRAINT "FK_46eb2c3e2d8b84acbd9a78974ab"`);
        await queryRunner.query(`ALTER TABLE "boards" DROP CONSTRAINT "FK_boards_community"`);
        await queryRunner.query(`ALTER TABLE "communities" DROP CONSTRAINT "FK_communities_creator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_174a05626ddc2c01556220fa33"`);
        await queryRunner.query(`ALTER TABLE "boards" DROP COLUMN "community_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_46eb2c3e2d8b84acbd9a78974a"`);
        await queryRunner.query(`DROP TABLE "community_members"`);
        await queryRunner.query(`DROP TYPE "public"."community_members_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39793f5d3c7464578d8b03f436"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_communities_slug"`);
        await queryRunner.query(`DROP TABLE "communities"`);
    }

}
