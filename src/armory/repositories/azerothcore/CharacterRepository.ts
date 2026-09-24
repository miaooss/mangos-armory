import { RowDataPacket } from "mysql2/promise";

import type { Armory } from "../../Armory";
import type { IRealmConfig } from "../../Config";
import type { IAccountRepository, ICharacterData, ICharacterRepository, IEquipmentRow, IArenaTeamRow } from "../types";

export class AzerothCoreCharacterRepository implements ICharacterRepository {
	public constructor(private readonly account: IAccountRepository) {}

	public async getCharacterData(armory: Armory, realm: IRealmConfig, character: string | number): Promise<ICharacterData | null> {
		const where = typeof character === "string" ? "LOWER(`characters`.`name`) = LOWER(?)" : "`characters`.`guid` = ?";
		const gmTable = this.account.gmTableName;
		const [rows] = await armory.getCharactersDb(realm.name).query({
			sql: `
				SELECT \`characters\`.\`guid\`, \`characters\`.\`name\`, \`race\`, \`class\`, \`gender\`, \`level\`, \`skin\`, \`face\`, \`hairStyle\`, \`hairColor\`, \`facialStyle\`, \`playerFlags\`, \`online\`, \`guild\`.\`name\` AS \`guild\`
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
		return rows[0] as unknown as ICharacterData;
	}

	public async getEquipmentRows(armory: Armory, realm: string, charGuid: number): Promise<IEquipmentRow[]> {
		const transmogSelect = armory.config.transmogModule ? ", custom_transmogrification.FakeEntry AS transmog" : "";
		const transmogJoin = armory.config.transmogModule
			? "LEFT JOIN custom_transmogrification ON custom_transmogrification.GUID = item_instance.guid"
			: "";
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT
					character_inventory.slot, item_instance.itemEntry, item_instance.flags, item_instance.enchantments, item_instance.randomPropertyId
					${transmogSelect}
				FROM character_inventory
				JOIN item_instance ON item_instance.guid = character_inventory.item
				${transmogJoin}
				WHERE character_inventory.guid = ? AND character_inventory.bag = 0 AND character_inventory.slot IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18)
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		return rows as RowDataPacket[] as IEquipmentRow[];
	}

	public async getTalents(armory: Armory, realm: string, charGuid: number): Promise<number[][]> {
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT spell, specMask
				FROM character_talent
				WHERE guid = ?
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		const talents: number[][] = [[], []];
		for (const row of rows as RowDataPacket[]) {
			if (row.specMask === 1 || row.specMask === 3) {
				talents[0].push(row.spell);
			}
			if (row.specMask === 2 || row.specMask === 3) {
				talents[1].push(row.spell);
			}
		}

		return talents;
	}

	public async getGlyphs(armory: Armory, realm: string, charGuid: number): Promise<number[][]> {
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT guid, talentGroup, glyph1, glyph2, glyph3, glyph4, glyph5, glyph6
				FROM character_glyphs
				WHERE guid = ?
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		const glyphs: number[][] = [[], []];
		for (const row of rows as RowDataPacket[]) {
			const glyphIds = [row.glyph1, row.glyph2, row.glyph3, row.glyph4, row.glyph5, row.glyph6].filter((id) => id !== 0);
			for (const glyphId of glyphIds) {
				const glyph = await armory.dbc.glyphProperties().find((g) => g.id === glyphId);
				if (glyph === undefined) {
					continue;
				}
				glyphs[row.talentGroup].push(glyph.spellId);
			}
		}

		return glyphs;
	}

	public async getArenaTeamsForCharacter(armory: Armory, realm: string, charGuid: number): Promise<IArenaTeamRow[]> {
		const [rows] = await armory.getCharactersDb(realm).query({
			sql: `
				SELECT
					arena_team.arenaTeamId AS id, arena_team.name, arena_team.type, arena_team.rating, arena_team.seasonWins, arena_team.seasonGames,
					arena_team.backgroundColor AS background, arena_team.emblemStyle, arena_team.emblemColor, arena_team.borderStyle, arena_team.borderColor
				FROM arena_team_member
				LEFT JOIN arena_team ON arena_team_member.arenaTeamId = arena_team.arenaTeamId
				WHERE guid = ?
				ORDER BY arena_team.type ASC
			`,
			values: [charGuid],
			timeout: armory.config.dbQueryTimeout,
		});

		return rows as IArenaTeamRow[];
	}
}
