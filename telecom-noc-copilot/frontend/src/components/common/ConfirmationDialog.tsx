import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/common/Button'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
  comment?: {
    label: string
    value: string
    onChange: (value: string) => void
    required?: boolean
    placeholder?: string
  }
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  comment,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const messageId = useId()
  const commentId = useId()
  const commentMissing = Boolean(comment?.required && !comment.value.trim())
  const confirmDisabled = busy || commentMissing
  const hasComment = Boolean(comment)

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (hasComment) {
      commentRef.current?.focus()
    } else {
      cancelRef.current?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busy) onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open, onCancel, hasComment, busy])

  if (!open) return null

  return (
    <div className="dialog-backdrop" onMouseDown={() => { if (!busy) onCancel() }}>
      <div
        ref={dialogRef}
        className={comment ? 'dialog dialog--wide' : 'dialog'}
        role={comment ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        aria-busy={busy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
        </header>
        <p id={messageId} className="dialog__body">
          {message}
        </p>
        {comment ? (
          <div className="dialog__comment">
            <label htmlFor={commentId}>
              {comment.label}
              {comment.required ? ' (required)' : ' (optional)'}
            </label>
            <textarea
              ref={commentRef}
              id={commentId}
              rows={4}
              value={comment.value}
              placeholder={comment.placeholder}
              disabled={busy}
              onChange={(event) => comment.onChange(event.target.value)}
            />
          </div>
        ) : null}
        <div className="dialog__actions">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
