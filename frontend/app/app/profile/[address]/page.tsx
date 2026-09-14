import { RecordView } from "@/components/uphold/RecordView";

export default async function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <RecordView address={decodeURIComponent(address)} />;
}
