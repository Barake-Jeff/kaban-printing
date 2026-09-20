import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * An AbortSignal that fires if the HTTP client goes away (tab closed, navigation, network
 * drop, fetch aborted) before the response has finished. Lets long-running handlers stop
 * work nobody is waiting for. Not fired on a normal completion.
 *
 * Listens on the response, not the request: since Node 16 the request's 'close' event
 * fires once its body has been read, not when the client disconnects.
 */
export const RequestAbortSignal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AbortSignal => {
    const res = ctx.switchToHttp().getResponse();
    const controller = new AbortController();
    const abortIfUnfinished = () => {
      if (!res.writableFinished) controller.abort();
    };

    // Params resolve after body parsing, so the client may already be gone.
    if (res.destroyed) abortIfUnfinished();
    else res.once('close', abortIfUnfinished);

    return controller.signal;
  },
);
