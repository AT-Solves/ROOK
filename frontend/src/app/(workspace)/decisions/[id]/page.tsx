import { Suspense } from "react";

import { Loading } from "@/components/states";

import { DecisionDetail } from "./decision-detail";

export default function DecisionPage({ params }: PageProps<"/decisions/[id]">) {
  return <Suspense fallback={<Loading />}>{params.then(({ id }) => <DecisionDetail id={Number(id)} />)}</Suspense>;
}
