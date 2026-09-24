import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { STAFF_HOME } from "@/lib/staff-paths";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export async function signInWithGoogle(callbackURL = STAFF_HOME) {
  return authClient.signIn.social({
    provider: "google",
    callbackURL,
  });
}
