import { CommitmentDetail } from "@/components/uphold/CommitmentDetail";

export default async function CommitmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommitmentDetail commitmentId={decodeURIComponent(id)} />;
}
