import { CommitmentTable } from "@/components/uphold/CommitmentTable";
import { PageHeader } from "@/components/uphold/ui";

export default function ExplorePage() { return <><PageHeader eyebrow="Explore" title="Commitments in the open." copy="Browse bounded protocol reads and follow the evidence history behind each bond." /><CommitmentTable /></>; }
