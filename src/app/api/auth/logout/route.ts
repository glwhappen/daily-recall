import { NextResponse } from 'next/server';
import { capabilities } from '@/server/config';
import { destroySession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (capabilities().auth) {
    await destroySession();
  }
  return NextResponse.json({ ok: true });
}
