import { redirect } from 'next/navigation';
import { getClientByToken, getAuthedClientId } from '@/lib/portal';
import Viewer from './Viewer';

export const dynamic = 'force-dynamic';

export default async function ViewPage({ params }) {
  const { token } = params;
  const client = await getClientByToken(token);
  if (!client || client.archived) redirect(`/p/${token}`);
  if (getAuthedClientId() !== client.id) redirect(`/p/${token}`);
  return <Viewer token={token} />;
}
