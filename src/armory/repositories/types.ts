import type { Armory } from "../Armory";
import type { IRealmConfig } from "../Config";
import type { DataTablesSsp, IColumnSettings } from "../DataTablesSsp";

export interface ICharacterData {
	guid: number;
	name: string;
	race: number;
	class: number;
	gender: number;
	level: number;
	skin: number;
	face: number;
	hairStyle: number;
	hairColor: number;
	facialStyle: number;
	playerFlags: number;
	online: number;
	guild: string;
}

export interface IEquipmentRow {
	slot: number;
	itemEntry: number;
	flags: number;
	enchantments: string;
	randomPropertyId: number;
	transmog?: number;
}

export interface IArenaTeamRow {
	id: number;
	name: string;
	type: number;
	rating: number;
	seasonWins: number;
	seasonGames: number;
	background: number;
	emblemStyle: number;
	emblemColor: number;
	borderStyle: number;
	borderColor: number;
}

export interface IArenaTeamData {
	arenaTeamId: number;
	name: string;
	captainGuid: number;
	type: number;
	rating: number;
	seasonGames: number;
	seasonWins: number;
	weekGames: number;
	weekWins: number;
	emblemStyle: number;
	emblemColor: number;
	borderStyle: number;
	borderColor: number;
	background: number;
}

export interface IArenaTeamMemberRow {
	name: string;
	weekGames: number;
	weekWins: number;
	seasonGames: number;
	seasonWins: number;
	personalRating: number;
	race: number;
	class: number;
	gender: number;
	online: number;
}

/**
 * The only piece of the schema needed to hide Game Masters from listings: which
 * table in the auth database carries `gmlevel`, and how to join it. AzerothCore
 * keeps this in `account_access` (one row per account+realm); MaNGOS keeps a
 * single `gmlevel` column directly on `account`.
 */
export interface IAccountRepository {
	readonly gmTableName: string;
	/** Extra `AND ...` condition appended to `LEFT JOIN <gmTableName> ON <gmTableName>.id = characters.account`. */
	gmJoinExtraCondition(realm: IRealmConfig): string;
}

export interface ICharacterRepository {
	getCharacterData(armory: Armory, realm: IRealmConfig, character: string | number): Promise<ICharacterData | null>;
	getEquipmentRows(armory: Armory, realm: string, charGuid: number): Promise<IEquipmentRow[]>;
	getTalents(armory: Armory, realm: string, charGuid: number): Promise<number[][]>;
	getGlyphs(armory: Armory, realm: string, charGuid: number): Promise<number[][]>;
	getArenaTeamsForCharacter(armory: Armory, realm: string, charGuid: number): Promise<IArenaTeamRow[]>;
}

export interface IArenaRepository {
	/**
	 * Column settings for the ladder listing's name/rating/season columns. Rating and season
	 * stats live directly on `arena_team` on AzerothCore but in a separate `arena_team_stats`
	 * table on MaNGOS, so the column `table` (and, for MaNGOS, `name`) differ.
	 */
	getLadderColumns(charSet: string): IColumnSettings[];
	/** Wires up the joins and `type` filter needed to reach the columns above. */
	configureLadderSsp(ssp: DataTablesSsp, teamSize: number): DataTablesSsp;
	getTeamData(armory: Armory, realm: string, teamName: string): Promise<IArenaTeamData | null>;
	getTeamMembers(armory: Armory, realm: string, arenaTeamId: number): Promise<IArenaTeamMemberRow[]>;
}

export interface IRepositories {
	account: IAccountRepository;
	character: ICharacterRepository;
	arena: IArenaRepository;
}
