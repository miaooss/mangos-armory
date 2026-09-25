import type { Armory } from "../../Armory";
import type { IRealmConfig } from "../../Config";
import type { IAccountRepository } from "../types";
import { computeHash, hashesEqual } from "../../crypto/MangosPassword";

/**
 * MaNGOS has no `account_access` table: `gmlevel` lives directly on `account`
 * and applies to every realm (there is no per-realm override).
 */
export class MangosAccountRepository implements IAccountRepository {
	public readonly gmTableName = "account";

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public gmJoinExtraCondition(realm: IRealmConfig): string {
		return "AND `account`.`gmlevel` > 0";
	}

	public async verifyPassword(armory: Armory, realm: IRealmConfig, accountName: string, password: string): Promise<number | null> {
		const db = armory.getCharactersDb(realm.name);
		const [rows] = await db.query({
			sql: `SELECT \`id\`, \`username\`, \`sha_pass_hash\` FROM \`${realm.authDatabase}\`.\`account\` WHERE \`username\` = ?`,
			values: [accountName],
			timeout: armory.config.dbQueryTimeout,
		});
		const row = (rows as { id: number; username: string; sha_pass_hash: string }[])[0];
		if (row === undefined) {
			return null;
		}

		const computed = computeHash(row.username, password);
		if (!hashesEqual(computed, row.sha_pass_hash)) {
			return null;
		}
		return row.id;
	}

	public async updatePassword(armory: Armory, realm: IRealmConfig, accountId: number, newPassword: string): Promise<void> {
		const db = armory.getCharactersDb(realm.name);
		const [rows] = await db.query({
			sql: `SELECT \`username\` FROM \`${realm.authDatabase}\`.\`account\` WHERE \`id\` = ?`,
			values: [accountId],
			timeout: armory.config.dbQueryTimeout,
		});
		const row = (rows as { username: string }[])[0];
		if (row === undefined) {
			throw new Error(`Account ${accountId} not found`);
		}

		const hash = computeHash(row.username, newPassword);
		await db.query({
			sql: `UPDATE \`${realm.authDatabase}\`.\`account\` SET \`sha_pass_hash\` = ? WHERE \`id\` = ?`,
			values: [hash, accountId],
			timeout: armory.config.dbQueryTimeout,
		});
	}
}
