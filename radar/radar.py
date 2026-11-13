#!/usr/bin/env python3
"""Radar: acha o reel que fugiu da média do próprio criador.

Lê a lista de criadores (criadores.md), busca os reels recentes de cada um no Instagram
pela Apify, e ordena pelo breakout: views do reel divididas pela mediana dos reels
recentes daquele mesmo criador. Não ordena por views brutas.

Só biblioteca padrão do Python. A única conta necessária é a da Apify (token em .env).

Comandos (todos aceitam --pasta, padrão ./radar-dados):
  python radar.py custo                  estima o custo e mostra o saldo. Não gasta nada.
  python radar.py buscar --sim           busca, ranqueia e baixa os vídeos. Gasta crédito da Apify.
  python radar.py buscar --fixture X     mesmo fluxo lendo um JSON salvo (teste, sem gastar).
  python radar.py html                   monta a shortlist.html a partir do candidatos.json.
  python radar.py vistos --ids a,b       marca reels como vistos pra não voltarem.
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request

ACTOR = "apify~instagram-scraper"
PRECO_POR_RESULTADO = float(os.environ.get("RADAR_PRECO", "0.0027"))  # plano grátis da Apify
TETO = 2.0  # dólares por busca; acima disso o radar se recusa a rodar
FOLGA_FIXADOS = 3  # busca uns reels a mais porque os fixados saem da conta
POR_CHAMADA = 5  # perfis por chamada; a Apify corta chamada síncrona em ~300s


# ---------- leitura ----------

def ler_criadores(texto):
    """'- @perfil' vira handle. Um '## Grupo' acima vira o grupo do perfil."""
    criadores, grupo = [], None
    for linha in texto.splitlines():
        cab = re.match(r"^##\s+(.+?)\s*$", linha)
        if cab:
            grupo = cab.group(1).strip()
            continue
        item = re.match(r"^\s*-\s+@?([A-Za-z0-9._]+)", linha)
        if item:
            criadores.append({"handle": item.group(1), "grupo": grupo})
    return criadores


def ler_env(pasta):
    """APIFY_TOKEN do ambiente ou do .env da pasta de dados."""
    if os.environ.get("APIFY_TOKEN"):
        return os.environ["APIFY_TOKEN"]
    caminho = os.path.join(pasta, ".env")
    if os.path.exists(caminho):
        for linha in open(caminho, encoding="utf-8"):
            if linha.strip().startswith("APIFY_TOKEN="):
                return linha.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def normalizar(bruto):
    code = bruto.get("shortCode") or bruto.get("shortcode") or bruto.get("code")
    views = bruto.get("videoViewCount")
    if views is None:
        views = bruto.get("videoPlayCount")
    return {
        "id": code or bruto.get("id"),
        "url": bruto.get("url") or (f"https://www.instagram.com/reel/{code}/" if code else None),
        "criador": (bruto.get("ownerUsername") or "").lower(),
        "views": views,
        "likes": bruto.get("likesCount"),
        "comentarios": bruto.get("commentsCount"),
        "data": bruto.get("timestamp"),
        "legenda": bruto.get("caption") or "",
        "thumb": bruto.get("displayUrl") or bruto.get("thumbnailUrl"),
        "video": bruto.get("videoUrl"),
        "fixado": bool(bruto.get("isPinned") or bruto.get("pinned")),
        "tipo": (bruto.get("type") or bruto.get("productType") or "").lower(),
    }


def e_reel(r):
    return not any(t in r["tipo"] for t in ("image", "sidecar", "carousel"))


# ---------- conta ----------

def mediana(nums):
    v = sorted(n for n in nums if isinstance(n, (int, float)))
    if not v:
        return 0
    m = len(v) // 2
    return v[m] if len(v) % 2 else (v[m - 1] + v[m]) / 2


def data(iso):
    return dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))


def ranquear(reels, agora, janela_dias, amostra):
    """Breakout = views / mediana do próprio criador (sem fixados). Só entra quem saiu na janela."""
    por_criador = {}
    for r in reels:
        if r["criador"] and not r["fixado"] and r["data"]:
            por_criador.setdefault(r["criador"], []).append(r)
    saida = []
    for criador, lista in por_criador.items():
        lista = sorted(lista, key=lambda r: r["data"], reverse=True)[:amostra]
        base_views = mediana([r["views"] for r in lista])
        base_likes = mediana([r["likes"] for r in lista])
        for r in lista:
            idade = (agora - data(r["data"])).total_seconds() / 86400
            if idade < 0 or idade > janela_dias:
                continue
            if isinstance(r["views"], (int, float)) and r["views"] > 0 and base_views > 0:
                breakout = r["views"] / base_views
            elif isinstance(r["likes"], (int, float)) and base_likes > 0:
                breakout = r["likes"] / base_likes
            else:
                breakout = 0
            saida.append({**r, "mediana_criador": base_views, "breakout": round(breakout, 2),
                          "poucos_dados": len(lista) < 5, "idade_dias": round(idade, 1)})
    return sorted(saida, key=lambda r: r["breakout"], reverse=True)


def custo(n_criadores, amostra):
    return round(n_criadores * (amostra + FOLGA_FIXADOS) * PRECO_POR_RESULTADO, 4)


# ---------- rede ----------

def http_json(url, corpo=None, timeout=310):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode() if corpo is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def saldo(token):
    d = http_json(f"https://api.apify.com/v2/users/me/limits?token={token}", timeout=30)["data"]
    return d["limits"]["maxMonthlyUsageUsd"] - d["current"]["monthlyUsageUsd"]


def buscar_apify(handles, token, por_criador):
    url = f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items?token={token}"
    tudo = []
    for i in range(0, len(handles), POR_CHAMADA):
        grupo = handles[i:i + POR_CHAMADA]
        print(f"  buscando {', '.join('@' + h for h in grupo)}...", flush=True)
        tudo += http_json(url, {"directUrls": [f"https://www.instagram.com/{h}/" for h in grupo],
                                "resultsType": "reels", "resultsLimit": por_criador})
    return tudo


def baixar(url, destino):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(destino, "wb") as f:
            f.write(resp.read())
        return True
    except (urllib.error.URLError, OSError, ValueError):
        return False


# ---------- comandos ----------

def carregar(pasta):
    caminho = os.path.join(pasta, "criadores.md")
    if not os.path.exists(caminho):
        sys.exit(f"Falta {caminho}. Rode o onboarding da skill (ela pergunta os criadores e cria o arquivo).")
    criadores = ler_criadores(open(caminho, encoding="utf-8").read())
    if not criadores:
        sys.exit(f"{caminho} não tem nenhum '- @perfil'.")
    return criadores


def cmd_custo(a):
    criadores = carregar(a.pasta)
    estimativa = custo(len(criadores), a.amostra)
    print(f"CUSTO_ESTIMADO=${estimativa} ({len(criadores)} criadores x {a.amostra + FOLGA_FIXADOS} reels"
          f" x ${PRECO_POR_RESULTADO})")
    if estimativa > TETO:
        print(f"ACIMA DO TETO de ${TETO}. Corte a lista de criadores ou a --amostra.")
        return 3
    token = ler_env(a.pasta)
    if not token:
        print(f"SEM_TOKEN: crie {os.path.join(a.pasta, '.env')} com a linha APIFY_TOKEN=seu_token")
        return 2
    try:
        livre = saldo(token)
        print(f"SALDO_APIFY=${livre:.2f} livres neste mês")
        if livre < estimativa:
            print("SALDO INSUFICIENTE: o limite da Apify reseta no dia 1 de cada mês.")
            return 4
    except (urllib.error.URLError, KeyError, ValueError) as e:
        print(f"SALDO: não deu pra consultar ({e}).")
    return 0


def cmd_buscar(a):
    criadores = carregar(a.pasta)
    if a.fixture:
        brutos = json.load(open(a.fixture, encoding="utf-8"))
    else:
        if not a.sim:
            sys.exit("Isso gasta crédito da Apify. Rode 'custo' primeiro e depois 'buscar --sim'.")
        if custo(len(criadores), a.amostra) > TETO:
            sys.exit(f"Estimativa acima do teto de ${TETO}.")
        token = ler_env(a.pasta)
        if not token:
            sys.exit("Sem APIFY_TOKEN. Rode 'custo' pra ver como configurar.")
        try:
            brutos = buscar_apify([c["handle"] for c in criadores], token, a.amostra + FOLGA_FIXADOS)
        except urllib.error.HTTPError as e:
            sys.exit(f"A Apify respondeu {e.code}: {e.read().decode(errors='replace')[:500]}")

    reels = [r for r in map(normalizar, brutos) if e_reel(r)]
    achados = {r["criador"] for r in reels}
    faltando = [c["handle"] for c in criadores if c["handle"].lower() not in achados]
    grupo = {c["handle"].lower(): c["grupo"] for c in criadores}
    agora = data(a.agora) if a.agora else dt.datetime.now(dt.timezone.utc)

    vistos_path = os.path.join(a.pasta, "vistos.json")
    vistos = json.load(open(vistos_path)) if os.path.exists(vistos_path) else {}
    ranking = [r for r in ranquear(reels, agora, a.dias, a.amostra)
               if r["id"] not in vistos and r["breakout"] >= a.piso][:a.top]
    for r in ranking:
        r["grupo"] = grupo.get(r["criador"])

    run = os.path.join(a.pasta, "runs", agora.strftime("%Y-%m-%d"))
    os.makedirs(os.path.join(run, "videos"), exist_ok=True)
    if not a.sem_video:
        for r in ranking:
            if r["video"]:
                destino = os.path.join(run, "videos", f"{r['id']}.mp4")
                r["video_local"] = f"videos/{r['id']}.mp4" if baixar(r["video"], destino) else None
    json.dump(ranking, open(os.path.join(run, "candidatos.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"OK: {len(ranking)} candidatos em {run}/candidatos.json")
    if faltando:
        print(f"SEM_REELS: {' '.join('@' + h for h in faltando)} (perfil privado, nome errado ou nada recente)")
    return 0


def milhar(n):
    return f"{int(n or 0):,}".replace(",", ".")


def decimal(x):
    return f"{x:.1f}".replace(".", ",")


def cmd_html(a):
    run = a.run or sorted(os.scandir(os.path.join(a.pasta, "runs")), key=lambda e: e.name)[-1].path
    cands = json.load(open(os.path.join(run, "candidatos.json"), encoding="utf-8"))
    e = html.escape
    cards = []
    for c in cands:
        if c.get("no_nicho") is False:
            continue
        midia = (f'<video src="{e(c["video_local"])}" controls preload="metadata"></video>'
                 if c.get("video_local") else f'<img src="{e(c.get("thumb") or "")}" alt="">')
        extra = "".join(f"<p><b>{rot}</b> {e(c[k])}</p>" for k, rot in
                        (("porque", "Por quê:"), ("angulo", "Ângulo:"), ("formato", "Formato:"))
                        if c.get(k))
        cards.append(f"""<article>{midia}<div>
