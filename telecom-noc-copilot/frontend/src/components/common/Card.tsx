import type { ReactNode } from 'react'

interface CardProps {
  id?: string
  title?: string
  children: ReactNode
  className?: string
}

export function Card({ id, title, children, className }: CardProps) {
  const classes = ['card', className].filter(Boolean).join(' ')

  return (
    <section id={id} className={classes}>
      {title ? <h3 className="card__title">{title}</h3> : null}
      <div className="card__body">{children}</div>
    </section>
  )
}
