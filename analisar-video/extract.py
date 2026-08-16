#!/usr/bin/env python3
"""
extract.py — da olhos pro Claude.

Baixa um video, corta ele em imagens EXATAMENTE onde a imagem muda (scene
detection) e transcreve o audio. Tudo local, sem API, sem conta em lugar nenhum.

Por que corte e nao frame de N em N segundos: amostragem cega devolve quadro
aleatorio. Corte por troca de imagem devolve a decisao que o editor tomou.

Uso:
  python .claude/skills/analisar-video/extract.py <URL> <PASTA>
  python .claude/skills/analisar-video/extract.py --file <VIDEO> <PASTA>      # video que ja esta no seu disco
  python .claude/skills/analisar-video/extract.py <URL> <PASTA> --no-transcribe

Opcoes:
  --model medium     tamanho do modelo de transcricao (tiny/base/small/medium/large-v3)
  --scene 0.30       sensibilidade do corte. Mais alto = menos imagens
  --max-frames 24    teto de imagens. Passou disso, amostra ao longo do video inteiro

Sai na PASTA:
  video.mp4            o video baixado
  audio.wav            o audio extraido
  transcript.txt       a transcricao com o tempo de cada fala
  frames/hook.jpg      a primeira imagem (~0.5s), que nem sempre tem corte
  frames/scene_NNN.jpg uma imagem por corte
  meta.json            duracao, idioma, quantos cortes e em que segundo cada um
"""
import argparse
import glob
import html as htmllib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse

FFMPEG_INSTALL = {
    "Windows": "winget install ffmpeg",
    "Darwin": "brew install ffmpeg",
    "Linux": "sudo apt install ffmpeg",
}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def has_module(name):
    return importlib.util.find_spec(name) is not None


def stop(titulo, linhas):
    """Para com uma mensagem que ensina, em vez de cuspir traceback."""
    print(f"\n{titulo}\n", file=sys.stderr)
    for l in linhas:
        print(f"  {l}", file=sys.stderr)
    print("\n  Se voce esta no Claude Code, peca: \"instala isso pra mim\".\n",
          file=sys.stderr)
    sys.exit(2)


def preflight(url, quer_transcrever):
    """Confere as dependencias ANTES de comecar. Devolve se da pra transcrever.

    ffmpeg e obrigatorio sempre. O baixador depende de onde o video esta.
    Transcricao e opcional: sem ela o script ainda entrega as imagens.
    """
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        stop("Falta o ffmpeg pra continuar. E ele que corta o video em imagem.",
             [f"Windows:  {FFMPEG_INSTALL['Windows']}",
              f"macOS:    {FFMPEG_INSTALL['Darwin']}",
              f"Linux:    {FFMPEG_INSTALL['Linux']}"])

    if url and pick_resolver(url) == "instagram" and not has_module("curl_cffi"):
        stop("Falta o curl_cffi pra baixar do Instagram.",
             ["pip install curl_cffi",
              "",
              "Ou baixe o video na mao e rode com:",
              f"  python {sys.argv[0]} --file <arquivo> <pasta>"])

    if url and pick_resolver(url) == "ytdlp" and not has_module("yt_dlp"):
        stop("Falta o yt-dlp pra baixar do YouTube/TikTok.",
             ["pip install yt-dlp",
              "",
              "Ou baixe o video na mao e rode com:",
              f"  python {sys.argv[0]} --file <arquivo> <pasta>"])

    if quer_transcrever and not has_module("faster_whisper"):
        print("\n  AVISO: faster-whisper nao esta instalado.", file=sys.stderr)
        print("  Seguindo SEM transcricao: voce vai receber so as imagens.", file=sys.stderr)
        print("  Para ter a transcricao tambem: pip install faster-whisper\n", file=sys.stderr)
        return False
    return quer_transcrever


def pick_resolver(url):
    """Instagram tem caminho proprio. O resto (YouTube, Shorts, TikTok...) e yt-dlp."""
    host = urllib.parse.urlparse(url).netloc.lower()
    return "instagram" if "instagram.com" in host else "ytdlp"


