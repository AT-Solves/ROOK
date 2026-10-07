import { Suspense } from "react";

import { Loading } from "@/components/states";

import { RiskDetail } from "./risk-detail";

export default function RiskPage({ params }: PageProps<"/risks/[id]">) {
  return <Suspense fallback={<Loading stage="Analyzing" />}>{params.then(({ id }) => <RiskDetail id={Number(id)} />)}</Suspense>;
}
