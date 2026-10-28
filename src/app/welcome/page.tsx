import { getOptionalCurrentUser } from "@/server/http";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

export default async function WelcomeLandingPage() {
  const user = await getOptionalCurrentUser();

  return (
    <LandingPage
      isAuthenticated={Boolean(user)}
      userEmail={user?.email}
    />
  );
}

