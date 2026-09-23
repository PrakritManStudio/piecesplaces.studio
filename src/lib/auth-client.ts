import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export async function signInWithGoogle(callbackURL = "/") {
  return authClient.signIn.social({
    provider: "google",
    callbackURL,
  });
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  callbackURL = "/jobs",
) {
  return authClient.signIn.email({
    email,
    password,
    callbackURL,
  });
}
