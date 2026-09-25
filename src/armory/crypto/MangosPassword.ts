import * as crypto from "crypto";

/** MaNGOS `sha_pass_hash` = SHA1(UPPER(username) + ":" + UPPER(password)), hex. */
export function computeHash(username: string, password: string): string {
	return crypto
		.createHash("sha1")
		.update(`${username.toUpperCase()}:${password.toUpperCase()}`, "ascii")
		.digest("hex")
		.toUpperCase();
}

export function hashesEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a.toUpperCase(), "utf8");
	const bufB = Buffer.from(b.toUpperCase(), "utf8");
	if (bufA.length !== bufB.length) {
		return false;
	}
	return crypto.timingSafeEqual(bufA, bufB);
}