<h2><a href="{e(c['url'] or '')}" target="_blank">@{e(c['criador'])}</a> <span>{decimal(c['breakout'])}x a média dele</span></h2>
<p class="meta">{milhar(c['views'])} views · mediana dele {milhar(c['mediana_criador'])} · {decimal(c['idade_dias'])} dias{' · poucos dados' if c['poucos_dados'] else ''}</p>
{extra}<p class="leg">{e((c['legenda'] or '')[:280])}</p></div></article>""")
    pagina = f"""<!doctype html><meta charset="utf-8"><title>Radar</title>
<style>body{{font-family:system-ui,sans-serif;max-width:980px;margin:32px auto;padding:0 16px;color:#111}}
article{{display:flex;gap:20px;border-top:1px solid #ddd;padding:20px 0}}
video,img{{width:240px;aspect-ratio:9/16;object-fit:cover;background:#eee;border-radius:8px;flex:none}}
h2{{font-size:18px;margin:0 0 4px}} h2 span{{font-weight:600;color:#c2410c;margin-left:8px}}
.meta{{color:#666;font-size:13px;margin:0 0 12px}} .leg{{color:#555;font-size:13px}} a{{color:inherit}}</style>
<h1>Radar · {len(cards)} reels que fugiram da média</h1>{''.join(cards) or '<p>Nenhum reel acima do piso nesta janela.</p>'}"""
    destino = os.path.join(run, "shortlist.html")
    open(destino, "w", encoding="utf-8").write(pagina)
    print(f"OK: {destino}")
    return 0


def cmd_vistos(a):
    caminho = os.path.join(a.pasta, "vistos.json")
    vistos = json.load(open(caminho)) if os.path.exists(caminho) else {}
    hoje = dt.date.today().isoformat()
    for i in filter(None, a.ids.split(",")):
        vistos.setdefault(i.strip(), hoje)
    json.dump(vistos, open(caminho, "w"), indent=2)
    print(f"OK: {len(vistos)} vistos")
    return 0


def main():
    p = argparse.ArgumentParser(description="Radar de reels acima da média")
    p.add_argument("--pasta", default="radar-dados")
    sub = p.add_subparsers(dest="cmd", required=True)
    for nome in ("custo", "buscar"):
        s = sub.add_parser(nome)
        s.add_argument("--amostra", type=int, default=12, help="reels recentes por criador pra mediana")
    b = sub.choices["buscar"]
    b.add_argument("--sim", action="store_true", help="confirma o gasto na Apify")
    b.add_argument("--fixture", help="JSON da Apify salvo (teste sem gastar)")
    b.add_argument("--dias", type=int, default=21, help="janela de reels recentes")
    b.add_argument("--top", type=int, default=15)
    b.add_argument("--piso", type=float, default=1.5, help="breakout mínimo pra entrar na lista")
    b.add_argument("--agora", help="data de referência ISO (teste)")
    b.add_argument("--sem-video", action="store_true")
    h = sub.add_parser("html")
    h.add_argument("--run", help="pasta do run (padrão: o mais recente)")
    v = sub.add_parser("vistos")
    v.add_argument("--ids", required=True)
    a = p.parse_args()
    return {"custo": cmd_custo, "buscar": cmd_buscar, "html": cmd_html, "vistos": cmd_vistos}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
