import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

import styles from './Room.module.scss'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const location = useLocation()
  const isHost = location.state?.isHost === true

  const socketRef = useRef<Socket | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<Record<string, RTCPeerConnection>>({})
  const streamRef = useRef<MediaStream | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [needsSoundClick, setNeedsSoundClick] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDeviceId, setAudioDeviceId] = useState('') // '' = áudio da aba (getDisplayMedia)
  const [audioWarning, setAudioWarning] = useState('')

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('signal', { to: peerId, signal: e.candidate })
      }
    }

    pc.ontrack = (e) => {
      const video = videoRef.current
      if (!video) return
      video.srcObject = e.streams[0]
      // Autoplay com som costuma ser bloqueado pelo navegador sem clique do usuário
      video.play().catch(() => setNeedsSoundClick(true))
    }

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current?.emit('signal', { to: peerId, signal: offer })
      } catch (err) {
        console.error('Erro na renegociação:', err)
      }
    }

    return pc
  }, [])

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    if (isHost) {
      socket.emit('join-as-host', roomId)
    } else {
      socket.emit('join-as-viewer', roomId)
    }

    socket.on('new-viewer', async (viewerId: string) => {
      const pc = createPeerConnection(viewerId)
      peersRef.current[viewerId] = pc

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track =>
          pc.addTrack(track, streamRef.current!)
        )
      }
    })

    socket.on('signal', async ({ from, signal }: { from: string; signal: RTCSessionDescriptionInit & RTCIceCandidateInit }) => {
      let pc = peersRef.current[from]

      if (signal.type === 'offer') {
        if (!pc) {
          pc = createPeerConnection(from)
          peersRef.current[from] = pc
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('signal', { to: from, signal: answer })
      } else if (signal.type === 'answer') {
        await pc?.setRemoteDescription(new RTCSessionDescription(signal))
      } else if (signal.candidate) {
        await pc?.addIceCandidate(new RTCIceCandidate(signal))
      }
    })

    socket.on('host-disconnected', () => alert('O host encerrou a transmissão'))

    return () => { socket.disconnect() }
  }, [roomId, isHost, createPeerConnection])

  // Lista as fontes de áudio (no Linux, "Monitor of ..." = áudio do sistema)
  const loadAudioDevices = async () => {
    try {
      // precisa de permissão uma vez para os nomes (labels) aparecerem
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
      tmp.getTracks().forEach(t => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'))
    } catch (err) {
      console.error('Erro ao listar dispositivos de áudio:', err)
    }
  }

  const startStream = async () => {
    try {
      setAudioWarning('')

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      // Se o usuário escolheu uma fonte "Monitor", captura o áudio dela
      if (audioDeviceId) {
        const sysAudio = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: audioDeviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        })
        stream.getAudioTracks().forEach(t => { stream.removeTrack(t); t.stop() })
        sysAudio.getAudioTracks().forEach(t => stream.addTrack(t))
      }

      if (stream.getAudioTracks().length === 0) {
        setAudioWarning(
          'Nenhum áudio capturado. No Linux, o Chrome só captura áudio ao compartilhar uma ABA ' +
          '(marque "Compartilhar áudio da guia"). Para tela/janela, escolha uma fonte "Monitor" abaixo.'
        )
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true // evita eco/feedback no host
      }
      streamRef.current = stream
      setStreaming(true)

      for (const pc of Object.values(peersRef.current)) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream))
      }

      stream.getVideoTracks()[0].onended = () => {
        stream.getTracks().forEach(t => t.stop())
        setStreaming(false)
        streamRef.current = null
      }
    } catch (err) {
      console.error('Erro ao capturar tela:', err)
    }
  }

  const enableSound = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = false
    video.play().then(() => setNeedsSoundClick(false)).catch(console.error)
  }

  return (
    <div className={styles.container}>
      <h2>Sala: {roomId}</h2>
      <p>{isHost ? 'Você é o host' : 'Você é viewer'}</p>

      {isHost && !streaming && (
        <>
          <div style={{ marginBottom: 8 }}>
            <button onClick={loadAudioDevices}>Listar fontes de áudio</button>{' '}
            <select value={audioDeviceId} onChange={e => setAudioDeviceId(e.target.value)}>
              <option value="">Áudio da aba (padrão)</option>
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
              ))}
            </select>
          </div>
          <button className={styles.shareScreen} onClick={startStream}>Compartilhar tela</button>
        </>
      )}

      {isHost && streaming && (
        <p>Transmitindo</p>
      )}

      {audioWarning && <p style={{ color: 'orange' }}>{audioWarning}</p>}

      {!isHost && needsSoundClick && (
        <button onClick={enableSound}>Ativar som / iniciar vídeo</button>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        muted={isHost}
        style={{ width: '100%', marginTop: 16 }}
      />

      <p>
        Link para convidar:{' '}
        <strong>{window.location.origin}/{roomId}</strong>
      </p>
    </div>
  )
}
