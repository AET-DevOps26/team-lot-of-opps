import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import SideNav from './SideNav'
import ChatFab from './ChatFab'
import SettingsModal from './SettingsModal'

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <TopBar />
      <SideNav />
      <main className="pt-16 md:pl-64 min-h-screen">
        <div className="max-w-container-max mx-auto w-full px-gutter py-lg">
          <Outlet />
        </div>
      </main>
      <ChatFab />
      <SettingsModal />
    </div>
  )
}
