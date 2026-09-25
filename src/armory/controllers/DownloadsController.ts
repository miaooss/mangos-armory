import * as fs from "fs";
import * as path from "path";
import * as express from "express";
const fsp = fs.promises;

const DOWNLOADS_DIR = "downloads";

function formatSize(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export class DownloadsController {
	public async index(req: express.Request, res: express.Response): Promise<void> {
		let entries: string[] = [];
		try {
			entries = await fsp.readdir(DOWNLOADS_DIR);
		} catch (err) {
			entries = [];
		}

		const zipFiles = entries.filter((name) => name.toLowerCase().endsWith(".zip"));

		const files = await Promise.all(
			zipFiles.map(async (name) => {
				const stat = await fsp.stat(path.join(DOWNLOADS_DIR, name));
				return {
					name,
					size: formatSize(stat.size),
					modifiedAt: stat.mtime.toISOString().slice(0, 10),
				};
			}),
		);

		files.sort((a, b) => a.name.localeCompare(b.name));

		res.render("downloads.hbs", {
			title: "Downloads",
			files,
		});
	}
}