def _clean_ig_url(u):
    """A URL de midia vem escapada dentro do JSON da pagina: corta o XML que
    vaza depois dela e desescapa os \\uXXXX e as entidades HTML."""
    u = u.split("\\u003C")[0].split("<")[0]
    u = (u.replace("\\u0026", "&").replace("\\u002F", "/").replace("\\/", "/")
          .replace("\\u0025", "%").replace("\\u003D", "="))
    return htmllib.unescape(u)


def parse_dash_streams(page):
    """(melhor video, melhor audio) do manifesto DASH embutido na pagina.

    O Instagram entrega video e audio em faixas separadas e ordena cada uma da
    melhor pra pior, entao o primeiro BaseURL de cada faixa e a maior qualidade.
    """
    m = re.search(r'"video_dash_manifest":"(.*?)","', page, re.DOTALL)
    if not m:
        return None, None
    xml = (m.group(1).replace('\\u003C', '<').replace('\\u003E', '>')
           .replace('\\u0026', '&').replace('\\"', '"').replace('\\/', '/')
           .replace('\\u0025', '%').replace('\\u003D', '='))
    xml = htmllib.unescape(xml)

    def pick(content_type):
        for aset in re.split(r'(?=<AdaptationSet)', xml):
            if f'contentType="{content_type}"' in aset:
                urls = re.findall(r'<BaseURL>(https:[^<]+)</BaseURL>', aset)
                return urls[0] if urls else None
        return None

    return pick("video"), pick("audio")


def _ig_meta(page):
    """Legenda, autor e engajamento, tirados da propria metadata da pagina.

    Le a tag og:description, que o Instagram preenche com os dados DESTE post e
    tem esta cara:

        647 likes, 1,833 comments - fulano on August 1, 2026: "a legenda..."

    Nao adianta caçar a legenda no JSON embutido: a pagina carrega outros posts
    junto (conteudo relacionado) e o regex casa com o post errado sem avisar.
    Legenda errada e pior que legenda nenhuma, porque a analise sai em cima dela.
    Tudo aqui e best-effort: se nao achar, devolve vazio e o download segue.
    """
    vazio = {"caption": "", "owner": None, "engagement": None}
    m = re.search(r'<meta property="og:description" content="(.*?)"\s*/?>', page, re.DOTALL)
    if not m:
        return vazio
    desc = htmllib.unescape(m.group(1))

    cabecalho, sep, caption = desc.partition(': "')
    if not sep:
        return vazio
    caption = caption.rstrip()
    caption = caption[:-2] if caption.endswith('".') else caption.rstrip('"')

    autor = re.search(r'(\S+) on \w+ \d+, \d{4}', cabecalho)
    engajamento = cabecalho.split(" - ")[0].strip() if " - " in cabecalho else None
    return {"caption": caption,
            "owner": autor.group(1) if autor else None,
            "engagement": engajamento}


def instagram_download(url, out_dir):
    """Baixa um reel publico sem login e sem conta: busca a pagina como browser,
    tira as faixas do DASH (ou o mp4 progressivo do formato antigo) e muxa.
    Devolve (caminho, info) ou (None, None) se o post nao tiver video."""
    from curl_cffi import requests as creq
    try:
        s = creq.Session(impersonate="chrome")
        page = s.get(url, timeout=60).text
    except Exception as e:
        print(f"      instagram: a pagina nao respondeu ({e})", file=sys.stderr)
        return None, None

    hdrs = {"Referer": "https://www.instagram.com/"}
    dest = os.path.join(out_dir, "video.mp4")

    def baixa(u, path):
        r = s.get(_clean_ig_url(u), timeout=180, headers=hdrs)
        with open(path, "wb") as f:
            f.write(r.content)
        return r.status_code

    video, audio = parse_dash_streams(page)
    if video:
        vp = os.path.join(out_dir, "_v.mp4")
        if baixa(video, vp) not in (200, 206):
            print("      instagram: o download da imagem falhou", file=sys.stderr)
            return None, None
        if audio:
            ap = os.path.join(out_dir, "_a.mp4")
            baixa(audio, ap)
            run(["ffmpeg", "-y", "-i", vp, "-i", ap, "-c", "copy", dest, "-loglevel", "error"])
            for p in (vp, ap):
                if os.path.exists(p):
                    os.remove(p)
        else:
            shutil.move(vp, dest)
        return dest, _ig_meta(page)

    # formato antigo: mp4 unico, ja com audio dentro
    prog = re.search(r'"video_versions":\[\{[^]]*?"url":"(https:[^"]+?\.mp4[^"]*)"', page)
    if prog and baixa(prog.group(1), dest) in (200, 206):
        return dest, _ig_meta(page)

    return None, None


