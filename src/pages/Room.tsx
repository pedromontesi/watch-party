import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const location = useLocation()
  const isHost = location.state?.isHost === true

  const socketRef = useRef<Socket | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<Record<string, RTCPeerConnection>>({})
  const streamRef = useRef<MediaStream | null>(null)
  const [streaming, setStreaming] = useState(false)

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
      if (videoRef.current) {
        videoRef.current.srcObject = e.streams[0]
      }
    }

    return pc
  }, [])

  useEffect(() => {
    const socket = io('http://localhost:3001')
    socketRef.current = socket

    if (isHost) {
      socket.emit('join-as-host', roomId)
    } else {
      socket.emit('join-as-viewer', roomId)
    }

    socket.on('new-viewer', async (viewerId: string) => {
      const pc = createPeerConnection(viewerId)
      peersRef.current[viewerId] = pc

      // Se já tem stream, adiciona as tracks na nova conexão
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!))
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('signal', { to: viewerId, signal: offer })
    })

    socket.on('signal', async ({ from, signal }: { from: string; signal: RTCSessionDescriptionInit & RTCIceCandidateInit }) => {
      if (signal.type === 'offer') {
        const pc = createPeerConnection(from)
        peersRef.current[from] = pc
        await pc.setRemoteDescription(new RTCSessionDescription(signal))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('signal', { to: from, signal: answer })
      } else if (signal.type === 'answer') {
        await peersRef.current[from]?.setRemoteDescription(new RTCSessionDescription(signal))
      } else if (signal.candidate) {
        await peersRef.current[from]?.addIceCandidate(new RTCIceCandidate(signal))
      }
    })

    socket.on('host-disconnected', () => alert('O host encerrou a transmissão'))

    return () => { socket.disconnect() }
  }, [roomId, isHost, createPeerConnection])

  const startStream = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    if (videoRef.current) videoRef.current.srcObject = stream
    streamRef.current = stream
    setStreaming(true)

    for (const pc of Object.values(peersRef.current)) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
    }
  }

  return (
    <div>
      <h2>Sala: {roomId}</h2>
      <p>{isHost ? 'Você é o host' : 'Você é viewer'}</p>

      {isHost && !streaming && (
        <button onClick={startStream}>Compartilhar tela</button>
      )}

      <video ref={videoRef} autoPlay playsInline controls style={{ width: '100%', marginTop: 16 }} />

      <p>
        Link para convidar:{' '}
        <strong>{window.location.origin}/{roomId}</strong>
      </p>
    </div>
  )
}