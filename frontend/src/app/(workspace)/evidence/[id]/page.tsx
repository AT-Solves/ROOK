import { Suspense } from "react";

import { Loading } from "@/components/states";

import { EvidenceDetail } from "./evidence-detail";

export default function EvidencePage({ params }: PageProps<"/evidence/[id]">) {
  return <Suspense fallback={<Loading />}>{params.then(({ id }) => <EvidenceDetail id={Number(id)} />)}</Suspense>;
}
