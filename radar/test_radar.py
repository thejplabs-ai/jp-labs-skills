#!/usr/bin/env python3
"""Auto-check do radar.py. Você NÃO precisa rodar isso pra usar a skill.

Prova que a leitura dos criadores e a conta do breakout continuam certas se alguém
mexer no código. Sem rede, sem dependência, sem framework.

    python test_radar.py
"""
import datetime as dt
import importlib.util
import pathlib

_HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("radar", _HERE / "radar.py")
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)  # só define funções; main() não roda

AGORA = dt.datetime(2026, 11, 13, 23, 59, tzinfo=dt.timezone.utc)


def reel(id, views, dias_atras, criador="ana", fixado=False):
    quando = (AGORA - dt.timedelta(days=dias_atras)).isoformat().replace("+00:00", "Z")
    return {"id": id, "criador": criador, "views": views, "likes": None, "data": quando,
            "fixado": fixado}


def test_le_criadores_com_e_sem_grupo():
    txt = "# meus criadores\n- @ana.ia\n## Concorrentes\n- bob_dev  (posta toda semana)\n-  @c.3\n"
    assert R.ler_criadores(txt) == [
        {"handle": "ana.ia", "grupo": None},
        {"handle": "bob_dev", "grupo": "Concorrentes"},
        {"handle": "c.3", "grupo": "Concorrentes"},
    ]


def test_mediana():
    assert R.mediana([5, 1, 3]) == 3
    assert R.mediana([1, 2, 3, 4]) == 2.5
    assert R.mediana([None, 2]) == 2
    assert R.mediana([]) == 0


def test_breakout_ganha_de_views_brutas():
    # o post grande da Ana é a rotina dela; o pequeno do Bob fugiu da média dele
    reels = [reel(f"a{i}", 100_000, 30 + i) for i in range(6)] + [reel("a-hoje", 120_000, 2)]
    reels += [reel(f"b{i}", 1_000, 30 + i, "bob") for i in range(6)] + [reel("b-hoje", 9_000, 3, "bob")]
    r = R.ranquear(reels, AGORA, janela_dias=21, amostra=12)
    assert [x["id"] for x in r] == ["b-hoje", "a-hoje"]
    assert r[0]["breakout"] == 9.0


def test_fixado_nao_entra_na_conta_nem_no_ranking():
    reels = [reel(f"a{i}", 1_000, 30 + i) for i in range(6)]
    reels += [reel("fixado", 5_000_000, 1, fixado=True), reel("novo", 3_000, 1)]
    r = R.ranquear(reels, AGORA, 21, 12)
    assert [x["id"] for x in r] == ["novo"]
    assert r[0]["breakout"] == 3.0


def test_janela_corta_reel_velho():
    reels = [reel("velho", 9_000, 40)] + [reel(f"a{i}", 1_000, i + 1) for i in range(5)]
    assert "velho" not in [x["id"] for x in R.ranquear(reels, AGORA, 21, 12)]


def test_normaliza_formato_da_apify():
    n = R.normalizar({"shortCode": "XYZ", "ownerUsername": "Ana", "videoPlayCount": 10,
                      "type": "Video", "isPinned": True})
    assert n["id"] == "XYZ" and n["criador"] == "ana" and n["views"] == 10 and n["fixado"]
    assert n["url"] == "https://www.instagram.com/reel/XYZ/"
    assert not R.e_reel(R.normalizar({"type": "Sidecar"}))


def test_custo():
    assert R.custo(10, 12) == round(10 * 15 * R.PRECO_POR_RESULTADO, 4)


if __name__ == "__main__":
    n = 0
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_"):
            f()
            n += 1
            print(f"ok  {nome}")
    print(f"\n{n} testes passaram")
