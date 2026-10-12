import { API_URL } from '@/features/auth/api-client';
import type { ClosedPos } from '@/features/account/types';
import { tradeReviewSnapshot, validateTradeReviewResponse, type TradeReviewResponse } from './trade-review-contract.ts';
export { tradeReviewSnapshot } from './trade-review-contract.ts';
export type { TradeReviewResponse } from './trade-review-contract.ts';
export async function fetchTradeReview(trade:ClosedPos,token:string,signal:AbortSignal):Promise<TradeReviewResponse> {
  const response=await fetch(`${API_URL}/trade-reviews`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify(tradeReviewSnapshot(trade)),signal,cache:'no-store',
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok) {
    if(response.status===401)throw new Error('Your session has expired. Sign in again to request a review.');
    if(response.status===429)throw new Error('Please wait a minute before requesting another new review.');
    throw new Error(typeof data?.message==='string'?data.message:'The review service is unavailable. Please try again.');
  }
  return validateTradeReviewResponse(data);
}
