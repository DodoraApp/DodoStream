import { simklRequest } from '@/api/simkl/client';
import type { SimklPinCodeResponse, SimklPinPollResponse } from '@/api/simkl/types';

export const simklCreatePin = async (): Promise<SimklPinCodeResponse> => {
    // GET /oauth/pin?client_id=...
    return simklRequest<SimklPinCodeResponse>('/oauth/pin');
};

export const simklPollPin = async (userCode: string): Promise<SimklPinPollResponse> => {
    // GET /oauth/pin/{USER_CODE}?client_id=...
    return simklRequest<SimklPinPollResponse>(`/oauth/pin/${encodeURIComponent(userCode)}`);
};
