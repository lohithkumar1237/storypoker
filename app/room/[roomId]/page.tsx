"use client";

import dynamic from "next/dynamic";
import { use } from "react";

// Room state comes from sessionStorage and the socket, so there is nothing
// useful to render on the server.
const RoomClient = dynamic(() => import("@/src/components/RoomClient"), {
  ssr: false,
  loading: () => <p className="pt-16 text-center text-slate-500">Loading room…</p>,
});

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return <RoomClient roomId={roomId} />;
}
