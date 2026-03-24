'use client'
import { useActionState, useEffect } from 'react'
import { useRouter }                 from 'next/navigation'
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
import { registerAction } from '@/lib/actions/register'

const initialState = { status: 'idle' } as const

export function RegisterForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(registerAction, initialState)

  useEffect(() => {
    if (state.status === 'success') {
      const timer = setTimeout(() => {
        router.push('/login?registered=true')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [state, router])

  const fieldErrors = state.status === 'error' ? (state.fields ?? {}) : {}
  const formError   = state.status === 'error' ? state.error : null
  const isSuccess   = state.status === 'success'

  return (
    <Card className="w-full max-w-sm" shadow="sm">
      <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-0">
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="text-small text-default-500">
          Start tracking your expenses today
        </p>
      </CardHeader>

      <CardBody className="px-6 py-4">
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {isSuccess && (
            <Alert
              color="success"
              variant="flat"
              title="Account created successfully!"
              description="Redirecting you to sign in…"
            />
          )}
          {formError && (
            <Alert color="danger" variant="flat" title={formError} />
          )}

          <Input
            label="Name"
            name="name"
            type="text"
            variant="bordered"
            labelPlacement="outside"
            placeholder="Your full name"
            autoComplete="name"
            isRequired
            isInvalid={!!fieldErrors.name}
            errorMessage={fieldErrors.name?.[0]}
          />

          <Input
            label="Email"
            name="email"
            type="email"
            variant="bordered"
            labelPlacement="outside"
            placeholder="you@example.com"
            autoComplete="email"
            isRequired
            isInvalid={!!fieldErrors.email}
            errorMessage={fieldErrors.email?.[0]}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            variant="bordered"
            labelPlacement="outside"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            isRequired
            isInvalid={!!fieldErrors.password}
            errorMessage={fieldErrors.password?.[0]}
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            variant="bordered"
            labelPlacement="outside"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            isRequired
            isInvalid={!!fieldErrors.confirmPassword}
            errorMessage={fieldErrors.confirmPassword?.[0]}
          />

          <Button
            type="submit"
            color="primary"
            fullWidth
            isLoading={isPending}
            isDisabled={isSuccess}
          >
            Create account
          </Button>
        </form>
      </CardBody>

      <Divider />

      <CardFooter className="flex justify-center px-6 py-4">
        <p className="text-small text-default-500">
          Already have an account?{' '}
          <Link href="/login" size="sm">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
