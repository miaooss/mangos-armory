import type { Armory } from "../../Armory";
import type { IRealmConfig } from "../../Config";
import type { IAccountRepository } from "../types";
import { computeVerifier, generateSalt, verifiersEqual } from "../../crypto/Srp6";

/**
 * AzerothCore keeps GM levels in `account_access`, one row per account+realm,
 * with a `RealmID` of -1 meaning "every realm".
 */
export class AzerothCoreAccountRepository implements IAccountRepository {
	public readonly gmTableName = "account_access";

	public gmJoinExtraCondition(realm: IRealmConfig): string {
		return `AND \`account_access\`.\`RealmID\` IN (-1, ${realm.realmId}) AND \`account_access\`.\`gmlevel\` > 0`;
	}

	public async verifyPassword(armory: Armory, realm: IRealmConfig, accountName: string, password: string): Promise<number | null> {
		const db = armory.getCharactersDb(realm.name);
		const [rows] = await db.query({
			sql: `SELECT \`id\`, \`username\`, \`salt\`, \`verifier\` FROM \`${realm.authDatabase}\`.\`account\` WHERE \`username\` = ?`,
			values: [accountName],
			timeout: armory.config.dbQueryTimeout,
		});
		const row = (rows as { id: number; username: string; salt: Buffer | null; verifier: Buffer | null }[])[0];
		if (row === undefined || row.salt === null || row.verifier === null) {
			return null;
		}

		const computed = computeVerifier(row.username, password, row.salt);
		if (!verifiersEqual(computed, row.verifier)) {
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

		const salt = generateSalt();
		const verifier = computeVerifier(row.username, newPassword, salt);
		await db.query({
			sql: `UPDATE \`${realm.authDatabase}\`.\`account\` SET \`salt\` = ?, \`verifier\` = ? WHERE \`id\` = ?`,
			values: [salt, verifier, accountId],
			timeout: armory.config.dbQueryTimeout,
		});
	}
}
