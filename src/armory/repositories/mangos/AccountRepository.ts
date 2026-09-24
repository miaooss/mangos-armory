import type { IRealmConfig } from "../../Config";
import type { IAccountRepository } from "../types";

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
}
