import * as crypto from "crypto";

// AzerothCore/TrinityCore SRP6 constants.
const N = BigInt("0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7");
const G = BigInt(7);

function sha1(...parts: Buffer[]): Buffer {
	const hash = crypto.createHash("sha1");
	for (const part of parts) {
		hash.update(part);
	}
	return hash.digest();
}

// Buffers produced by AzerothCore's SRP6 implementation are little-endian.
function bufferToBigInt(buf: Buffer): bigint {
	return BigInt(`0x${Buffer.from(buf).reverse().toString("hex")}`);
}

function bigIntToBuffer(value: bigint, length: number): Buffer {
	let hex = value.toString(16);
	if (hex.length % 2 !== 0) {
		hex = `0${hex}`;
	}
	const buf = Buffer.from(hex, "hex").reverse();
	if (buf.length >= length) {
		return buf.subarray(0, length);
	}
	return Buffer.concat([buf, Buffer.alloc(length - buf.length)]);
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
	if (modulus === BigInt(1)) {
		return BigInt(0);
	}
	let result = BigInt(1);
	let b = base % modulus;
	let e = exponent;
	while (e > BigInt(0)) {
		if (e & BigInt(1)) {
			result = (result * b) % modulus;
		}
		e >>= BigInt(1);
		b = (b * b) % modulus;
	}
	return result;
}

export function generateSalt(): Buffer {
	return crypto.randomBytes(32);
}

/**
 * Computes the SRP6 verifier for a given username/password/salt, matching
 * AzerothCore's `SRP6::CalculateVerifier`. Used both to set a new password
 * (fresh salt) and to check an existing password (stored salt, compare
 * against the stored verifier).
 */
export function computeVerifier(username: string, password: string, salt: Buffer): Buffer {
	const identityHash = sha1(Buffer.from(`${username.toUpperCase()}:${password.toUpperCase()}`, "ascii"));
	const h = bufferToBigInt(sha1(salt, identityHash));
	const verifier = modPow(G, h, N);
	return bigIntToBuffer(verifier, 32);
}

export function verifiersEqual(a: Buffer, b: Buffer): boolean {
	if (a.length !== b.length) {
		return false;
	}
	return crypto.timingSafeEqual(a, b);
}
