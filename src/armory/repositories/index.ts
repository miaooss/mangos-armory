import { AzerothCoreAccountRepository } from "./azerothcore/AccountRepository";
import { AzerothCoreCharacterRepository } from "./azerothcore/CharacterRepository";
import { AzerothCoreArenaRepository } from "./azerothcore/ArenaRepository";
import { MangosAccountRepository } from "./mangos/AccountRepository";
import { MangosCharacterRepository } from "./mangos/CharacterRepository";
import { MangosArenaRepository } from "./mangos/ArenaRepository";
import { IRepositories } from "./types";

export * from "./types";

export type DbType = "azerothcore" | "mangos";

export function createRepositories(dbType: DbType): IRepositories {
	switch (dbType) {
		case "mangos": {
			const account = new MangosAccountRepository();
			return {
				account,
				character: new MangosCharacterRepository(account),
				arena: new MangosArenaRepository(),
			};
		}
		case "azerothcore":
		default: {
			const account = new AzerothCoreAccountRepository();
			return {
				account,
				character: new AzerothCoreCharacterRepository(account),
				arena: new AzerothCoreArenaRepository(),
			};
		}
	}
}
