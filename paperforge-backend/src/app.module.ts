import { TradeReviewsModule } from './trade-reviews/trade-reviews.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { FirebaseModule } from './firebase/firebase.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, UsersModule, AuthModule, TradeReviewsModule],
})
export class AppModule {}
