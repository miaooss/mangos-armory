import type { IRealmConfig } from "../../Config";
import type { IAccountRepository } from "../types";

/**
 * AzerothCore keeps GM levels in `account_access`, one row per account+realm,
 * with a `RealmID` of -1 meaning "every realm".
 */
export class AzerothCoreAccountRepository implements IAccountRepository {
	public readonly gmTableName = "account_access";

	public gmJoinExtraCondition(realm: IRealmConfig): string {
		return `AND \`account_access\`.\`RealmID\` IN (-1, ${realm.realmId}) AND \`account_access\`.\`gmlevel\` > 0`;
	}
}
