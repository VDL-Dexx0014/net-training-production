// src/app/signup/page.tsx
// Signup is disabled - redirect to login
import { redirect } from 'next/navigation'

export default function SignUpPage() {
  redirect('/login')
}
