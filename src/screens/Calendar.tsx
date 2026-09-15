import AvatarMenu from '../components/AvatarMenu'

export default function Calendar() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Calendar</h1>
        <AvatarMenu />
      </header>
      <p className="pt-16 text-center text-ink-2">No days logged yet.</p>
    </div>
  )
}
