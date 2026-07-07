import { redirect } from 'next/navigation';
import { getClientByToken, getAuthedClientId } from '@/lib/portal';
import Uploader from './Uploader';

export const dynamic = 'force-dynamic';

export default async function UploadPage({ params }) {
  const { token } = params;
  const client = await getClientByToken(token);
  if (!client || client.archived) redirect(`/p/${token}`);
  if (getAuthedClientId() !== client.id) redirect(`/p/${token}`);
  return <Uploader token={token} />;
}