def found(out_dir):
    hits = [f for f in glob.glob(os.path.join(out_dir, "video.*"))
            if not f.endswith((".part", ".ytdl"))]
    return hits[0] if hits else None


def download(url, out_dir):
    """Devolve (caminho, metodo, info) ou (None, None, None)."""
    if pick_resolver(url) == "instagram":
        path, info = instagram_download(url, out_dir)
        return (path, "instagram", info) if path else (None, None, None)

    tmpl = os.path.join(out_dir, "video.%(ext)s")
    r = run([sys.executable, "-m", "yt_dlp", "-f", "bv*+ba/b",
             "--merge-output-format", "mp4", "-o", tmpl, url])
    hit = found(out_dir)
    if hit:
        return hit, "yt-dlp", None
    # sem isto o erro do yt-dlp some e sobra uma mensagem generica que nao ajuda
    for linha in [l for l in r.stderr.strip().splitlines() if l.strip()][-3:]:
        print(f"      yt-dlp: {linha}", file=sys.stderr)
    return None, None, None


def duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def extract_audio(video, out_dir):
    wav = os.path.join(out_dir, "audio.wav")
    run(["ffmpeg", "-y", "-i", video, "-ar", "16000", "-ac", "1",
         "-c:a", "pcm_s16le", wav, "-loglevel", "error"])
    return wav


def transcribe(wav, model_name):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    # idioma NUNCA forcado: deixa o whisper detectar. Forcar erra em video misto.
    segments, info = model.transcribe(wav, vad_filter=True)
    lines = []
    for s in segments:
        ts = f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}]"
        lines.append(f"{ts} {s.text.strip()}")
    header = f"# lang={info.language} prob={info.language_probability:.2f} dur={info.duration:.1f}s\n"
    return header + "\n".join(lines), info.language, info.language_probability


def sample_indices(n_total, max_frames):
    """Indices espalhados por [0, n_total) capados em max_frames, mantendo o
    primeiro e o ultimo corte. Video longo cobre inteiro em vez de so o comeco."""
    if n_total <= max_frames:
        return list(range(n_total))
    den = max(max_frames - 1, 1)
    return sorted({round(i * (n_total - 1) / den) for i in range(max_frames)})


