import { LoginForm } from './login-form'

interface LoginPageProps {
  searchParams: { error?: string; callbackUrl?: string; registered?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <LoginForm
      error={searchParams.error}
      callbackUrl={searchParams.callbackUrl}
      registered={searchParams.registered === 'true'}
    />
  )
}
