import { Suspense } from "react";

import { Loading } from "@/components/states";

import { MeetingDetail } from "./meeting-detail";

export default function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  return (
    <Suspense fallback={<Loading stage="Preparing" what="ROOK is preparing this meeting's context." />}>
      {params.then(({ id }) => <MeetingDetail id={Number(id)} />)}
    </Suspense>
  );
}
