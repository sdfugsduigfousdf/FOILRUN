import { createFileRoute } from "@tanstack/react-router";
import { handleLobbies } from "@/lib/multiplayer/lobbies.server";

const handle = ({ request }: { request: Request }) => handleLobbies(request);

export const Route = createFileRoute("/api/lobbies")({
  server: { handlers: { GET: handle, POST: handle } },
});
