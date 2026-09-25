interface IAttemptRecord {
	count: number;
	resetAt: number;
}

/** Best-effort, in-memory brute-force throttle for login/password-change attempts. */
export class AttemptThrottle {
	private attempts: Map<string, IAttemptRecord> = new Map();

	public constructor(
		private readonly maxAttempts: number,
		private readonly windowMs: number,
	) {}

	public isBlocked(key: string): boolean {
		const record = this.attempts.get(key);
		if (record === undefined) {
			return false;
		}
		if (Date.now() > record.resetAt) {
			this.attempts.delete(key);
			return false;
		}
		return record.count >= this.maxAttempts;
	}

	public recordFailure(key: string): void {
		const now = Date.now();
		const record = this.attempts.get(key);
		if (record === undefined || now > record.resetAt) {
			this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
			return;
		}
		record.count++;
	}

	public reset(key: string): void {
		this.attempts.delete(key);
	}
}
