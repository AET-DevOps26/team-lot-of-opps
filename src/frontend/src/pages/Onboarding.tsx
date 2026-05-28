import GoogleSignInButton from '../components/GoogleSignInButton'
import Icon from '../components/Icon'
import useT from '../i18n/useT'
import { useAppDispatch } from '../store/hooks'
import { signedIn } from '../features/authSlice'
import type { AuthUser } from '../features/authSlice'
import { useAppSelector } from '../store/hooks'
import { selectAuthLoading } from '../features/authSlice'

interface FeatureCardProps {
  icon: string
  title: string
  body: string
}

function FeatureCard({ icon, title, body }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
        <Icon name={icon} />
      </div>
      <h3 className="text-h3 font-semibold text-slate-900">{title}</h3>
      <p className="text-body-sm text-slate-600 mt-2">{body}</p>
    </div>
  )
}

const IS_DEV = import.meta.env.VITE_DEV_AUTO_LOGIN === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function DevLoginButton() {
  const dispatch = useAppDispatch()

  async function handleDevLogin() {
    const res = await fetch(`${API_BASE}/api/auth/dev-login`)
    if (!res.ok) return
    const data = await res.json() as { token: string; sub: string; email: string; name: string; picture?: string }
    const user: AuthUser = { sub: data.sub, email: data.email, name: data.name, picture: data.picture }
    dispatch(signedIn({ user, token: data.token }))
  }

  return (
    <button
      onClick={handleDevLogin}
      className="mt-2 text-xs text-slate-400 underline hover:text-slate-600"
    >
      Dev login (Alice)
    </button>
  )
}

export default function Onboarding() {
  const t = useT()
  const loading = useAppSelector(selectAuthLoading)

  return (
    <div className="max-w-3xl mx-auto py-xl">
      <section className="text-center">
        <p className="text-label-caps uppercase text-blue-700 mb-3">
          {t('onboarding.eyebrow')}
        </p>
        <h1 className="text-h1 font-extrabold text-slate-900">{t('onboarding.title')}</h1>
        <p className="text-body-lg text-slate-600 mt-4">{t('onboarding.subtitle')}</p>
        <div className="mt-8 flex justify-center">
          {loading ? (
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="mt-4 text-lg font-medium text-slate-900">{t('auth.signingIn')}</p>
            </div>
          ) : (
            <GoogleSignInButton size="lg" />
          )}
        </div>
        <p className="text-xs text-slate-500 mt-3">{t('onboarding.signInHint')}</p>
        {IS_DEV && <DevLoginButton />}
      </section>

      <section className="mt-xl grid gap-md md:grid-cols-3">
        <FeatureCard
          icon="upload_file"
          title={t('onboarding.features.upload.title')}
          body={t('onboarding.features.upload.body')}
        />
        <FeatureCard
          icon="auto_awesome"
          title={t('onboarding.features.ai.title')}
          body={t('onboarding.features.ai.body')}
        />
        <FeatureCard
          icon="savings"
          title={t('onboarding.features.savings.title')}
          body={t('onboarding.features.savings.body')}
        />
      </section>
    </div>
  )
}
