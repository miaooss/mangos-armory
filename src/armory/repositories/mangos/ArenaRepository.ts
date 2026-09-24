import { RowDataPacket } from "mysql2/promise";

import type { Armory } from "../../Armory";
import { DataTablesSsp, IColumnSettings } from "../../DataTablesSsp";
import type { IArenaRepository, IArenaTeamData, IArenaTeamMemberRow } from "../types";

export class MangosArenaRepository implements IArenaRepository {
	public getLadderColumns(charSet: string): IColumnSettings[] {
		return [
			{ name: "name", collation: `${charSet}_general_ci` },
			{ name: "rating", table: "arena_team_stats" },
			{ name: "wins_season", table: "arena_team_stats" },
			{ name: "games_season", table: "arena_team_stats" },
		];
	}

	public configureLadderSsp(ssp: DataTablesSsp, teamSize: number): DataTablesSsp {
		ssp.joins = [{ table1: "arena_team", column1: "arenateamid", table2: "arena_team_stats", column2: "arenateamid", kind: "LEFT" }];
		return ssp.where("`arena_team`.`type` = " + teamSize);
	}

	public async getTeamData(armory: Armory, realm: string, teamName: string): Promise<IArenaTeamData | null> {
		const db = armory.getCharactersDb(realm);
		const [rows] = await db.query({
			sql: `
				SELECT
					arena_team.arenateamid AS arenaTeamId, arena_team.name, arena_team.captainguid AS captainGuid, arena_team.type,
					arena_team_stats.rating, arena_team_stats.games_season AS seasonGames, arena_team_stats.wins_season AS seasonWins,
					arena_team_stats.games_week AS weekGames, arena_team_stats.wins_week AS weekWins,
					arena_team.EmblemStyle AS emblemStyle, arena_team.EmblemColor AS emblemColor, arena_team.BorderStyle AS borderStyle,
					arena_team.BorderColor AS borderColor, arena_team.BackgroundColor AS background
				FROM arena_team
				LEFT JOIN arena_team_stats ON arena_team.arenateamid = arena_team_stats.arenateamid
				WHERE arena_team.name = ?
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
				SELECT
					characters.name, arena_team_member.played_week AS weekGames, arena_team_member.wons_week AS weekWins,
					arena_team_member.played_season AS seasonGames, arena_team_member.wons_season AS seasonWins,
					arena_team_member.personal_rating AS personalRating, characters.race, characters.class, characters.gender, characters.online
				FROM arena_team_member
				LEFT JOIN characters ON arena_team_member.guid = characters.guid
				WHERE arena_team_member.arenateamid = ?
			`,
			values: [arenaTeamId],
			timeout: armory.config.dbQueryTimeout,
		});
		return rows as IArenaTeamMemberRow[];
	}
}
