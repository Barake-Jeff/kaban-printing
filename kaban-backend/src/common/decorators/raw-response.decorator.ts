import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Skips TransformInterceptor's `{ statusCode, message, data }` wrapper for one handler.
 * Only for responses whose exact shape a third party dictates (e.g. the Daraja callback ack).
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
