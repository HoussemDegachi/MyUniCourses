import type { ReactNode } from "react"
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react"
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN, AUTH_CONFIGURED, GOOGLE_CALENDAR_SCOPE } from "@/config"
import { setTokenGetter } from "@/api/client"

// Auth0 handles sign-in. We ask for Google Calendar permission during that same
// consent screen, so there is only ever one prompt. The Google token stays with
// Auth0 and is read by the backend, never by this app.
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!AUTH_CONFIGURED) return <>{children}</>

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
        scope: `openid profile email ${GOOGLE_CALENDAR_SCOPE}`,
        connection_scope: GOOGLE_CALENDAR_SCOPE,
        access_type: "offline",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <TokenBridge>{children}</TokenBridge>
    </Auth0Provider>
  )
}

// Hands the API client a way to fetch the current access token.
function TokenBridge({ children }: { children: ReactNode }) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0()

  setTokenGetter(async () => {
    if (!isAuthenticated) return null
    try {
      return (await getAccessTokenSilently()) ?? null
    } catch {
      return null
    }
  })

  return <>{children}</>
}
