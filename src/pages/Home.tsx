import styles from "./Home.module.css"
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
    <div className={styles.container}>
      <h1>Watch Party</h1>
      <button className={styles.buttonCreate} onClick={createRoom}>Criar sala</button>
      <p>OU</p>
      <label htmlFor="code">Código da Sala</label>
      <input
      id="code"
        onChange={e => setCode(e.target.value)}
        className={styles.codeInput}
        placeholder="ex: kMprEW"
      />
      <button className={styles.joinButton} onClick={joinRoom}>Entrar</button>
    </div>
  )
}