import tempfile, shutil, re, yt_dlp, os

from fastapi import FastAPI, HTTPException, Request,BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse,FileResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Literal, Dict, Any
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
            data = song_model.search_by_name(entry)
            if len(data) > 0:
                counters["exists"] += 1
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
    try:
        with yt_dlp.YoutubeDL(probe_opts) as ydl:
            info = ydl.extract_info(url_str, download=False)
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"No se pudo obtener info del video: {e}")

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