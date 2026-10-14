import { ScreenBody } from '../../components/layout/AppShell'
import { ScreenHeader } from '../../components/layout/ScreenHeader'
import { cardClass } from '../../components/ui/styles'
import { PRIVACY_NOTICE_VERSION, PrivacyContent } from './PrivacyContent'

export function PrivacyScreen() {
  return (
    <div className="min-h-dvh">
      <ScreenHeader title="Privacidad" back="/" />
      <ScreenBody withTabBar={false}>
        <article className={cardClass}>
          <PrivacyContent />
        </article>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">Versión del aviso: {PRIVACY_NOTICE_VERSION}</p>
      </ScreenBody>
    </div>
  )
}
