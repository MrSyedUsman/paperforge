import { json, urlencoded } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Body parsing. Nest only installs its default JSON parser when it does not find one already registered,
 * and it recognises express' json() by name. Registering json() for just the two large-payload routes
 * therefore switched the default parser off, leaving every other route (login included) with an empty body.
 * Create the app with `bodyParser: false` and register all parsers here instead.
 */
export function configureBodyParsers(app: NestExpressApplication): void {
  app.use('/api/arena-debriefs', json({ limit: '700kb' }));
  app.use('/api/arena-radar', json({ limit: '1400kb' }));
  // Everything else keeps Nest's default limit (100kb). Bodies already parsed above are skipped.
  app.use(json());
  app.use(urlencoded({ extended: true }));
}
