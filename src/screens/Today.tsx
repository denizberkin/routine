import { Link } from 'react-router-dom'

export default function Today() {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <p className="text-ink-2">Nothing planned yet.</p>
      <Link
        to="/plan"
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ground"
      >
        Add a plan
      </Link>
    </div>
  )
}
