#!/usr/bin/env python3
"""Auto-check do extract.py. Voce NAO precisa rodar isso pra usar a skill.

Ele existe pra provar que as partes que leem texto (rota, manifesto do
Instagram, limpeza de URL, amostragem) continuam certas se alguem mexer no
codigo. Sem rede, sem dependencia, sem framework.

    python test_extract.py
"""
import importlib.util
import pathlib

_HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("extract", _HERE / "extract.py")
EX = importlib.util.module_from_spec(spec)
spec.loader.exec_module(EX)  # so define funcoes; main() nao roda


def test_rota_por_site():
    assert EX.pick_resolver("https://www.instagram.com/p/ABC123/") == "instagram"
    assert EX.pick_resolver("https://instagram.com/reel/ABC123/") == "instagram"
    assert EX.pick_resolver("https://www.youtube.com/shorts/xYz") == "ytdlp"
    assert EX.pick_resolver("https://youtu.be/xYz") == "ytdlp"
    assert EX.pick_resolver("https://www.tiktok.com/@x/video/123") == "ytdlp"


# pagina do Instagram como ela chega de verdade: o XML vem escapado dentro do JSON
PAGINA = (
    r'{"video_dash_manifest":"'
    r'<AdaptationSet contentType=\"video\">'
    r'<BaseURL>https://cdn.exemplo/v_alta.mp4</BaseURL>'
    r'<BaseURL>https://cdn.exemplo/v_baixa.mp4</BaseURL>'
    r'</AdaptationSet>'
    r'<AdaptationSet contentType=\"audio\">'
    r'<BaseURL>https://cdn.exemplo/a.mp4</BaseURL>'
    r'</AdaptationSet>'
    r'","viewer":null}'
    # a metadata do post, do jeito que o Instagram escreve
    '<meta property="og:description" content="647 likes, 1,833 comments - '
    'fulano on August 1, 2026: &quot;primeira linha\n\nsegunda linha&quot;. " />'
    # e um post DE OUTRA PESSOA, que a pagina carrega junto como relacionado
    '<script>{"caption":{"text":"legenda do post errado"},'
    '"owner":{"username":"outro_qualquer"}}</script>'
)


def test_manifesto_dash():
    video, audio = EX.parse_dash_streams(PAGINA)
    # o Instagram ordena da melhor pra pior: a primeira faixa e a de maior qualidade
    assert video == "https://cdn.exemplo/v_alta.mp4", video
    assert audio == "https://cdn.exemplo/a.mp4", audio
    # pagina sem manifesto nao pode explodir, so devolver vazio
    assert EX.parse_dash_streams('{"nada":"aqui"}') == (None, None)


def test_legenda_e_autor():
    meta = EX._ig_meta(PAGINA)
    assert meta["owner"] == "fulano", meta
    assert meta["engagement"] == "647 likes, 1,833 comments", meta
    # a legenda sai inteira, com as quebras de linha
    assert meta["caption"] == "primeira linha\n\nsegunda linha", repr(meta["caption"])
    # e NUNCA pode ser a do post relacionado que a pagina carregou junto
    assert "errado" not in meta["caption"] and meta["owner"] != "outro_qualquer", meta
    # pagina sem nada disso nao quebra o download
    assert EX._ig_meta("{}") == {"caption": "", "owner": None, "engagement": None}


def test_limpeza_de_url():
    sujo = r"https://cdn/x.mp4?a=1&b=2</BaseURL>"
    assert EX._clean_ig_url(sujo) == "https://cdn/x.mp4?a=1&b=2"


def test_amostragem():
    # cabe no teto: sai tudo
    assert EX.sample_indices(5, 24) == [0, 1, 2, 3, 4]
    # estourou o teto: cobre o video inteiro, do primeiro ao ultimo corte
    idx = EX.sample_indices(100, 10)
    assert len(idx) == 10, idx
    assert idx[0] == 0 and idx[-1] == 99, idx
    assert idx == sorted(idx)


def test_carrossel_nao_bloqueia_o_download():
    """Regressao real: uma versao antiga desistia do caminho gratis quando a
    palavra carousel_media aparecia na pagina. Ela aparece em quase todo reel
    por causa do conteudo relacionado, entao o download gratis quase nunca
    rodava. O guard nao pode voltar."""
    fonte = (_HERE / "extract.py").read_text(encoding="utf-8")
    assert "carousel" not in fonte, "o guard de carrossel voltou e vai matar a rota gratis"


if __name__ == "__main__":
    for nome, fn in sorted(globals().items()):
        if nome.startswith("test_"):
            fn()
            print(f"ok  {nome}")
    print("\nTudo certo.")
