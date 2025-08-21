import datetime
import tempfile, shutil, re, yt_dlp, os

from fastapi import FastAPI, HTTPException, Request,BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse,FileResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Literal, Dict, Any, Optional
from fastapi.staticfiles import StaticFiles

from tempfile import TemporaryDirectory
from pathlib import Path


# Tu modelo
from Model.Song import Song

app = FastAPI(
    title="Random List Music API",
    description="API con endpoints y templates en Jinja2",
    version="1.1.0",
)

app.mount("/static", StaticFiles(directory="static"), name="static")



# CORS (opcional)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurar templates
templates = Jinja2Templates(directory="templates")

# ----------------------------
# MODELOS DE ENTRADA / SALIDA
# ----------------------------
class ProcessRequest(BaseModel):
    path: str = Field(..., description="Ruta al directorio con archivos .mp3")
    option: Literal["mix", "original"] = Field(..., description="Modo de procesamiento")

class Action(BaseModel):
    file: str
    action: str
    detail: str | None = None

class ProcessResponse(BaseModel):
    path: str
    option: str
    processed_files: int
    mp3_files: int
    actions: List[Action]
    summary: Dict[str, int]

# ----------------------------
# LÓGICA DE PROCESAMIENTO
# ----------------------------
def process_directory(path: str, option: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"La ruta no existe: {path}")
    if not os.path.isdir(path):
        raise NotADirectoryError(f"No es un directorio: {path}")

    song_model = Song(path)
    contents = os.listdir(path)
    actions: List[Action] = []
    counters = { "exists": 0, "created": 0, "alias_updated": 0, "not_found": 0 }

    mp3_count, processed_count = 0, 0

    for entry in contents:
        if not entry.lower().endswith(".mp3"):
            continue
        mp3_count += 1

        if option == "mix":
            data = song_model.search_by_name(entry)
            if len(data) > 0:
                counters["exists"] += 1
                song_model.renew_alias_by_name(entry)
                actions.append(Action(file=entry, action="renew_alias_by_name", detail="Alias renewed"))
            else:
                counters["created"] += 1
                song_model.create_alias(entry)
                actions.append(Action(file=entry, action="create_alias", detail="Alias created"))
        else:  # option == "original"
            data = song_model.search_by_alias(entry)

            if len(data) > 0:
                counters["exists"] += 1
                song_model.set_original_name(data[0][1], data[0][0])
                
                actions.append(Action(file=entry, action="exists", detail="Song exists"))
            else:
                counters["not_found"] += 1
                actions.append(Action(file=entry, action="not_found", detail="Song not found"))
        processed_count += 1

    return {
        "path": path,
        "option": option,
        "processed_files": processed_count,
        "mp3_files": mp3_count,
        "actions": [a.dict() for a in actions],
        "summary": counters,
    }

# ----------------------------
# ENDPOINTS
# ----------------------------

@app.post("/process", response_model=ProcessResponse)
def process(req: ProcessRequest):
    try:
        return process_directory(req.path, req.option)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}

# 👇 Renderizado HTML con Jinja2
@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    """
    Renderiza index.html
    """
    return templates.TemplateResponse("index.html", {"request": request, "title": "Random List Music"})



class DownloadReq(BaseModel):
    url: HttpUrl
    title: str | None = None
    format: str = "mp3"  # solo mp3 por ahora

def sanitize_filename(name: str) -> str:
    return re.sub(r"[^\w\s.-]+", "_", name or "").strip() or "audio"

def pick_best_audio(info: dict) -> str | None:
    """Devuelve un selector de formato (itag o 'bestaudio') según los formatos del video."""
    formats = (info or {}).get("formats") or []
    # Preferir formatos solo-audio (vcodec == 'none'), mayor bitrate
    audio_only = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") not in (None, "none")]
    if audio_only:
        # Ordenar por abr (audio bitrate); si no hay abr, por filesize aproximado
        audio_only.sort(key=lambda f: (f.get("abr") or 0, f.get("filesize") or f.get("filesize_approx") or 0), reverse=True)
        itag = audio_only[0].get("format_id")
        return itag
    # Fallback general
    return "bestaudio/best"

