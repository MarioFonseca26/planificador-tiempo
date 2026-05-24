import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || (window.location.origin.includes('localhost') ? 'http://localhost:8000/api' : 'https://planificador-tiempo-production.up.railway.app/api');


function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token') || null)
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('auth_user')) || null)

  // Vista Auth (login únicamente, registro bloqueado)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [authError, setAuthError] = useState(null)

  // Proyectos
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  
  // Sidebar móvil
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Formularios Proyectos
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [showProjForm, setShowProjForm] = useState(false)
  
  // Formularios Tareas
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  
  // Cronómetro
  const [time, setTime] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)

  // Drag and Drop State
  const [draggedOverCol, setDraggedOverCol] = useState(null)

  // Modales
  const [selectedTaskForModal, setSelectedTaskForModal] = useState(null) // Para ver detalle
  
  // Modal de Comentario
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [timerComment, setTimerComment] = useState('')
  const [pendingLogData, setPendingLogData] = useState(null)

  // Cargar proyectos únicamente si el usuario está autenticado
  useEffect(() => {
    if (token) {
      fetchProjects()
    }
  }, [token])

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  const handleAuthError = (status) => {
    if (status === 401) {
      handleLogoutLocal()
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: getHeaders()
      })
      if (res.status === 401) {
        handleAuthError(res.status)
        return
      }
      const data = await res.json()
      setProjects(data)
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0].id)
      }
    } catch (err) {
      console.error("Error al cargar proyectos:", err)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError(null)
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Error al iniciar sesión.")
      }
      saveSession(data.token, data.user)
    } catch (err) {
      setAuthError(err.message)
    }
  }

  const saveSession = (authToken, authUser) => {
    localStorage.setItem('auth_token', authToken)
    localStorage.setItem('auth_user', JSON.stringify(authUser))
    setToken(authToken)
    setUser(authUser)
    setAuthEmail('')
    setAuthPassword('')
    setAuthName('')
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthError(null)
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Error al registrarse.")
      }
      saveSession(data.token, data.user)
    } catch (err) {
      setAuthError(err.message)
    }
  }

  const handleLogoutLocal = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
    setProjects([])
    setActiveProjectId(null)
    setIsActive(false)
    setActiveTaskId(null)
    setTime(0)
    setSelectedTaskForModal(null)
    setSidebarOpen(false)
  }

  const handleLogoutServer = async () => {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: getHeaders()
      })
    } catch (err) {
      console.error("Error al cerrar sesión en servidor:", err)
    } finally {
      handleLogoutLocal()
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newProjectName, description: newProjectDesc })
      })
      if (res.status === 401) return handleAuthError(res.status)
      const data = await res.json()
      setProjects([...projects, data])
      setActiveProjectId(data.id)
      setNewProjectName('')
      setNewProjectDesc('')
      setShowProjForm(false)
      setSidebarOpen(false) // Cerrar sidebar en móvil tras crear
    } catch (err) {
      console.error("Error al crear proyecto:", err)
    }
  }

  const handleDeleteProject = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este proyecto y todas sus tareas?")) return
    try {
      const res = await fetch(`${API_URL}/projects/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      })
      if (res.status === 401) return handleAuthError(res.status)
      
      const updated = projects.filter(p => p.id !== id)
      setProjects(updated)
      if (activeProjectId === id) {
        setActiveProjectId(updated.length > 0 ? updated[0].id : null)
      }
    } catch (err) {
      console.error("Error al eliminar proyecto:", err)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !activeProjectId) return

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          project_id: activeProjectId,
          title: newTaskTitle,
          description: newTaskDesc,
          status: 'tarea'
        })
      })
      if (res.status === 401) return handleAuthError(res.status)
      const data = await res.json()
      
      setProjects(projects.map(p => {
        if (p.id === activeProjectId) {
          return { ...p, tasks: [...p.tasks, data] }
        }
        return p
      }))
      
      setNewTaskTitle('')
      setNewTaskDesc('')
    } catch (err) {
      console.error("Error al crear tarea:", err)
    }
  }

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      })
      if (res.status === 401) return handleAuthError(res.status)
      const updatedTask = await res.json()

      setProjects(projects.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: updatedTask.status } : t)
          }
        }
        return p
      }))

      if (selectedTaskForModal && selectedTaskForModal.id === taskId) {
        setSelectedTaskForModal({ ...selectedTaskForModal, status: updatedTask.status })
      }
    } catch (err) {
      console.error("Error al mover tarea:", err)
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm("¿Deseas eliminar esta tarea?")) return
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, { 
        method: 'DELETE',
        headers: getHeaders()
      })
      if (res.status === 401) return handleAuthError(res.status)

      setProjects(projects.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            tasks: p.tasks.filter(t => t.id !== taskId)
          }
        }
        return p
      }))
      if (activeTaskId === taskId) {
        setIsActive(false)
        setActiveTaskId(null)
        setTime(0)
      }
      if (selectedTaskForModal && selectedTaskForModal.id === taskId) {
        setSelectedTaskForModal(null)
      }
    } catch (err) {
      console.error("Error al eliminar tarea:", err)
    }
  }

  // NATIVE DRAG AND DROP
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e, colId) => {
    e.preventDefault()
    setDraggedOverCol(colId)
  }

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (taskId) {
      handleUpdateTaskStatus(taskId, targetStatus)
    }
    setDraggedOverCol(null)
  }

  // CRONÓMETRO
  useEffect(() => {
    if (isActive) {
      startTimeRef.current = new Date()
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isActive])

  const selectTaskForTimer = (task) => {
    if (isActive) {
      alert("Pausa o detén el cronómetro activo primero.")
      return
    }
    setActiveTaskId(task.id)
    setTime(task.time_logged)
  }

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const triggerSaveTimeFlow = (pauseInsteadOfStop) => {
    if (!activeTaskId) return
    const activeProject = projects.find(p => p.id === activeProjectId)
    const task = activeProject?.tasks.find(t => t.id === activeTaskId)
    if (!task) return

    const secondsAdded = time - task.time_logged
    if (secondsAdded < 0) return

    setPendingLogData({
      taskId: activeTaskId,
      seconds: secondsAdded,
      pauseInsteadOfStop: pauseInsteadOfStop
    })
    
    setIsActive(false)
    setTimerComment('')
    setShowCommentModal(true)
  }

  const submitLoggedTimeWithComment = async (e) => {
    e.preventDefault()
    if (!pendingLogData) return

    const { taskId, seconds, pauseInsteadOfStop } = pendingLogData

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/log-time`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          seconds: seconds,
          start_time: startTimeRef.current?.toISOString(),
          end_time: new Date().toISOString(),
          comment: timerComment.trim() || 'Avance sin descripción'
        })
      })
      if (res.status === 401) return handleAuthError(res.status)
      const data = await res.json()
      
      setProjects(projects.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            tasks: p.tasks.map(t => t.id === taskId ? data.task : t)
          }
        }
        return p
      }))

      if (selectedTaskForModal && selectedTaskForModal.id === taskId) {
        setSelectedTaskForModal(data.task)
      }

      if (pauseInsteadOfStop) {
        setTime(data.task.time_logged)
      } else {
        setActiveTaskId(null)
        setTime(0)
      }

      setShowCommentModal(false)
      setPendingLogData(null)
    } catch (err) {
      console.error("Error al registrar tiempo:", err)
    }
  }

  const activeProject = projects.find(p => p.id === activeProjectId)
  const activeProjectTasks = activeProject?.tasks || []
  
  const columns = [
    { id: 'tarea', name: 'Tareas / Backlog' },
    { id: 'pendiente', name: 'Pendiente' },
    { id: 'en_proceso', name: 'En Proceso' },
    { id: 'finalizado', name: 'Finalizado' }
  ]

  const activeTask = activeProjectTasks.find(t => t.id === activeTaskId)

  // ==================== PANTALLA DE ACCESO (INICIO DE SESIÓN ÚNICAMENTE) ====================
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', padding: '1rem', background: '#050505' }}>
        <div className="panel" style={{ width: '450px', maxWidth: '100%', padding: '2.5rem', border: '2px solid var(--neon-cyan)', boxShadow: '0 0 40px rgba(0, 255, 204, 0.15)', background: '#111', position: 'relative' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ color: 'var(--neon-orange)', fontSize: '0.85rem', fontWeight: 'bold' }}>// SECURE_GATE_V1.3</span>
            <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0 0 0', color: '#fff', letterSpacing: '-2px' }}>
              TIME<span style={{ color: 'var(--neon-orange)' }}>_CORE</span>
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>ACCESO RESTRINGIDO // SOLO OPERADORES AUTORIZADOS</p>
          </div>

          <div style={{ border: '2px solid var(--neon-cyan)', padding: '0.5rem', color: 'var(--neon-cyan)', textAlign: 'center', fontWeight: 'bold', marginBottom: '2rem', fontSize: '1rem', textTransform: 'uppercase' }}>
            [ {isRegistering ? 'REGISTRAR NUEVO OPERADOR' : 'INICIAR SESIÓN'} ]
          </div>

          {authError && (
            <div className="panel" style={{ padding: '0.8rem', background: 'rgba(255, 51, 0, 0.05)', borderColor: 'var(--neon-orange)', color: 'var(--neon-orange)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              ERROR_SYS: {authError}
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {isRegistering && (
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>OPERADOR_NOMBRE</label>
                <input 
                  type="text" 
                  placeholder="NOMBRE" 
                  value={authName} 
                  onChange={e => setAuthName(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit', outline: 'none' }}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>OPERADOR_EMAIL</label>
              <input 
                type="email" 
                placeholder="INGRESE SU EMAIL" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit', outline: 'none' }}
                required
                spellcheck="true"
                lang="es"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>LLAVE_ACCESO (CLAVE)</label>
              <input 
                type="password" 
                placeholder="•••••" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit', outline: 'none' }}
                required
              />
            </div>

            <button className="btn-brutal" type="submit" style={{ width: '100%', marginTop: '1rem', fontSize: '1.1rem' }}>
              {isRegistering ? 'CREAR OPERADOR' : 'BOOTSTRAP SESIÓN'}
            </button>
            
            <button 
              type="button" 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }} 
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.5rem', fontFamily: 'inherit' }}
            >
              {isRegistering ? 'Ya tengo cuenta, quiero iniciar sesión' : 'No tengo cuenta, quiero registrarme'}
            </button>

          </form>

        </div>
      </div>
    )
  }

  // ==================== DASHBOARD PRINCIPAL (DASHBOARD ALTAMENTE ADAPTABLE) ====================
  return (
    <div className="app-layout">
      
      {/* CAPA OSCURA AL ABRIR EL SIDEBAR EN MÓVILES */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* BARRA LATERAL (PROYECTOS) */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>// CONSOLE_CORE</div>
            <h2 style={{ fontSize: '1.6rem', letterSpacing: '-1px', margin: 0 }}>PROYECTOS</h2>
          </div>
          {/* Botón Cerrar Sidebar en Móvil */}
          <button 
            className="mobile-toggle-btn" 
            onClick={() => setSidebarOpen(false)}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
          >
            CERRAR
          </button>
        </div>

        {/* Info de Operador Logueado */}
        <div className="panel" style={{ padding: '0.8rem', background: 'rgba(0, 255, 204, 0.02)', borderColor: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', fontWeight: 'bold' }}>OPERADOR_ONLINE:</div>
          <div style={{ fontSize: '0.9rem', color: '#fff', textTransform: 'uppercase', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.name || 'ROOT'}
          </div>
          <button 
            onClick={handleLogoutServer}
            style={{ 
              background: 'none', border: '1px solid var(--neon-orange)', color: 'var(--neon-orange)', 
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', padding: '0.2rem', marginTop: '0.3rem',
              textTransform: 'uppercase'
            }}
          >
            [ CERRAR SESIÓN ]
          </button>
        </div>

        <button className="btn-brutal" style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }} onClick={() => setShowProjForm(!showProjForm)}>
          {showProjForm ? '[ CANCELAR ]' : '[ + NUEVO PROYECTO ]'}
        </button>

        {showProjForm && (
          <form onSubmit={handleCreateProject} className="panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <input 
              type="text" 
              placeholder="NOMBRE PROYECTO" 
              value={newProjectName} 
              onChange={e => setNewProjectName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit' }}
              required
              spellcheck="true"
              lang="es"
            />
            <textarea 
              placeholder="DESCRIPCIÓN" 
              value={newProjectDesc} 
              onChange={e => setNewProjectDesc(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit', resize: 'none', height: '60px' }}
              spellcheck="true"
              lang="es"
            />
            <button className="btn-brutal" type="submit" style={{ fontSize: '0.8rem', padding: '0.4rem', color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }}>
              GUARDAR
            </button>
          </form>
        )}

        {/* LISTA DE PROYECTOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
          {projects.map(p => (
            <div 
              key={p.id} 
              onClick={() => { 
                if(!isActive) {
                  setActiveProjectId(p.id)
                  setSidebarOpen(false) // Cerrar sidebar en móvil al elegir
                } 
              }}
              className="panel" 
              style={{ 
                padding: '1rem', 
                cursor: isActive ? 'not-allowed' : 'pointer',
                borderColor: p.id === activeProjectId ? 'var(--neon-orange)' : 'var(--text-dim)',
                background: p.id === activeProjectId ? 'rgba(255, 51, 0, 0.05)' : 'var(--bg-panel)',
                opacity: isActive && p.id !== activeProjectId ? 0.5 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: p.id === activeProjectId ? 'var(--neon-orange)' : '#fff', margin: 0 }}>{p.name}</h3>
                {!isActive && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id) }} 
                    style={{ background: 'none', border: 'none', color: 'var(--neon-orange)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
                  >
                    [X]
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {p.description || '// Sin descripción'}
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', marginTop: '0.5rem' }}>
                {p.tasks?.length || 0} tareas cargadas
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="main-content">
        
        {/* CABECERA Y CRONÓMETRO ADAPTABLES (SIN ESTILOS INLINE DE POSICIONAMIENTO) */}
        <section className="panel header-panel">
          <div className="header-info-section">
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--neon-orange)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                PROYECTO ACTIVO: {activeProject ? activeProject.name.toUpperCase() : 'NINGUNO'}
              </div>
              {/* Botón flotante para abrir el listado de proyectos en móvil */}
              <button className="mobile-toggle-btn" onClick={() => setSidebarOpen(true)}>
                [ VER PROYECTOS ]
              </button>
            </div>
            <h1 className="header-title">
              TABLERO_DE_TIEMPO
            </h1>
            <p style={{ color: 'var(--text-dim)', margin: '0.5rem 0 0 0', fontSize: '0.9rem', lineHeight: '1.25rem' }}>
              {activeProject?.description || 'Abre el panel lateral para crear o seleccionar un proyecto y comenzar a organizar tus tareas.'}
            </p>
          </div>

          {/* CRONÓMETRO GLOBAL (REDISEÑADO CON CLASES DE index.css) */}
          <div className="timer-section">
            <div style={{ fontSize: '0.75rem', color: activeTask ? 'var(--neon-cyan)' : 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem', textAlign: 'center', wordBreak: 'break-word', maxWidth: '280px' }}>
              {activeTask ? `Grabando: ${activeTask.title}` : '[ Selecciona una tarea para cronometrar ]'}
            </div>
            
            <div 
              className={`timer-display display-font ${isActive ? 'glitch-text' : ''}`}
              style={{ color: isActive ? 'var(--neon-cyan)' : 'var(--text-main)' }}
            >
              {formatTime(time)}
            </div>

            {activeTaskId && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', width: '100%', maxWidth: '280px' }}>
                <button 
                  className="btn-brutal" 
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', background: isActive ? 'var(--neon-orange)' : 'transparent', color: isActive ? '#000' : 'var(--neon-orange)' }}
                  onClick={() => isActive ? triggerSaveTimeFlow(true) : setIsActive(true)}
                >
                  {isActive ? 'PAUSA' : 'INICIAR'}
                </button>
                <button 
                  className="btn-brutal" 
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', borderColor: 'var(--text-dim)', color: 'var(--text-dim)' }}
                  onClick={() => triggerSaveTimeFlow(false)}
                >
                  DETENER
                </button>
              </div>
            )}
          </div>
        </section>

        {isActive && (
          <div className="marquee-container">
            <div className="marquee">
              ATENCIÓN: REGISTRO DE TIEMPO ACTIVO EN LA TAREA: "{activeTask?.title.toUpperCase()}" // NO CIERRES LA VENTANA // COMPILANDO HORAS...
            </div>
          </div>
        )}

        {/* TABLERO KANBAN */}
        {activeProject ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            
            {/* Creador de Tareas */}
            <form onSubmit={handleCreateTask} className="panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--neon-cyan)', fontSize: '0.9rem', fontWeight: 'bold' }}>NUEVA_TAREA:</div>
              <input 
                type="text" 
                placeholder="TÍTULO DE LA TAREA" 
                value={newTaskTitle} 
                onChange={e => setNewTaskTitle(e.target.value)}
                style={{ flex: '1 1 200px', padding: '0.5rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit' }}
                required
                spellcheck="true"
                lang="es"
              />
              <input 
                type="text" 
                placeholder="DESCRIPCIÓN DE LA TAREA" 
                value={newTaskDesc} 
                onChange={e => setNewTaskDesc(e.target.value)}
                style={{ flex: '2 1 250px', padding: '0.5rem', background: '#000', border: '1px solid var(--text-dim)', color: '#fff', fontFamily: 'inherit' }}
                spellcheck="true"
                lang="es"
              />
              <button className="btn-brutal" type="submit" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', width: 'auto' }}>
                CREAR
              </button>
            </form>

            {/* Columnas Kanban */}
            <div className="kanban-board">
              {columns.map(col => {
                const colTasks = activeProjectTasks.filter(t => t.status === col.id)
                const isOver = draggedOverCol === col.id

                return (
                  <div 
                    key={col.id} 
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={() => setDraggedOverCol(null)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className="kanban-column panel" 
                    style={{ 
                      background: isOver ? 'rgba(0, 255, 204, 0.05)' : '#0c0c0e', 
                      border: isOver ? '2px dashed var(--neon-cyan)' : '2px dashed var(--text-dim)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--text-dim)', paddingBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: isOver ? 'var(--neon-cyan)' : '#fff' }}>{col.name.toUpperCase()}</span>
                      <span style={{ background: 'var(--bg-panel)', padding: '0.1rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--text-dim)' }}>
                        {colTasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
                      {colTasks.map(task => (
                        <div 
                          key={task.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTaskForModal(task)}
                          className="panel" 
                          style={{ 
                            padding: '1rem', 
                            background: activeTaskId === task.id ? 'rgba(0, 255, 204, 0.03)' : 'var(--bg-panel)',
                            borderColor: activeTaskId === task.id ? 'var(--neon-cyan)' : 'var(--text-dim)',
                            cursor: 'grab',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4 style={{ fontSize: '1rem', margin: '0 1.5rem 0 0', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.title}</h4>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
                              style={{ background: 'none', border: 'none', color: 'var(--neon-orange)', cursor: 'pointer', fontSize: '0.8rem', position: 'absolute', right: '10px', top: '10px' }}
                            >
                              [X]
                            </button>
                          </div>
                          
                          {task.description ? (
                            <p style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--text-muted)', 
                              margin: '0.5rem 0',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '1.2rem',
                              height: '2.4rem'
                            }}>
                              {task.description}
                            </p>
                          ) : (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '0.5rem 0', fontStyle: 'italic', height: '2.4rem' }}>
                              // Sin descripción
                            </p>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--neon-cyan)', fontWeight: 'bold' }}>
                              {formatTime(task.time_logged)}
                            </div>
                            
                            <button 
                              className="btn-brutal" 
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderColor: activeTaskId === task.id ? 'var(--neon-cyan)' : 'var(--text-dim)', color: activeTaskId === task.id ? 'var(--neon-cyan)' : 'var(--text-main)' }}
                              onClick={() => selectTaskForTimer(task)}
                            >
                              {activeTaskId === task.id ? 'SELECCIONADA' : 'CRONOMETRAR'}
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginTop: '0.8rem', borderTop: '1px solid var(--text-dim)', paddingTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                            <button 
                              disabled={col.id === 'tarea'}
                              onClick={() => {
                                const order = ['tarea', 'pendiente', 'en_proceso', 'finalizado']
                                const prevStatus = order[order.indexOf(col.id) - 1]
                                handleUpdateTaskStatus(task.id, prevStatus)
                              }}
                              style={{ fontSize: '0.65rem', background: 'none', border: '1px solid var(--text-dim)', color: col.id === 'tarea' ? 'var(--text-dim)' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              &lt; MOVER
                            </button>
                            <button 
                              disabled={col.id === 'finalizado'}
                              onClick={() => {
                                const order = ['tarea', 'pendiente', 'en_proceso', 'finalizado']
                                const nextStatus = order[order.indexOf(col.id) + 1]
                                handleUpdateTaskStatus(task.id, nextStatus)
                              }}
                              style={{ fontSize: '0.65rem', background: 'none', border: '1px solid var(--text-dim)', color: col.id === 'finalizado' ? 'var(--text-dim)' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              MOVER &gt;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* PÁGINA CUANDO NO HAY PROYECTOS (MODIFICADO CON CLASES DE index.css) */
          <div className="no-project-panel panel">
            <div className="no-project-title display-font">
              [ NO_ACTIVE_PROJECT ]
            </div>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '2rem', fontSize: '0.95rem' }}>
              Abre el panel lateral para crear o seleccionar un proyecto y comenzar a organizar tus tareas en el tablero ágil.
            </p>
          </div>
        )}
      </main>

      {/* MODAL: DETALLES DE TAREA */}
      {selectedTaskForModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 10000, backdropFilter: 'blur(8px)', padding: '1rem'
        }} onClick={() => setSelectedTaskForModal(null)}>
          
          <div className="panel" style={{
            width: '650px', maxWidth: '100%', background: '#111', padding: '2rem',
            border: '2px solid var(--neon-cyan)', boxShadow: '0 0 30px rgba(0, 255, 204, 0.2)',
            display: 'flex', flexDirection: 'column', gap: '1.2rem', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            
            <button 
              onClick={() => setSelectedTaskForModal(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--neon-orange)', cursor: 'pointer', fontSize: '1.2rem', fontFamily: 'inherit' }}
            >
              [ CERRAR ]
            </button>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--neon-orange)', fontWeight: 'bold' }}>// TAREA_DETALLE_CORE</span>
              <h2 style={{ fontSize: '1.8rem', marginTop: '0.5rem', textTransform: 'uppercase', color: '#fff', wordBreak: 'break-word' }}>{selectedTaskForModal.title}</h2>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', border: '1px solid var(--text-dim)', color: 'var(--neon-cyan)' }}>
                  ESTADO: {selectedTaskForModal.status.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', border: '1px solid var(--text-dim)', color: 'var(--neon-orange)' }}>
                  TIEMPO TOTAL: {formatTime(selectedTaskForModal.time_logged)}
                </span>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--text-dim)', paddingBottom: '0.3rem', color: '#fff', marginBottom: '0.5rem' }}>DESCRIPCIÓN</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedTaskForModal.description || '// Sin descripción cargada para esta tarea.'}
              </p>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '150px' }}>
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--text-dim)', paddingBottom: '0.3rem', color: '#fff', marginBottom: '0.5rem' }}>HISTORIAL DE AVANCES & TIEMPOS</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: '200px', paddingRight: '0.5rem' }}>
                {selectedTaskForModal.time_entries && selectedTaskForModal.time_entries.length > 0 ? (
                  selectedTaskForModal.time_entries.map(entry => (
                    <div key={entry.id} style={{
                      padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--neon-cyan)',
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center'
                    }}>
                      <div style={{ wordBreak: 'break-word' }}>
                        <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{entry.comment}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                          Registrado: {new Date(entry.created_at).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1rem', color: 'var(--neon-cyan)', fontFamily: 'inherit', fontWeight: 'bold' }}>
                          +{formatTime(entry.duration)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.9rem', margin: 'auto', textAlign: 'center' }}>
                    // No hay avances registrados todavía.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR COMENTARIO */}
      {showCommentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 10001, backdropFilter: 'blur(8px)', padding: '1rem'
        }}>
          
          <form onSubmit={submitLoggedTimeWithComment} className="panel" style={{
            width: '450px', maxWidth: '100%', background: '#111', padding: '2rem',
            border: '2px solid var(--neon-orange)', boxShadow: '0 0 30px rgba(255, 51, 0, 0.2)',
            display: 'flex', flexDirection: 'column', gap: '1.2rem'
          }}>
            
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--neon-orange)', fontWeight: 'bold' }}>// SAVE_PROGRESS_PROMPT</span>
              <h2 style={{ fontSize: '1.5rem', marginTop: '0.25rem', textTransform: 'uppercase', color: '#fff' }}>REGISTRAR AVANCE</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Indica brevemente lo que has avanzado en esta sesión de trabajo para guardarlo en la tarea:
              </p>
              <div style={{ fontSize: '0.9rem', color: 'var(--neon-cyan)', fontWeight: 'bold', marginTop: '0.5rem', textTransform: 'uppercase', wordBreak: 'break-word' }}>
                {activeTask?.title} (+{formatTime(pendingLogData?.seconds || 0)})
              </div>
            </div>

            <input 
              type="text" 
              placeholder="¿EN QUÉ AVANZASTE? (Ej: Maquetado del modal, corregido bug...)" 
              value={timerComment} 
              onChange={e => setTimerComment(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: '#000', border: '1px solid var(--text-dim)', color: 'var(--neon-cyan)', fontFamily: 'inherit', outline: 'none' }}
              required
              autoFocus
              spellcheck="true"
              lang="es"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <button className="btn-brutal" type="submit" style={{ color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }}>
                [ GUARDAR ]
              </button>
              <button 
                type="button" 
                className="btn-brutal" 
                style={{ borderColor: 'var(--text-dim)', color: 'var(--text-dim)' }}
                onClick={() => {
                  setTimerComment('Avance registrado');
                  setTimeout(() => {
                    const fakeEvent = { preventDefault: () => {} }
                    submitLoggedTimeWithComment(fakeEvent);
                  }, 10);
                }}
              >
                OMITIR
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  )
}

export default App
