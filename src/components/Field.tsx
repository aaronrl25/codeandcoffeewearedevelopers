import { forwardRef, useId, type InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className = '', ...inputProps },
  ref,
) {
  const generatedId = useId()
  const id = inputProps.id ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}
        {inputProps.required && (
          <span className="ml-1 text-brand-crimson-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-brand-grey">
          {hint}
        </p>
      )}

      <input
        {...inputProps}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          'mt-2 block w-full rounded-lg border bg-surface px-3 py-2.5 text-base text-brand-navy',
          'placeholder:text-brand-grey/70 transition-colors',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70',
          error
            ? 'border-brand-crimson focus:border-brand-crimson'
            : 'border-surface-line hover:border-brand-grey/60 focus:border-brand-blue',
        ].join(' ')}
      />

      {error && (
        <p
          id={errorId}
          className="mt-2 flex items-start gap-1.5 text-sm font-medium text-brand-crimson-ink"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})
