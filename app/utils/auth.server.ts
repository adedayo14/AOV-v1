import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Enhanced authentication wrapper that provides better session handling
 */
export async function enhancedAuthenticate(request: Request) {
  try {
    const result = await authenticate.admin(request);
    return result;
  } catch (error) {
    // If it's a session-related error, provide a more user-friendly response
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as { message: string }).message;
      
      if (errorMessage.includes('session') || errorMessage.includes('auth')) {
        // For API calls, return JSON error
        if (request.headers.get('accept')?.includes('application/json')) {
          throw json(
            { 
              error: 'Session expired', 
              message: 'Your session has expired. Please refresh the page.',
              needsRefresh: true 
            }, 
            { status: 401 }
          );
        }
        
        // For page loads, redirect to re-auth
        const url = new URL(request.url);
        throw redirect(`/auth/login?shop=${url.searchParams.get('shop') || ''}`);
      }
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Wrapper for loaders that need authentication
 */
export function withAuth<T>(loader: (args: Parameters<LoaderFunction>[0] & { auth: Awaited<ReturnType<typeof authenticate.admin>> }) => T) {
  return async (args: Parameters<LoaderFunction>[0]) => {
    const auth = await enhancedAuthenticate(args.request);
    return loader({ ...args, auth });
  };
}

/**
 * Wrapper for actions that need authentication
 */
export function withAuthAction<T>(action: (args: Parameters<ActionFunction>[0] & { auth: Awaited<ReturnType<typeof authenticate.admin>> }) => T) {
  return async (args: Parameters<ActionFunction>[0]) => {
    const auth = await enhancedAuthenticate(args.request);
    return action({ ...args, auth });
  };
}
