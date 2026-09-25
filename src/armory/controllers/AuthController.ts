import * as express from "express";

import { Armory } from "../Armory";
import { AttemptThrottle } from "../AttemptThrottle";

const THROTTLE_MAX_ATTEMPTS = 5;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 6;
// The 3.3.5 game client caps account passwords at 16 characters, and both
// AzerothCore's and MaNGOS's password hashing uppercase per-ASCII-byte, so a
// password outside printable ASCII or longer than 16 chars would compute a
// verifier/hash the game client itself could never reproduce, permanently
// locking the player out.
const MAX_PASSWORD_LENGTH = 16;
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

export class AuthController {
	private armory: Armory;
	private throttle: AttemptThrottle;

	public constructor(armory: Armory) {
		this.armory = armory;
		this.throttle = new AttemptThrottle(THROTTLE_MAX_ATTEMPTS, THROTTLE_WINDOW_MS);
	}

	public async changePasswordForm(req: express.Request, res: express.Response): Promise<void> {
		res.render("change-password.hbs", {
			title: "Change Password",
			realms: this.armory.config.realms.map((r) => r.name),
		});
	}

	public async changePassword(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
		const realmName = req.body.realm as string;
		const accountName = (req.body.accountName as string) ?? "";
		const currentPassword = (req.body.currentPassword as string) ?? "";
		const newPassword = (req.body.newPassword as string) ?? "";
		const newPasswordConfirm = (req.body.newPasswordConfirm as string) ?? "";

		const realm = this.armory.config.realms.find((r) => r.name === realmName);
		const renderError = (error: string, status = 400) => {
			res.status(status).render("change-password.hbs", {
				title: "Change Password",
				realms: this.armory.config.realms.map((r) => r.name),
				formValues: { realm: realmName, accountName },
				error,
			});
		};

		if (realm === undefined) {
			return next(400);
		}
		if (!PRINTABLE_ASCII.test(accountName) || !PRINTABLE_ASCII.test(currentPassword)) {
			return renderError("Account name or current password is incorrect.", 401);
		}
		if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
			return renderError(`New password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long.`);
		}
		if (!PRINTABLE_ASCII.test(newPassword)) {
			return renderError("New password may only contain standard letters, digits and symbols (no accents or emoji).");
		}
		if (newPassword !== newPasswordConfirm) {
			return renderError("New password and confirmation do not match.");
		}

		const throttleKey = accountName.toLowerCase();
		if (this.throttle.isBlocked(throttleKey)) {
			return renderError("Too many attempts. Please try again later.", 429);
		}

		const accountId = await this.armory.repositories.account.verifyPassword(this.armory, realm, accountName, currentPassword);
		if (accountId === null) {
			this.throttle.recordFailure(throttleKey);
			return renderError("Account name or current password is incorrect.", 401);
		}

		this.throttle.reset(throttleKey);
		await this.armory.repositories.account.updatePassword(this.armory, realm, accountId, newPassword);

		res.render("change-password.hbs", {
			title: "Change Password",
			realms: this.armory.config.realms.map((r) => r.name),
			success: "Password changed successfully.",
		});
	}
}
