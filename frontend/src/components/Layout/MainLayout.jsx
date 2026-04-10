import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import RightPanel from './RightPanel'
import { useState } from 'react'

export default function MainLayout() {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet context={{ rightPanelOpen, setRightPanelOpen }} />
      </main>

      {/* Right Settings Panel */}
      {rightPanelOpen && <RightPanel onClose={() => setRightPanelOpen(false)} />}
    </div>
  )
}
