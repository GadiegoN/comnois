import { getOptionalCurrentUser } from "@/server/http";
import PlatformWorkspaceClient from "@/components/PlatformWorkspaceClient";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams?: Promise<{ view?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getOptionalCurrentUser();
  const params = searchParams ? await searchParams : {};

  if (!user || params.view === "landing") {
    return (
      <LandingPage
        isAuthenticated={Boolean(user)}
        userEmail={user?.email}
      />
    );
  }

  return <PlatformWorkspaceClient initialUser={user} />;
}
