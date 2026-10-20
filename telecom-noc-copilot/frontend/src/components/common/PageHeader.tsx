import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  headingLevel?: 1 | 2
}

export function PageHeader({ title, description, actions, headingLevel = 2 }: PageHeaderProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  return (
    <header className="page-header">
      <div className="page-header__text">
        <Heading className="page-header__title">{title}</Heading>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
