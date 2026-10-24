'use server';

import { signIn, signOut } from '@logto/next/server-actions';
import { getLogtoConfig } from './logto';

export async function signInAction() {
  await signIn(getLogtoConfig());
}

export async function signOutAction() {
  await signOut(getLogtoConfig());
}