@app.post("/download")
def download(req: DownloadReq, background: BackgroundTasks):
    if req.format != "mp3":
        raise HTTPException(status_code=400, detail="Formato no soportado, usa 'mp3'.")

    url_str = str(req.url).strip()
    if not url_str:
        raise HTTPException(status_code=400, detail="URL vacía.")

    # Dir temporal persistente durante la respuesta
    tmpdir = tempfile.mkdtemp(prefix="dl_")
    outdir = Path(tmpdir)

    safe = sanitize_filename(req.title or "audio")
    outtmpl = str(outdir / f"{safe}.%(ext)s")

    # Primero, extraer info sin descargar para validar y elegir formato
    probe_opts = {
        "quiet": True, "no_warnings": True, "noprogress": True,
        "retries": 10, "fragment_retries": 10, "concurrent_fragment": 1,
        "socket_timeout": 30,
    }

    print("INICIO-----------")
    try:
        # Agregar opciones de timeout
        probe_opts_with_timeout = {
            **probe_opts,
            'noplaylist': True,
        'socket_timeout': 30,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'], 
                'formats': ['best']  
            }
        },
        'allowed_extractors': ['youtube'],  
        }
        
        with yt_dlp.YoutubeDL(probe_opts_with_timeout) as ydl:
            info = ydl.extract_info(url_str, download=False, process=False)
            
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Error de descarga: {e}")
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"No se pudo obtener info del video: {e}")

    print("FIN DE LA PRIMERA CONSULTA-----------")
    if not info:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=404, detail="No se encontró el recurso de YouTube.")

    selector = pick_best_audio(info) or "bestaudio/best"

    ydl_opts = {
        "outtmpl": outtmpl,
        "quiet": True, "no_warnings": True, "noprogress": True,
        "retries": 10, "fragment_retries": 10, "concurrent_fragment": 1,
        "socket_timeout": 30,
        "nopart": True, "continuedl": True,  # evita .part
        "format": selector,
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ],
        # Encabezados gentiles (algunos hosts son sensibles)
        "http_headers": {
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "User-Agent": "Mozilla/5.0",
        },

         'noplaylist': True,
       
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],  # Evitar iOS
                'formats': ['best']  # Simplificar formatos
            }
        },
        'allowed_extractors': ['youtube'],  # Forzar extractor específico
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url_str])
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        # Suele ser restricción/privado/edad/geo o cortes de red
        raise HTTPException(status_code=502, detail=f"Fallo en descarga/conversión: {e}")

    # Verifica que se generó un MP3 no vacío
    files = list(outdir.glob("*.mp3"))
    if not files:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="No se generó MP3 (¿restringido/privado/geo/edad?).")

    mp3 = files[0]
    if not mp3.exists() or mp3.stat().st_size == 0:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="El archivo MP3 resultó vacío.")

    # Limpia al terminar de enviar
    background.add_task(shutil.rmtree, tmpdir, ignore_errors=True)

    return FileResponse(str(mp3), media_type="audio/mpeg", filename=mp3.name)



class SaveReq(BaseModel):
  url: HttpUrl
  title: str | None = None
  format: str = "mp3"
  dest_path: str

