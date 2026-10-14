import { API_URL } from '@/features/auth/api-client';
import { riskSnapshot, validateRiskFacts, validateRiskResponse, type RiskSnapshot } from './trade-risk-contract';
async function post(path: string, snapshot: RiskSnapshot, token: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${API_URL}/trade-risk${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(riskSnapshot(snapshot)), signal, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session has expired. Sign in again to check trade risk.');
    if (response.status === 429) throw new Error('Please wait a minute before requesting another new AI check.');
    throw new Error(typeof data?.message === 'string' ? data.message : 'The risk-check service is unavailable. Please try again.');
  }
  return data;
}
export async function fetchRiskFacts(snapshot: RiskSnapshot, token: string, signal: AbortSignal) { return validateRiskFacts(await post('/facts', snapshot, token, signal), snapshot); }
export async function fetchRiskReview(snapshot: RiskSnapshot, token: string, signal: AbortSignal) { return validateRiskResponse(await post('', snapshot, token, signal), snapshot); }
