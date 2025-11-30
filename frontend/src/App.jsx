// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

// --- ICONOS SVG ---
// Usamos stroke="currentColor" para heredar el color definido en CSS (negro en los botones blancos)
const IconHeart = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "#e60023" : "none"} stroke={filled ? "#e60023" : "currentColor"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);
const IconDownload = () => ( <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> );
const IconShare = () => ( <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> );
const IconMore = () => ( <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0"><circle cx="12" cy="12" r="2.5"></circle><circle cx="19" cy="12" r="2.5"></circle><circle cx="5" cy="12" r="2.5"></circle></svg> );
const IconClose = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> );
const IconCreatePin = () => (<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h2a1 1 0 0 1 1 1v3.69l-.92.2a5 5 0 0 0-3.97 4.66l-.1 2.4A1 1 0 0 0 4 16h7v2.3q0 2.7.66 5.33l.09.37h.5l.1-.37a22 22 0 0 0 .65-5.34V16h7a1 1 0 0 0 1-1.1l-.24-2.58a5 5 0 0 0-3.9-4.43l-.86-.2V4a1 1 0 0 1 1-1h2V1H5zm5 1a3 3 0 0 0-.17-1h4.34A3 3 0 0 0 14 4v5.3l2.43.54a3 3 0 0 1 2.34 2.66l.13 1.5H5.05l.06-1.36a3 3 0 0 1 2.38-2.8L10 9.31z"></path></svg>);
const IconCreateBoard = () => (<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23 5a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h14a4 4 0 0 0 4-4zm-10 6V3h6a2 2 0 0 1 2 2v6zm8 8a2 2 0 0 1-2 2h-6v-8h8zM5 3h6v18H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2"></path></svg>);
const IconUpload = () => (<svg height="32" width="32" viewBox="0 0 24 24" fill="currentColor" color="#777"><path d="M15.3 12.7 13 10.42V17h-2v-6.59l-2.3 2.3-1.4-1.42L12 6.6l4.7 4.7zM24 12a12 12 0 1 1-24 0 12 12 0 0 1 24 0M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20"></path></svg>);

function App() {
  const CURRENT_USER_ID = "USER-001"; 
  
  const [pins, setPins] = useState([]);
  const [boards, setBoards] = useState([]);
  
  // UI States
  const [selectedPin, setSelectedPin] = useState(null); // Modal Detalle Pin
  
  // Nuevos Modales
  const [pinToSave, setPinToSave] = useState(null); // Modal "Guardar en Tablero"
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);

  // Formularios
  const [boardTitle, setBoardTitle] = useState("");
  const [boardDesc, setBoardDesc] = useState("");
  const [pinTitle, setPinTitle] = useState("");
  const [pinDesc, setPinDesc] = useState("");
  const [pinImage, setPinImage] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  
  const [commentText, setCommentText] = useState("");

  // --- FETCHING ---
  const fetchPins = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/pins?userId=${CURRENT_USER_ID}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      if (Array.isArray(data)) {
        setPins(data);
        if (selectedPin) {
            const updated = data.find(p => p.id_pin === selectedPin.id_pin);
            if (updated) setSelectedPin(updated);
        }
      } else setPins([]);
    } catch (err) { console.error(err); setPins([]); }
  };

  const fetchBoards = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/boards');
      if (res.ok) {
          const data = await res.json();
          if(Array.isArray(data)) setBoards(data);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPins(); fetchBoards(); }, []);

  // --- HANDLERS ---
  
  // 1. Iniciar el flujo de guardado (Abre modal de selección de tablero)
  const handleSaveRequest = (e, pin) => {
    e.stopPropagation();
    setPinToSave(pin); // Esto abre el modal "Guardar en..."
  };

  // 2. Confirmar guardado en un tablero específico
  const handleConfirmSave = async (boardId) => {
    if(!pinToSave) return;
    // Aquí harías la llamada a la API real para guardar (relación CONTAINS)
    // Por ahora simulamos
    console.log(`Guardando pin ${pinToSave.id_pin} en tablero ${boardId}`);
    alert("¡Pin guardado!");
    setPinToSave(null); // Cerrar modal
  };

  const handleLike = async (e, pin) => {
    e.stopPropagation();
    
    // 1. Guardamos el estado anterior por si hay error
    const previousLikedState = pin.likedByMe;
    const previousLikesCount = pin.likesCount;

    // 2. Actualización Optimista (Visual inmediata)
    const isNowLiked = !previousLikedState;
    
    const updatePinState = (p) => {
        if (p.id_pin === pin.id_pin) {
            return {
                ...p,
                likedByMe: isNowLiked,
                likesCount: isNowLiked ? (previousLikesCount + 1) : (previousLikesCount - 1)
            };
        }
        return p;
    };

    // Aplicar cambio visual
    setPins(prev => prev.map(p => updatePinState(p)));
    if(selectedPin && selectedPin.id_pin === pin.id_pin) {
        setSelectedPin(prev => updatePinState(prev));
    }

    // 3. Llamada al Backend (Persistencia Real)
    try {
      const response = await fetch(`http://localhost:3001/api/pins/${pin.id_pin}/like`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: CURRENT_USER_ID })
      });

      if (!response.ok) throw new Error("Fallo al guardar like");
      
      // Opcional: Podrías leer response.json() para confirmar el estado real
      
    } catch (error) {
      console.error("Error guardando like, revirtiendo...", error);
      
      // REVERTIR CAMBIOS VISUALES (Rollback)
      const revertPinState = (p) => {
        if (p.id_pin === pin.id_pin) {
            return { ...p, likedByMe: previousLikedState, likesCount: previousLikesCount };
        }
        return p;
      };
      setPins(prev => prev.map(p => revertPinState(p)));
      if(selectedPin && selectedPin.id_pin === pin.id_pin) {
          setSelectedPin(prev => revertPinState(prev));
      }
      alert("No se pudo guardar el like. Revisa tu conexión.");
    }
  };

  const handleCreatePin = async (e) => {
    e.preventDefault();
    if (!selectedBoard) return alert("Elige un tablero");
    try {
      const res = await fetch('http://localhost:3001/api/pins', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pinTitle, description: pinDesc, url_image: pinImage, boardId: selectedBoard, userId: CURRENT_USER_ID })
      });
      if (res.ok) { 
          fetchPins(); setIsPinModalOpen(false); 
          setPinTitle(""); setPinDesc(""); setPinImage(""); 
      }
    } catch (error) { console.error(error); alert("Error de conexión"); }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/api/boards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: boardTitle, description: boardDesc, userId: CURRENT_USER_ID })
      });
      if (res.ok) { 
          fetchBoards(); setIsBoardModalOpen(false); 
          setBoardTitle(""); setBoardDesc(""); 
      }
    } catch (error) { console.error(error); alert("Error de conexión"); }
  };

  const handleComment = async (e) => {
    if (e.key === 'Enter' && commentText.trim() !== "" && selectedPin) {
      try {
        const res = await fetch(`http://localhost:3001/api/pins/${selectedPin.id_pin}/comment`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: CURRENT_USER_ID, text: commentText })
        });
        if (res.ok) { setCommentText(""); fetchPins(); }
      } catch (error) { console.error(error); }
    }
  };

  return (
    <div className="app" onClick={() => setIsCreateMenuOpen(false)}>
      {/* NAVBAR */}
      <nav className="navbar" onClick={e => e.stopPropagation()}>
        <div style={{color: "#e60023", fontWeight: "bold", fontSize: "20px", display:'flex', alignItems:'center', gap:'5px', marginRight: 20}}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png" width="24" alt="logo"/>
            NeoPinterest
        </div>
        <button className="create-btn" style={{background:'black', color:'white'}} onClick={()=>window.location.reload()}>Inicio</button>
        
        <div style={{position: 'relative'}}>
            <button 
                className="create-btn" 
                style={{background:'white', color:'black', marginLeft:'10px'}} 
                onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            >
                Crear
            </button>
            
            {isCreateMenuOpen && (
                <div className="create-dropdown">
                    <div style={{padding: '8px 16px', fontWeight:'bold'}}>Crear</div>
                    <button className="create-option" onClick={() => { setIsPinModalOpen(true); setIsCreateMenuOpen(false); }}>
                        <IconCreatePin />
                        <div className="create-option-text">
                            <h4>Pin</h4>
                            <p>Publica tus fotos o vídeos</p>
                        </div>
                    </button>
                    <button className="create-option" onClick={() => { setIsBoardModalOpen(true); setIsCreateMenuOpen(false); }}>
                        <IconCreateBoard />
                        <div className="create-option-text">
                            <h4>Tablero</h4>
                            <p>Organiza tus pines favoritos</p>
                        </div>
                    </button>
                </div>
            )}
        </div>

        <input className="search-bar" placeholder="Buscar" />
        <div style={{width: "48px", height: "48px", borderRadius: "50%", background: "#efefef", marginLeft: "10px", overflow: "hidden", display:'flex', justifyContent:'center', alignItems:'center'}}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${CURRENT_USER_ID}`} width="100%" alt="u"/>
        </div>
      </nav>

      {/* MAIN GRID */}
      <div className="main-content">
        <div className="pin-container">
            {pins.map((pin) => (
                <div key={pin.id_pin} className="pin-wrapper" onClick={() => setSelectedPin(pin)}>
                    <img src={pin.url_image} alt={pin.title} className="pin-image" onError={(e) => e.target.src = "https://via.placeholder.com/300"} />
                    
                    {/* HOVER OVERLAY (RENOVADO) */}
                    <div className="pin-hover-overlay">
                        <div className="overlay-header">
                            {/* Botón Guardar Rojo (Abre Modal Selección) */}
                            <button className="btn-save-card" onClick={(e) => handleSaveRequest(e, pin)}>
                                Guardar
                            </button>
                        </div>
                        
                        <div className="overlay-footer">
                             <button className="icon-btn-card" title="Enlace" onClick={(e)=> e.stopPropagation()}>
                                <IconShare />
                             </button>
                             <button className="icon-btn-card" title="Más" onClick={(e)=> e.stopPropagation()}>
                                <IconMore />
                             </button>
                             <button className="icon-btn-card" title="Descargar" onClick={(e)=> {e.stopPropagation(); window.open(pin.url_image, '_blank')}}>
                                <IconDownload />
                             </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* --- MODAL DE SELECCIÓN DE TABLERO (AL GUARDAR) --- */}
      {pinToSave && (
         <div className="modal-backdrop" onClick={() => setPinToSave(null)}>
            <div className="board-selection-modal" onClick={e => e.stopPropagation()}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                    <h2 style={{margin:0, fontSize: 20}}>Guardar en...</h2>
                    <button style={{border:'none', background:'transparent', cursor:'pointer'}} onClick={()=>setPinToSave(null)}><IconClose/></button>
                </div>
                
                <div className="board-list-scroll">
                    {boards.map(b => (
                        <div key={b.id} className="board-option-item" onClick={() => handleConfirmSave(b.id)}>
                            <div style={{display:'flex', alignItems:'center'}}>
                                <div className="board-thumb"></div>
                                <span style={{fontWeight:600}}>{b.title}</span>
                            </div>
                            <button className="btn-save-card" style={{padding:'8px 12px', fontSize:'14px'}}>Guardar</button>
                        </div>
                    ))}
                    {boards.length === 0 && <p style={{textAlign:'center', color:'#777'}}>No tienes tableros.</p>}
                </div>

                <div style={{borderTop:'1px solid #eee', paddingTop:15, marginTop:15, display:'flex', alignItems:'center', gap:10, cursor:'pointer'}} onClick={()=>{setIsBoardModalOpen(true); setPinToSave(null);}}>
                    <div style={{width:48, height:48, background:'#eee', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}><IconCreateBoard/></div>
                    <span style={{fontWeight:600}}>Crear tablero</span>
                </div>
            </div>
         </div>
      )}

      {/* --- MODAL DETALLE PIN --- */}
      {selectedPin && (
        <div className="modal-backdrop" onClick={() => setSelectedPin(null)}>
            <div className="modal-pin-detail" onClick={(e) => e.stopPropagation()}>
                <div className="modal-left">
                    <img src={selectedPin.url_image} className="modal-image" alt="Pin" />
                </div>
                <div className="modal-right">
                    <div className="modal-header-actions">
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="icon-btn-card" style={{background:'white', boxShadow:'none', border:'1px solid #ddd'}} onClick={()=> window.open(selectedPin.url_image, '_blank')}><IconDownload /></button>
                            <button className="icon-btn-card" style={{background:'white', boxShadow:'none', border:'1px solid #ddd'}}><IconShare /></button>
                        </div>
                        <button className="btn-save-card" onClick={(e) => handleSaveRequest(e, selectedPin)}>Guardar</button>
                    </div>
                    <h1 style={{fontSize: '28px', fontWeight: '600', margin: '10px 0'}}>{selectedPin.title}</h1>
                    <p style={{fontSize: '14px', color: '#333'}}>{selectedPin.description}</p>
                    <div className="creator-row">
                        <img src={selectedPin.creatorPic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPin.creator}`} className="creator-avatar" alt="creator" />
                        <div>
                            <div style={{fontWeight:'bold', fontSize:'14px'}}>{selectedPin.creator || "Usuario"}</div>
                            <div style={{fontSize:'12px', color:'#555'}}>Publicado el {selectedPin.createdAt ? new Date(selectedPin.createdAt).toLocaleDateString() : "hoy"}</div>
                        </div>
                    </div>
                    <div className="comments-section">
                        <h3 style={{fontSize:'18px'}}>Comentarios</h3>
                        <div style={{display:'flex', gap:'15px', marginBottom:'20px', alignItems:'center', cursor:'pointer'}} onClick={(e)=>handleLike(e, selectedPin)}>
                            <IconHeart filled={selectedPin.likedByMe} />
                            <span style={{fontWeight:'bold'}}>{selectedPin.likesCount || 0} likes</span>
                        </div>
                        <div className="comment-list">
                            {selectedPin.comments && selectedPin.comments.map((c, i) => (
                                <div key={i} className="comment-item">
                                    <strong>{c.author}</strong> <span>{c.text}</span>
                                </div>
                            ))}
                        </div>
                        <div className="comment-input-container">
                             <input className="comment-input" placeholder="Añadir comentario" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={handleComment} />
                        </div>
                    </div>
                </div>
                <button onClick={()=>setSelectedPin(null)} style={{position:'absolute', top:20, left:20, border:'none', background:'white', borderRadius:'50%', width:40, height:40, cursor:'pointer', display:'flex', justifyContent:'center', alignItems:'center'}}><IconClose /></button>
            </div>
        </div>
      )}

      {/* --- MODAL: CREAR PIN --- */}
      {isPinModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPinModalOpen(false)}>
            <div className="modal-create-pin" onClick={e => e.stopPropagation()}>
                <button style={{position:'absolute', right:20, top:20, border:'none', background:'transparent', cursor:'pointer'}} onClick={() => setIsPinModalOpen(false)}><IconClose /></button>
                
                <div className="create-pin-left">
                    {pinImage ? (
                        <img src={pinImage} alt="Preview" className="preview-image" onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                        <div className="upload-placeholder">
                            <IconUpload />
                            <p>Pega una URL de imagen a la derecha para ver la vista previa aquí</p>
                        </div>
                    )}
                </div>

                <div className="create-pin-right">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                         <h3>Crear Pin</h3>
                         <button className="btn-save-card" onClick={handleCreatePin}>Publicar</button>
                    </div>
                    <input className="clean-input" placeholder="Añade un título" style={{fontSize: '24px', fontWeight: 'bold', border: 'none', paddingLeft:0}} value={pinTitle} onChange={e => setPinTitle(e.target.value)} />
                    <textarea className="clean-textarea" placeholder="Cuenta a todos de qué trata tu Pin..." rows="3" value={pinDesc} onChange={e => setPinDesc(e.target.value)} />
                    <div style={{marginTop: 'auto'}}>
                        <label style={{fontSize: '12px', color: '#555'}}>Enlace de destino (Imagen URL)</label>
                        <input className="clean-input" placeholder="Añade un enlace de imagen" value={pinImage} onChange={e => setPinImage(e.target.value)} />
                    </div>
                    <div>
                        <label style={{fontSize: '12px', color: '#555'}}>Tablero</label>
                        <select className="clean-input" value={selectedBoard} onChange={e => setSelectedBoard(e.target.value)}>
                            <option value="">Selecciona un tablero</option>
                            {boards.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: CREAR TABLERO --- */}
      {isBoardModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsBoardModalOpen(false)}>
            <div className="modal-create-board" onClick={e => e.stopPropagation()}>
                <h2 style={{marginTop:0}}>Crear un tablero</h2>
                <button style={{position:'absolute', right:20, top:20, border:'none', background:'transparent', cursor:'pointer'}} onClick={() => setIsBoardModalOpen(false)}><IconClose /></button>
                
                <form onSubmit={handleCreateBoard}>
                    <div className="board-form-group">
                        <label>Nombre</label>
                        <input className="clean-input" placeholder='Como "Lugares a los que ir" o "Recetas"' value={boardTitle} onChange={e => setBoardTitle(e.target.value)} required/>
                    </div>
                    <div className="board-form-group">
                         <label>Descripción (Opcional)</label>
                         <input className="clean-input" placeholder='¿De qué trata este tablero?' value={boardDesc} onChange={e => setBoardDesc(e.target.value)} />
                    </div>
                    <div className="checkbox-group">
                        <input type="checkbox" id="secret" />
                        <div style={{textAlign:'left'}}>
                            <label htmlFor="secret" style={{fontSize:'14px', fontWeight:'bold', marginBottom:0}}>Mantener este tablero secreto</label>
                            <span style={{fontSize:'12px', color:'#555'}}>Solo tú y tus colaboradores podréis verlo</span>
                        </div>
                    </div>
                    <button type="submit" className="btn-save-card" style={{width: '100%', padding: '12px', marginTop:'10px'}}>Crear</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;