@app.post("/download/save")
def download_and_save(req: SaveReq):
  if req.format != "mp3":
    raise HTTPException(status_code=400, detail="Formato no soportado, usa 'mp3'.")

  url = str(req.url).strip()
  if not url:
    raise HTTPException(status_code=400, detail="URL vacía.")

  dest_dir = Path(req.dest_path).expanduser().resolve()
  try:
    dest_dir.mkdir(parents=True, exist_ok=True)
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"No se pudo crear/acceder a la ruta destino: {e}")

  tmpdir = tempfile.mkdtemp(prefix="dl_save_")
  outdir = Path(tmpdir)
  safe = sanitize_filename(req.title or "audio")
  outtmpl = str(outdir / f"{safe}.%(ext)s")

  ydl_opts = {
    "outtmpl": outtmpl,
    "quiet": True, "no_warnings": True, "noprogress": True,
    "retries": 10, "fragment_retries": 10, "concurrent_fragment": 1,
    "socket_timeout": 30, "nopart": True, "continuedl": True,
    "format": "bestaudio/best",
    "postprocessors": [
      {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
    ],
    "http_headers": { "Accept-Language": "es-ES,es;q=0.9,en;q=0.8", "User-Agent": "Mozilla/5.0" },

    'noplaylist': True,
    
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'], 
                'formats': ['best']  
            }
        },
        'allowed_extractors': ['youtube'], 

  }

  try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
      ydl.download([url])
  except Exception as e:
    shutil.rmtree(tmpdir, ignore_errors=True)
    raise HTTPException(status_code=502, detail=f"Fallo en descarga/conversión: {e}")

  files = list(outdir.glob("*.mp3"))
  if not files:
    shutil.rmtree(tmpdir, ignore_errors=True)
    raise HTTPException(status_code=500, detail="No se generó MP3.")
  src = files[0]

  # Evitar sobreescribir: si existe, agrega sufijo (1), (2), ...
  dest = dest_dir / src.name
  if dest.exists():
    stem, suffix = dest.stem, dest.suffix
    i = 1
    while True:
      candidate = dest_dir / f"{stem} ({i}){suffix}"
      if not candidate.exists():
        dest = candidate
        break
      i += 1

  try:
    shutil.move(str(src), str(dest))
  except Exception as e:
    shutil.rmtree(tmpdir, ignore_errors=True)
    raise HTTPException(status_code=500, detail=f"No se pudo mover el archivo a destino: {e}")

  shutil.rmtree(tmpdir, ignore_errors=True)
  return { "saved_path": str(dest), "filename": dest.name, "size_bytes": dest.stat().st_size }

class SongsListReq(BaseModel):
    path: str
    exts: Optional[List[str]] = None          # p. ej. ['.mp3', '.m4a']
    include_subdirs: bool = False

class SongItem(BaseModel):
    name: str
    size_bytes: int
    modified: str  # ISO string
    path: str      # ruta completa del archivo

class SongsListResp(BaseModel):
    path: str
    total: int
    files: List[SongItem]



@app.post("/songs/list", response_model=SongsListResp)
def songs_list(req: SongsListReq):
    base = Path(req.path).expanduser()
    if not base.exists():
        raise HTTPException(status_code=400, detail="La ruta no existe.")
    if not base.is_dir():
        raise HTTPException(status_code=400, detail="La ruta no es un directorio.")

    # Normaliza extensiones a minúsculas con punto
    exts = None
    if req.exts:
        exts = set([e.lower() if e.startswith('.') else f".{e.lower()}" for e in req.exts])

    def iter_files(directory: Path):
        if req.include_subdirs:
            yield from directory.rglob("*")
        else:
            yield from directory.iterdir()

    files = []
    for p in iter_files(base):
        if not p.is_file():
            continue
        if exts:
            if p.suffix.lower() not in exts:
                continue
        try:
            stat = p.stat()
            mtime = datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds")
            files.append(SongItem(
                name=p.name,
                size_bytes=stat.st_size,
                modified=mtime,
                path=str(p.resolve())
            ))
        except Exception as e:
            # Si un archivo da error al leer metadatos, lo ignoramos
            print(f"Error al procesar {p}: {e}")
            continue

    # Orden por nombre ascendente
    files.sort(key=lambda x: x.name.lower())

    return SongsListResp(
        path=str(base.resolve()),
        total=len(files),
        files=files
    )


