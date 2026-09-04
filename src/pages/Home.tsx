import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  const createRoom = async () => {
    const res = await fetch('/create-room')
    const { roomId } = await res.json()
    navigate(`/${roomId}`, { state: { isHost: true } })
  }

  const joinRoom = () => {
    if (code.trim()) navigate(`/${code.trim()}`)
  }

  return (
    <div>
      <h1>Watch Party</h1>
      <button onClick={createRoom}>Criar sala</button>
      <hr />
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Código da sala"
      />
      <button onClick={joinRoom}>Entrar</button>
    </div>
  )
}