import { auth } from '@/app/lib/auth'
import { LogTab } from '@/components/LogTab'
import { LandingPage } from '@/components/LandingPage'

export default async function Home() {
  const session = await auth()
  if (session?.user) return <LogTab />
  return <LandingPage />
}
