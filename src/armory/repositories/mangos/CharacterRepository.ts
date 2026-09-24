import { RowDataPacket } from "mysql2/promise";

import type { Armory } from "../../Armory";
import type { IRealmConfig } from "../../Config";
import type { IAccountRepository, ICharacterData, ICharacterRepository, IEquipmentRow, IArenaTeamRow } from "../types";

export class MangosCharacterRepository implements ICharacterRepository {
	public constructor(private readonly account: IAccountRepository) {}

	public async getCharacterData(armory: Armory, realm: IRealmConfig, character: string | number): Promise<ICharacterData | null> {
		const where = typeof character === "string" ? "LOWER(`characters`.`name`) = LOWER(?)" : "`characters`.`guid` = ?";
		const gmTable = this.account.gmTableName;
		const [rows] = await armory.getCharactersDb(realm.name).query({
			sql: `
				SELECT \`characters\`.\`guid\`, \`characters\`.\`name\`, \`race\`, \`class\`, \`gender\`, \`level\`, \`playerBytes\`, \`playerBytes2\`, \`playerFlags\`, \`online\`, \`guild\`.\`name\` AS \`guild\`
				FROM \`characters\`
				LEFT JOIN \`guild_member\` ON \`guild_member\`.\`guid\` = \`characters\`.\`guid\`
				LEFT JOIN \`guild\` ON \`guild\`.\`guildid\` = \`guild_member\`.\`guildid\`
				LEFT JOIN \`${realm.authDatabase}\`.\`${gmTable}\` ON \`${gmTable}\`.\`id\` = \`characters\`.\`account\` ${this.account.gmJoinExtraCondition(realm)}
				WHERE
					${where}
					AND (\`${gmTable}\`.\`id\` IS NULL OR ? = 0)
			`,
			values: [character, armory.config.hideGameMasters ? 1 : 0],
			timeout: armory.config.dbQueryTimeout,
		});

		if ((rows as RowDataPacket[]).length === 0) {
			return null;
		}

		// MaNGOS packs the character's look into playerBytes/playerBytes2 instead of
		// storing skin/face/hairStyle/hairColor/facialStyle as separate columns.
		const row = rows[0] as RowDataPacket;
		const playerBytes = row.playerBytes as number;
		const playerBytes2 = row.playerBytes2 as number;
		row.skin = playerBytes & 0xff;
		row.face = (playerBytes >> 8) & 0xff;
		row.hairStyle = (playerBytes >> 16) & 0xff;
		row.hairColor = (playerBytes >> 24) & 0xff;
		row.facialStyle = playerBytes2 & 0xff;

		return row as unknown as ICharacterData;
	}

	public async getEquipmentRows(armory: Armory, realm: string, charGuid: number): Promise<IEquipmentRow[]> {
		const transmogSelect = armory.config.transmogModule ? ", custom_transmogrification.FakeEntry AS transmog" : "";
		const transmogJoin = armory.config.transmogModule
			? "LEFT JOIN custom_transmogrification ON custom_transmogrification.GUID = item_instance.guid"
			: "";
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT
					character_inventory.slot, character_inventory.item_template AS itemEntry, item_instance.data
					${transmogSelect}
				FROM character_inventory
				JOIN item_instance ON item_instance.guid = character_inventory.item
				${transmogJoin}
				WHERE character_inventory.guid = ? AND character_inventory.bag = 0 AND character_inventory.slot IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18)
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		return (rows as RowDataPacket[]).map((row) => this.parseItemInstanceData(row));
	}

	// MaNGOS stores `item_instance` as a raw dump of the item's update fields (space-separated
	// uint32s) instead of separate itemEntry/flags/enchantments/randomPropertyId columns.
	// Offsets below come from OBJECT_END (6) + ITEM_FIELD_* in mangos's UpdateFields.h:
	//   ITEM_FIELD_FLAGS = 21, ITEM_FIELD_ENCHANTMENT_1_1..12_3 = 22..57 (12 slots x 3 fields),
	//   ITEM_FIELD_RANDOM_PROPERTIES_ID = 59.
	private parseItemInstanceData(row: RowDataPacket): IEquipmentRow {
		const values = (row.data as string).trim().split(" ").map(Number);
		return {
			slot: row.slot,
			itemEntry: row.itemEntry,
			flags: values[21],
			enchantments: values.slice(22, 58).join(" "),
			randomPropertyId: values[59],
			transmog: row.transmog,
		};
	}

	public async getTalents(armory: Armory, realm: string, charGuid: number): Promise<number[][]> {
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT talent_id, current_rank, spec
				FROM character_talent
				WHERE guid = ?
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		const talents: number[][] = [[], []];
		for (const row of rows as RowDataPacket[]) {
			const talent = await armory.dbc.talent().find((t) => t.id === row.talent_id);
			if (talent === undefined) {
				continue;
			}
			const spellId = talent[`spellRank${row.current_rank}`];
			if (spellId) {
				talents[row.spec === 1 ? 1 : 0].push(spellId);
			}
		}

		return talents;
	}

	public async getGlyphs(armory: Armory, realm: string, charGuid: number): Promise<number[][]> {
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT spec, glyph
				FROM character_glyphs
				WHERE guid = ? AND glyph <> 0
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		const glyphs: number[][] = [[], []];
		for (const row of rows as RowDataPacket[]) {
			const glyph = await armory.dbc.glyphProperties().find((g) => g.id === row.glyph);
			if (glyph === undefined) {
				continue;
			}
			glyphs[row.spec === 1 ? 1 : 0].push(glyph.spellId);
		}

		return glyphs;
	}

	public async getArenaTeamsForCharacter(armory: Armory, realm: string, charGuid: number): Promise<IArenaTeamRow[]> {
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT
					arena_team.arenateamid AS id, arena_team.name, arena_team.type, arena_team_stats.rating,
					arena_team_stats.wins_season AS seasonWins, arena_team_stats.games_season AS seasonGames,
					arena_team.BackgroundColor AS background, arena_team.EmblemStyle AS emblemStyle, arena_team.EmblemColor AS emblemColor,
					arena_team.BorderStyle AS borderStyle, arena_team.BorderColor AS borderColor
				FROM arena_team_member
				LEFT JOIN arena_team ON arena_team_member.arenateamid = arena_team.arenateamid
				LEFT JOIN arena_team_stats ON arena_team.arenateamid = arena_team_stats.arenateamid
				WHERE guid = ?
				ORDER BY arena_team.type ASC
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		return rows as IArenaTeamRow[];
	}
}
