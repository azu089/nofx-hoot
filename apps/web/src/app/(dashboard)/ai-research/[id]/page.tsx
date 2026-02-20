import { redirect } from 'next/navigation';

export default async function AiResearchDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/ai/research/${id}`);
}
