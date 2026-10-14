import { HttpException, Injectable } from '@nestjs/common';
/** Shared by both AI features, within one backend process only. */
@Injectable()
export class AiRequestBudget {
  private readonly users = new Map<string, { start: number; count: number; concurrent: number }>();
  private concurrent = 0;
  acquire(username: string): () => void {
    const now = Date.now();
    for (const [id, row] of this.users) if (now - row.start >= 60_000 && row.concurrent === 0) this.users.delete(id);
    let row = this.users.get(username);
    if (row && now - row.start >= 60_000) { row.start = now; row.count = 0; }
    if (row && (row.count >= 5 || row.concurrent >= 2)) throw new HttpException({ code: 'REVIEW_RATE_LIMIT', message: 'Please wait before requesting another new AI check.', retryAfterSeconds: Math.max(1, Math.ceil((60_000 - (now - row.start)) / 1000)) }, 429);
    if (this.concurrent >= 10 || (!row && this.users.size >= 2000)) throw new HttpException({ code: 'REVIEW_BUSY', message: 'AI checks are busy. Please try again shortly.' }, 503);
    if (!row) { row = { start: now, count: 0, concurrent: 0 }; this.users.set(username, row); }
    row.count++; row.concurrent++; this.concurrent++;
    const entry = row;
    let released = false;
    return () => { if (!released) { released = true; entry.concurrent--; this.concurrent--; } };
  }
}
