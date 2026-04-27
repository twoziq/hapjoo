import InviteRedeemClient from './InviteRedeemClient';

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <InviteRedeemClient code={code} />
    </div>
  );
}
