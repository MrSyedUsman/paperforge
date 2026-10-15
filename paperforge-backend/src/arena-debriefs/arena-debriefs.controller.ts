import {
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { calculateArenaFacts } from './arena-facts.js';
import { ArenaDebriefsService } from './arena-debriefs.service.js';
@Controller('arena-debriefs')
@UseGuards(AuthGuard)
export class ArenaDebriefsController {
  constructor(
    @Inject(ArenaDebriefsService)
    private readonly debriefs: ArenaDebriefsService,
  ) {}
  @Post('facts') @HttpCode(200) @Header('Cache-Control', 'no-store') facts(
    @Body() body: unknown,
  ) {
    return calculateArenaFacts(body).facts;
  }
  @Post() @HttpCode(200) @Header('Cache-Control', 'no-store') review(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    return this.debriefs.review(req.username, body);
  }
}
