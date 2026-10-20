interface HighlightedTextProps {
  text: string
  terms: string[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function HighlightedText({ text, terms }: HighlightedTextProps) {
  const usable = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2))]
  if (usable.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${usable.map(escapeRegExp).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, index) => {
        const match = usable.some((term) => term.toLowerCase() === part.toLowerCase())
        return match ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>
      })}
    </>
  )
}
