import { Body, Controller, Header, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { TradeReviewsService } from './trade-reviews.service.js';
@Controller('trade-reviews')
@UseGuards(AuthGuard)
export class TradeReviewsController {
  constructor(@Inject(TradeReviewsService) private readonly reviews:TradeReviewsService) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control','no-store')
  review(@Req() request:AuthedRequest,@Body() body:unknown){return this.reviews.review(request.username,body);}
}
