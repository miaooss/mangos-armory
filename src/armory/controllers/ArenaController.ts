import * as express from "express";

import { Armory } from "../Armory";
import { IRealmConfig } from "../Config";
import { IEmblem, Utils } from "../Utils";
import { DataTablesSsp } from "../DataTablesSsp";

interface ITeamMemberData {
	name: string;
	weekGames: number;
	weekWins: number;
	seasonGames: number;
	seasonWins: number;
	personalRating: number;
	race: number;
	class: number;
	gender: string;
	online: boolean;
}

interface ITeamData {
	name: string;
	captainGuid: number;
	type: number;
	rating: number;
	seasonGames: number;
	seasonWins: number;
	weekGames: number;
	weekWins: number;
	emblem: IEmblem;
	members: ITeamMemberData[];
}

export class ArenaController {
	private armory: Armory;

	public constructor(armory: Armory) {
		this.armory = armory;
	}

	public async index(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
		res.render("ladder-arena.hbs", {
			title: `Arena Ladder`,
			realms: this.armory.config.realms.map((r) => r.name),
		});
	}

	public async team(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
		const realmName = req.params.realm;
		const teamName = req.params.name;

		const realm = this.armory.getRealm(realmName);
		if (realm === undefined) {
			// Could not find realm
			return next(404);
		}

		const teamData = await this.getTeamData(realm, teamName);
		if (teamData === null) {
			// Could not find team
			return next(404);
		}

		res.render("arena-team.hbs", {
			title: `Armory - ${teamData.name}`,
			realm: realm.name,
			...teamData,
		});
	}

	public async ladder(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
		const realmName = req.query.realm as string;
		const realm = realmName === undefined ? this.armory.config.realms[0] : this.armory.config.realms.find((r) => r.name === realmName);
		if (realm === undefined) {
			return next(400);
		}

		const teamSize = parseInt(req.query.teamsize as string);
		if (!(teamSize === 2 || teamSize === 3 || teamSize === 5)) {
			return next(400);
		}

		const db = this.armory.getCharactersDb(realm.name);
		const charSet = await this.armory.getDatabaseCharset(realm.name);
		const arenaRepo = this.armory.repositories.arena;

		let ssp = new DataTablesSsp(req.query, db, "arena_team", "arenateamid", arenaRepo.getLadderColumns(charSet));
		ssp = arenaRepo.configureLadderSsp(ssp, teamSize);

		const result = await ssp.run(this.armory.config.dbQueryTimeout);

		res.json({
			...result,
			realm: realm.name,
			teamSize,
		});
	}

	private async getTeamData(realm: IRealmConfig, teamName: string): Promise<ITeamData> {
		const arenaRepo = this.armory.repositories.arena;
		const team = await arenaRepo.getTeamData(this.armory, realm.name, teamName);
		if (team === null) {
			return null;
		}

		const memberRows = await arenaRepo.getTeamMembers(this.armory, realm.name, team.arenaTeamId);
		const members: ITeamMemberData[] = memberRows.map((row) => {
			return {
				name: row.name,
				weekGames: row.weekGames,
				weekWins: row.weekWins,
				seasonGames: row.seasonGames,
				seasonWins: row.seasonWins,
				personalRating: row.personalRating,
				race: Utils.raceNames[row.race],
				class: Utils.classNames[row.class],
				gender: row.gender === 0 ? "male" : "female",
				online: row.online === 1,
			};
		});

		return {
			name: team.name,
			captainGuid: team.captainGuid,
			type: team.type,
			rating: team.rating,
			seasonGames: team.seasonGames,
			seasonWins: team.seasonWins,
			weekGames: team.weekGames,
			weekWins: team.weekWins,
			emblem: Utils.makeEmblemObject(team, false),
			members,
		};
	}
}
