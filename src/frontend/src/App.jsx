import { useSelector, useDispatch } from 'react-redux'
import './App.css'

function App() {
  const dispatch = useDispatch()
  const count = useSelector((state) => state.counter.value)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Team Lot of Opps</h1>
        <p>React + Vite + Redux Frontend</p>
      </header>
      <main className="app-main">
        <section className="welcome">
          <h2>Welcome</h2>
          <p>Your frontend is ready!</p>
        </section>
      </main>
    </div>
  )
}

export default App
