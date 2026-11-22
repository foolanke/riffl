// Hint pill (design.md 4.1), bottom centre of the camera. Raised above the
// piano overlay when that is showing.
export function HintPill(props: { text: string; raised: boolean }) {
  return (
    <div className={'hint-pill' + (props.raised ? ' is-raised' : '')}>
      <span className="text-label color-muted">{props.text}</span>
    </div>
  )
}
