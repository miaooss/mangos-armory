import { RowDataPacket } from "mysql2/promise";

import type { Armory } from "../../Armory";
import { DataTablesSsp, IColumnSettings } from "../../DataTablesSsp";
import type { IArenaRepository, IArenaTeamData, IArenaTeamMemberRow } from "../types";

export class AzerothCoreArenaRepository implements IArenaRepository {
	public getLadderColumns(charSet: string): IColumnSettings[] {
		return [
			{ name: "name", collation: `${charSet}_general_ci` },
			{ name: "rating" },
			{ name: "seasonWins" },
			{ name: "seasonGames" },
		];
	}

	public configureLadderSsp(ssp: DataTablesSsp, teamSize: number): DataTablesSsp {
		return ssp.where("`type` = " + teamSize);
	}

	public async getTeamData(armory: Armory, realm: string, teamName: string): Promise<IArenaTeamData | null> {
		const db = armory.getCharactersDb(realm);
		const [rows] = await db.query({
			sql: `
				SELECT arenaTeamId, name, captainGuid, type, rating, seasonGames, seasonWins, weekGames, weekWins, emblemStyle, emblemColor, borderStyle, borderColor, backgroundColor AS background
				FROM arena_team WHERE name = ?
			`,
			values: [teamName],
			timeout: armory.config.dbQueryTimeout,
		});
		if ((rows as RowDataPacket[]).length === 0) {
			return null;
		}
		return rows[0] as IArenaTeamData;
	}

	public async getTeamMembers(armory: Armory, realm: string, arenaTeamId: number): Promise<IArenaTeamMemberRow[]> {
		const db = armory.getCharactersDb(realm);
		const [rows] = await db.query({
			sql: `
				SELECT name, weekGames, weekWins, seasonGames, seasonWins, personalRating, race, class, gender, online
				FROM arena_team_member
				LEFT JOIN characters ON arena_team_member.guid = characters.guid
				WHERE arenaTeamId = ?
			`,
			values: [arenaTeamId],
			timeout: armory.config.dbQueryTimeout,
		});
		return rows as IArenaTeamMemberRow[];
	}
}
