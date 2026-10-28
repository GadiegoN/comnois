import { redirect } from "next/navigation";
import { getOptionalCurrentUser } from "@/server/http";
import PlatformWorkspaceClient from "@/components/PlatformWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getOptionalCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <PlatformWorkspaceClient initialUser={user} />;
}