def extract_frames(video, out_dir, scene, max_frames):
    frames_dir = os.path.join(out_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    # a primeira imagem (~0.5s) sai sempre: o comeco raramente tem "corte"
    run(["ffmpeg", "-y", "-ss", "0.5", "-i", video, "-frames:v", "1",
         "-vf", "scale=-2:640", os.path.join(frames_dir, "hook.jpg"),
         "-loglevel", "error"])

    # passada 1: acha TODOS os cortes sem escrever imagem, pra nao enviesar
    # pros primeiros N quando o video for longo
    r = run(["ffmpeg", "-i", video,
             "-vf", f"select='gt(scene,{scene})',showinfo",
             "-fps_mode", "vfr", "-f", "null", "-", "-loglevel", "info"])
    all_times = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", r.stderr)]

    truncated = len(all_times) > max_frames
    times = [all_times[i] for i in sample_indices(len(all_times), max_frames)]

    # passada 2: uma imagem por corte escolhido
    for i, t in enumerate(times, 1):
        run(["ffmpeg", "-y", "-ss", str(t), "-i", video, "-frames:v", "1",
             "-vf", "scale=-2:640", os.path.join(frames_dir, f"scene_{i:03d}.jpg"),
             "-loglevel", "error"])

    return len(times), times, truncated


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?")
    ap.add_argument("out_dir")
    ap.add_argument("--file", help="video que ja esta no seu disco (pula o download)")
    ap.add_argument("--model", default="medium")
    ap.add_argument("--scene", type=float, default=0.30)
    ap.add_argument("--max-frames", type=int, default=24)
    ap.add_argument("--no-transcribe", action="store_true",
                    help="pula a transcricao (quando voce ja tem o texto)")
    args = ap.parse_args()
    if not args.url and not args.file:
        ap.error("passe uma URL ou --file <video>")

    transcrever = preflight(args.url if not args.file else None,
                            not args.no_transcribe)

    os.makedirs(args.out_dir, exist_ok=True)

    info = None
    if args.file:
        print(f"[1/4] arquivo local: {args.file}", flush=True)
        if not os.path.exists(args.file):
            print(f"Nao achei o arquivo: {args.file}", file=sys.stderr)
            sys.exit(2)
        video, method = args.file, "arquivo"
    else:
        print("[1/4] baixando...", flush=True)
        video, method, info = download(args.url, args.out_dir)
        if not video:
            print("\nNao consegui baixar esse video.\n", file=sys.stderr)
            print("  Pode ser um post privado, um post sem video, ou o site mudou.",
                  file=sys.stderr)
            print("  YouTube e TikTok quebram de vez em quando: tente atualizar o",
                  file=sys.stderr)
            print("  baixador com  pip install -U yt-dlp  e rodar de novo.\n",
                  file=sys.stderr)
            print("  Saida que sempre funciona: baixe o video na mao e rode\n",
                  file=sys.stderr)
            print(f"    python {sys.argv[0]} --file <arquivo> {args.out_dir}\n",
                  file=sys.stderr)
            sys.exit(2)
        print(f"      ok via {method}: {os.path.basename(video)}")

    dur = duration(video)

    if not transcrever:
        print("[2/3] transcricao pulada", flush=True)
        lang, prob = None, None
    else:
        print(f"[2/4] audio ({dur:.1f}s)...", flush=True)
        wav = extract_audio(video, args.out_dir)
        print(f"[3/4] transcrevendo (faster-whisper {args.model}, local)...", flush=True)
        transcript, lang, prob = transcribe(wav, args.model)
        tpath = os.path.join(args.out_dir, "transcript.txt")
        with open(tpath, "w", encoding="utf-8") as f:
            f.write(transcript)
        print(f"      idioma={lang} ({prob:.2f}) -> {tpath}")

    step = "3/3" if not transcrever else "4/4"
    print(f"[{step}] cortando (scene>{args.scene}, teto de {args.max_frames})...", flush=True)
    n, times, truncated = extract_frames(video, args.out_dir, args.scene, args.max_frames)
    cps = (n / dur) if dur else 0
    print(f"      {n} imagens | ~{cps:.2f} cortes/s" +
          (" | TETO: amostrado ao longo do video inteiro" if truncated else ""))

    meta = {"method": method, "duration": dur, "language": lang,
            "language_prob": prob, "scene_threshold": args.scene,
            "n_frames": n, "cut_times": times, "truncated": truncated,
            "caption": (info or {}).get("caption", ""),
            "owner": (info or {}).get("owner"),
            "engagement": (info or {}).get("engagement")}
    # legenda com emoji quebrado pode estourar o encode: nao vale perder o meta por isso
    with open(os.path.join(args.out_dir, "meta.json"), "w",
              encoding="utf-8", errors="replace") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    saida = "frames/" if not transcrever else "frames/ + transcript.txt"
    print(f"\nPRONTO. Agora leia {saida} + meta.json pra decompor o video.")


if __name__ == "__main__":
    main()
