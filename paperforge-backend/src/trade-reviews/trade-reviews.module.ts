import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GeminiReviewProvider } from './gemini-review.provider.js';
import { TradeReviewsController } from './trade-reviews.controller.js';
import { TradeReviewsService } from './trade-reviews.service.js';
@Module({imports:[AuthModule],controllers:[TradeReviewsController],providers:[GeminiReviewProvider,TradeReviewsService]})
export class TradeReviewsModule {}
