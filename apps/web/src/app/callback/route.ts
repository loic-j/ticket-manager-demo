import { handleSignIn } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { connection, type NextRequest } from 'next/server';
import { getLogtoConfig } from '@/lib/logto';

/** OIDC redirect URI registered in Logto: exchanges the code and stores the session cookie. */
export async function GET(request: NextRequest) {
  // Never prerendered: this handler only makes sense for a live request from Logto.
  await connection();

  let signedIn = true;
  try {
    await handleSignIn(getLogtoConfig(), request.nextUrl.searchParams);
  } catch (error) {
    console.error('Logto sign-in callback failed', error);
    signedIn = false;
  }
  // redirect() throws, so it must stay outside the try block.
  redirect(signedIn ? '/' : '/?error=sign-in');
}
