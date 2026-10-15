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
import { calculateRadarFacts } from './radar-facts.js';
import { ArenaRadarService } from './arena-radar.service.js';
@Controller('arena-radar')
@UseGuards(AuthGuard)
export class ArenaRadarController {
  constructor(
    @Inject(ArenaRadarService) private readonly radar: ArenaRadarService,
  ) {}
  @Post('facts') @HttpCode(200) @Header('Cache-Control', 'no-store') facts(
    @Body() body: unknown,
  ) {
    return calculateRadarFacts(body).facts;
  }
  @Post() @HttpCode(200) @Header('Cache-Control', 'no-store') review(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    return this.radar.review(req.username, body);
  }
}
