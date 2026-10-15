import { Body, Controller, Header, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { calculateRiskFacts } from './risk-facts.js';
import { TradeRiskService } from './trade-risk.service.js';
@Controller('trade-risk')
@UseGuards(AuthGuard)
export class TradeRiskController {
  constructor(@Inject(TradeRiskService) private readonly risk: TradeRiskService) {}
  @Post('facts') @HttpCode(200) @Header('Cache-Control', 'no-store')
  facts(@Body() body: unknown) { return calculateRiskFacts(body); }
  @Post() @HttpCode(200) @Header('Cache-Control', 'no-store')
  review(@Req() request: AuthedRequest, @Body() body: unknown) { return this.risk.review(request.username, body); }
}
