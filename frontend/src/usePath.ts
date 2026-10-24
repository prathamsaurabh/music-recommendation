import { useEffect, useState } from 'react'

export function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to: string) => {
    if (to === window.location.pathname) return
    window.history.pushState(null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }

  return [path, navigate] as const
}