def to_watch_url(video_id_or_url: str) -> str:
    """
    Normaliza a URL de video sin parámetros de playlist.
    - Si viene un ID: devuelve https://www.youtube.com/watch?v=<id>
    - Si viene una URL: quita 'list', 'index', etc.
    """
    s = (video_id_or_url or "").strip()
    if not s:
        return s
    # Si parece un ID sin URL
    if "http" not in s and "://" not in s and len(s) >= 8:
        return f"https://www.youtube.com/watch?v={s}"

    try:
        u = urlparse(s)
        if u.netloc.endswith("youtu.be"):
            vid = u.path.strip("/").split("/")[-1]
            return f"https://www.youtube.com/watch?v={vid}"
        if u.netloc.endswith("youtube.com"):
            # limpiar params
            qs = dict(parse_qsl(u.query, keep_blank_values=True))
            v = qs.get("v")
            if v:
                # conservar solo v (y opcionalmente t si quieres mantener el timestamp)
                cleaned = {"v": v}
                new_q = urlencode(cleaned, doseq=True)
                return urlunparse((u.scheme, u.netloc, "/watch", "", new_q, ""))
            # si no hay v pero es /shorts/<id> o similar:
            parts = u.path.strip("/").split("/")
            if len(parts) >= 2 and parts[0] in ("shorts", "embed"):
                return f"https://www.youtube.com/watch?v={parts[1]}"
        # fallback
        return s
    except Exception:
        return s

# --- Modelos ---
class YTListReq(BaseModel):
    query: str
    limit: int = 20
    mode: Optional[str] = "auto"   # auto | search | resolve

class YTItem(BaseModel):
    id: str
    title: str
    url: str

class YTListResp(BaseModel):
    info: Optional[str] = None
    items: List[YTItem]

# --- Endpoint ---
@app.post("/youtube/list", response_model=YTListResp)
def youtube_list(req: YTListReq):
    q = (req.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query vacío.")

    # Construir 'source' para yt-dlp
    source = q
    if req.mode in (None, "auto", "search"):
        # Si no parece URL, usar ytsearch
        if not (q.startswith("http://") or q.startswith("https://")):
            # ytsearchN:query
            n = max(1, min(req.limit or 20, 50))
            source = f"ytsearch{n}:{q}"

    # Extraer info sin descargar
    ydl_opts = {
        "quiet": True, "no_warnings": True, "noprogress": True,
        "extract_flat": False,   # queremos info suficiente para armar URL
        "retries": 5, "fragment_retries": 5, "socket_timeout": 15,

        'noplaylist': True,
        'socket_timeout': 30,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'], 
                'formats': ['best']  
            }
        }
    }

    try:
        print("INICIO CONSULTA YT-----------")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(source, download=False)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo resolver la consulta: {e}")
    
    print("FIN CONSULTA YT-----------")

    items: List[YTItem] = []

    def push_entry(entry):
        if not entry:
            return
        vid = entry.get("id") or entry.get("url")
        title = entry.get("title") or "(sin título)"
        # Preferir webpage_url; si no, construir desde id
        raw_url = entry.get("webpage_url") or entry.get("url") or ""
        url = to_watch_url(raw_url if raw_url else vid)
        if not vid or not url:
            return
        items.append(YTItem(id=str(vid), title=str(title), url=str(url)))

    if "entries" in info and isinstance(info["entries"], list):
        # playlist/canal/busqueda
        for e in info["entries"]:
            # a veces entries son 'url' (id) + 'ie_key', hay que expandir si falta título
            if e and not e.get("title"):
                # intentar completar info del video individual
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as yd2:
                        ee = yd2.extract_info(e.get("url"), download=False)
                    push_entry(ee)
                except Exception:
                    push_entry(e)
            else:
                push_entry(e)
        # Limitar si mode=search
        if source.startswith("ytsearch"):
            items = items[: max(1, min(req.limit or 20, 50))]
    else:
        # único video
        push_entry(info)

    return YTListResp(info=info.get("title") or info.get("uploader") or None, items=items)