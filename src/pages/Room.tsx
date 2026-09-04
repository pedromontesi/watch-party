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

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })

      if (videoRef.current) videoRef.current.srcObject = stream
      streamRef.current = stream
      setStreaming(true)

      for (const pc of Object.values(peersRef.current)) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream))
      }

      stream.getVideoTracks()[0].onended = () => {
        setStreaming(false)
        streamRef.current = null
      }
    } catch (err) {
      console.error('Erro ao capturar tela:', err)
    }
  }

  return (
    <div>
      <h2>Sala: {roomId}</h2>
      <p>{isHost ? 'Você é o host' : 'Você é viewer'}</p>

      {isHost && !streaming && (
        <button onClick={startStream}>Compartilhar tela</button>
      )}

      {isHost && streaming && (
        <p>✅ Transmitindo...</p>
      )}

      <video ref={videoRef} 
      autoPlay 
      playsInline 
      controls 
      style={{ width: '100%', marginTop: 16 }} />

      <p>
        Link para convidar:{' '}
        <strong>{window.location.origin}/{roomId}</strong>
      </p>
    </div>
  )
}
