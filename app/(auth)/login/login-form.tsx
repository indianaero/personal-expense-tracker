'use client'
import { useState } from 'react'
import { signIn }   from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Divider,
  Link,
  Alert,
} from '@heroui/react'
import { LoginSchema } from '@/lib/schemas'

interface LoginFormProps {
  error?:       string
  callbackUrl?: string
  registered?:  boolean
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Invalid email or password.',
  Default:           'Something went wrong. Please try again.',
}

export function LoginForm({ error: urlError, callbackUrl, registered }: LoginFormProps) {
  const router = useRouter()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({})
  const [formError,    setFormError]    = useState<string | null>(
    urlError ? (ERROR_MESSAGES[urlError] ?? ERROR_MESSAGES.Default) : null
  )
  const [isPending,    setIsPending]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const result = LoginSchema.safeParse({ email, password })
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (!errors[key]) errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsPending(true)
    try {
      const res = await signIn('credentials', {
        email:    result.data.email,
        password: result.data.password,
        redirect: false,
      })

      if (res?.error) {
        setFormError(ERROR_MESSAGES.CredentialsSignin)
        return
      }

      router.push(callbackUrl ?? '/dashboard')
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="w-full max-w-sm" shadow="sm">
      <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-0">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-small text-default-500">
          to your Expense Tracker account
        </p>
      </CardHeader>

      <CardBody className="px-6 py-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {registered && (
            <Alert
              color="success"
              variant="flat"
              title="Account created!"
              description="You can now sign in with your new account."
            />
          )}
          {formError && (
            <Alert color="danger" variant="flat" title={formError} />
          )}

          <Input
            label="Email"
            name="email"
            type="email"
            variant="bordered"
            labelPlacement="outside"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onValueChange={setEmail}
            isRequired
            isInvalid={!!fieldErrors.email}
            errorMessage={fieldErrors.email}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            variant="bordered"
            labelPlacement="outside"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onValueChange={setPassword}
            isRequired
            isInvalid={!!fieldErrors.password}
            errorMessage={fieldErrors.password}
          />

          <Button
            type="submit"
            color="primary"
            fullWidth
            isLoading={isPending}
          >
            Sign in
          </Button>
        </form>
      </CardBody>

      <Divider />

      <CardFooter className="flex justify-center px-6 py-4">
        <p className="text-small text-default-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" size="sm">
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
