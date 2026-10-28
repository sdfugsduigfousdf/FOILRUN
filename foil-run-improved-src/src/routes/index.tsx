import { createFileRoute } from "@tanstack/react-router";
import { FoilApp } from "@/components/foil-app";

export const Route = createFileRoute("/")({
  ssr: false,
  component: FoilApp,
});
