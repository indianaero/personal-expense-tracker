'use client'
import { useActionState, useState } from 'react'
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Button,
  Divider,
  Alert,
  User,
  Chip,
  addToast,
} from '@heroui/react'
import { useTheme } from 'next-themes'
import { updateProfileAction, updateCurrencyAction } from '@/lib/actions/user'
import { UpdateUserSchema } from '@/lib/schemas/user'

interface Props {
  name: string
  email: string
  currency: string
}

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
]

const THEMES = [
  { key: 'system', label: 'System' },
  { key: 'light',  label: 'Light' },
  { key: 'dark',   label: 'Dark' },
]

const initialState = { status: 'idle' } as const

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileCard({ name, email }: { name: string; email: string }) {
  const [state, dispatch, isPending] = useActionState(updateProfileAction, initialState)
  const [nameValue, setNameValue] = useState(name)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  if (state.status === 'success') {
    addToast({ title: 'Profile updated', color: 'success', timeout: 3000 })
  }

  const serverFieldErrors =
    state.status === 'error' && state.fields
      ? Object.fromEntries(Object.entries(state.fields).map(([k, v]) => [k, v[0]]))
      : {}
  const fieldErrors = Object.keys(serverFieldErrors).length > 0 ? serverFieldErrors : clientErrors
  const formError = state.status === 'error' && !state.fields ? state.error : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientErrors({})

    const result = UpdateUserSchema.pick({ name: true }).safeParse({ name: nameValue })
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (!errors[key]) errors[key] = issue.message
      }
      setClientErrors(errors)
      return
    }

    dispatch({ name: result.data.name! })
  }

  return (
    <Card shadow="sm">
      <CardHeader>
        <span className="font-semibold">Profile</span>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <User
          name={name}
          description={email}
          avatarProps={{ name: name?.[0]?.toUpperCase() ?? 'U', size: 'md' }}
        />
        <Divider />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {formError && (
            <Alert color="danger" variant="flat" title={formError} />
          )}
          <Input
            label="Display Name"
            variant="bordered"
            labelPlacement="outside"
            value={nameValue}
            onValueChange={setNameValue}
            isInvalid={!!fieldErrors.name}
            errorMessage={fieldErrors.name}
          />
          <Input
            label="Email"
            variant="bordered"
            labelPlacement="outside"
            value={email}
            isReadOnly
            description="Email cannot be changed."
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              color="primary"
              size="sm"
              isLoading={isPending}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesCard({ currency }: { currency: string }) {
  const [currencyState, dispatchCurrency, isCurrencyPending] = useActionState(
    updateCurrencyAction,
    initialState,
  )
  const [selectedCurrency, setSelectedCurrency] = useState(currency)
  const { resolvedTheme, setTheme } = useTheme()

  if (currencyState.status === 'success') {
    addToast({ title: 'Preferences updated', color: 'success', timeout: 3000 })
  }

  const currencyError =
    currencyState.status === 'error' ? currencyState.error : null

  function handleCurrencySubmit(e: React.FormEvent) {
    e.preventDefault()
    dispatchCurrency({ currency: selectedCurrency })
  }

  return (
    <Card shadow="sm">
      <CardHeader>
        <span className="font-semibold">Preferences</span>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {/* Currency */}
        <form onSubmit={handleCurrencySubmit} className="flex flex-col gap-4" noValidate>
          {currencyError && (
            <Alert color="danger" variant="flat" title={currencyError} />
          )}
          <Select
            label="Currency"
            variant="bordered"
            labelPlacement="outside"
            selectedKeys={new Set([selectedCurrency])}
            onSelectionChange={(keys) => {
              const key = Array.from(keys as Set<string>)[0]
              if (key) setSelectedCurrency(key)
            }}
          >
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code}>{c.label}</SelectItem>
            ))}
          </Select>
          <div className="flex justify-end">
            <Button
              type="submit"
              color="primary"
              size="sm"
              isLoading={isCurrencyPending}
            >
              Save Currency
            </Button>
          </div>
        </form>

        <Divider />

        {/* Theme — client only */}
        <Select
          label="Theme"
          variant="bordered"
          labelPlacement="outside"
          selectedKeys={new Set([resolvedTheme ?? 'system'])}
          onSelectionChange={(keys) => {
            const key = Array.from(keys as Set<string>)[0]
            if (key) setTheme(key)
          }}
        >
          {THEMES.map((t) => (
            <SelectItem key={t.key}>{t.label}</SelectItem>
          ))}
        </Select>
      </CardBody>
    </Card>
  )
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function DangerZoneCard() {
  return (
    <Card shadow="sm" className="border border-danger-200">
      <CardHeader>
        <span className="font-semibold text-danger">Danger Zone</span>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        <p className="text-sm text-default-500">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <div className="flex items-center gap-3 mt-1">
          <Button color="danger" variant="bordered" size="sm" isDisabled>
            Delete Account
          </Button>
          <Chip size="sm" variant="flat" color="warning">Coming soon</Chip>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export function SettingsView({ name, email, currency }: Props) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-default-400 text-sm">Manage your profile and preferences</p>
      </div>
      <ProfileCard name={name} email={email} />
      <PreferencesCard currency={currency} />
      <DangerZoneCard />
    </div>
  )
}
