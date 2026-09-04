import styles from "./Home.module.scss"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import logo from "/assets/logo.webp?url"
import phrasesData from '../../data/phrases.json'

const { phrases } = phrasesData

function randomPhrase() {
  return phrases[Math.floor(Math.random() * phrases.length)]
}

export default function Home() {
  const [code, setCode] = useState('')
  const [tagline] = useState(randomPhrase)
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
      <h1>Sardine Stream</h1>
      <img src={logo} alt="" />
      <p>{tagline}</p>
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
