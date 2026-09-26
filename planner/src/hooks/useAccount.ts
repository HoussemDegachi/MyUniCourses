// One place for "is the user signed in", whether or not Auth0 is configured.
// Without Auth0 set up the app still runs, it just can't touch Google Calendar.
import { useAuth0 } from "@auth0/auth0-react"
import { AUTH_CONFIGURED } from "@/config"

export interface Account {
  configured: boolean
  isLoading: boolean
  isSignedIn: boolean
  name: string | null
  email: string | null
  picture: string | null
  signIn: () => void
  signOut: () => void
}

export function useAccount(): Account {
  // Safe to call unconditionally: without a provider the SDK returns its defaults.
  const auth = useAuth0()

  if (!AUTH_CONFIGURED) {
    return {
      configured: false,
      isLoading: false,
      isSignedIn: false,
      name: null,
      email: null,
      picture: null,
      signIn: () => {},
      signOut: () => {},
    }
  }

  return {
    configured: true,
    isLoading: auth.isLoading,
    isSignedIn: auth.isAuthenticated,
    name: auth.user?.name ?? null,
    email: auth.user?.email ?? null,
    picture: auth.user?.picture ?? null,
    signIn: () => auth.loginWithRedirect(),
    signOut: () => auth.logout({ logoutParams: { returnTo: window.location.origin } }),
  }
}
