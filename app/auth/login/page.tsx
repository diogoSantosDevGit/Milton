import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={
        <div className="w-full max-w-md">
          <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}