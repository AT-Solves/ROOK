import { Suspense } from "react";

import { Loading } from "@/components/states";

import { CommitmentDetail } from "./commitment-detail";

export default function CommitmentPage({ params }: PageProps<"/commitments/[id]">) {
  return <Suspense fallback={<Loading />}>{params.then(({ id }) => <CommitmentDetail id={Number(id)} />)}</Suspense>;
}
