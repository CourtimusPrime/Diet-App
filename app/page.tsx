import { auth } from '@/app/lib/auth'
import { ChatInterface } from '@/components/ChatInterface'
import { LandingPage } from '@/components/LandingPage'

export default async function Home() {
  const session = await auth()
  if (session?.user) return <ChatInterface />
  return <LandingPage />
}
