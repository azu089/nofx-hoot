import { redirect } from 'next/navigation';

export default async function AiTradingDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/ai/strategy/${id}`);
}
