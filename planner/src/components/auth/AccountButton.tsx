import { LogInIcon, LogOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAccount } from "@/hooks/useAccount"

export function AccountButton() {
  const account = useAccount()

  if (!account.configured || account.isLoading) return null

  if (!account.isSignedIn) {
    return (
      <Button variant="outline" size="sm" onClick={account.signIn}>
        <LogInIcon />
        Sign in
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {account.picture && <img src={account.picture} alt="" className="size-7 rounded-full" />}
      <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">
        {account.name ?? account.email}
      </span>
      <Button variant="ghost" size="icon" onClick={account.signOut} aria-label="Sign out">
        <LogOutIcon />
      </Button>
    </div>
  )
}
