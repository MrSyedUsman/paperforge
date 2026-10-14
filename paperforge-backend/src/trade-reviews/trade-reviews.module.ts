import { AiRequestBudget } from './ai-request-budget.js';
import { TradeRiskController } from '../trade-risk/trade-risk.controller.js';
import { TradeRiskService } from '../trade-risk/trade-risk.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GeminiReviewProvider } from './gemini-review.provider.js';
import { TradeReviewsController } from './trade-reviews.controller.js';
import { TradeReviewsService } from './trade-reviews.service.js';
@Module({imports:[AuthModule],controllers:[TradeReviewsController,TradeRiskController],providers:[GeminiReviewProvider,TradeReviewsService,TradeRiskService,AiRequestBudget]})
export class TradeReviewsModule {}
