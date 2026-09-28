# Mijn eerste Mod

Gemaakt met **BlockyMod Studio** 🟩

- **Mod-id:** `mijn_eerste_mod`
- **Minecraft:** 26.3 (Fabric, Java 25+)
- **Mappings:** officiële Mojang-mappings (standaard sinds Minecraft 26.1)
- **Pakket:** `com.modder.mijn_eerste_mod`
- **Auteur:** Modder

> ⚠️ **Laatste-versie-doel:** dit project is gegenereerd voor Minecraft 26.3.
> Fabric API-namen zijn recent gewijzigd – als er een kleine compilefout is,
> plak die in de chat en dan fix ik hem in `ai-code/`.

## Openen & draaien

1. Open deze map in **IntelliJ IDEA** (met de Gradle-plugin) of in VS Code.
2. Laat Gradle syncen (internet nodig – Fabric Loom wordt gedownload). Gebruik **Gradle 9.4+** (nodig voor Loom 1.15).
3. Draai de client met het Gradle-taak `runClient`.

> Geen Gradle geïnstalleerd? Installeer het of gebruik je IDE's Gradle-integratie.
> De wrapper-jar zit bewust niet in de ZIP; één keer `gradle wrapper` maken is voldoende.

## Wat zit er in?

| Map | Wat |
|-----|-----|
| `src/main/java/com.modder.mijn_eerste_mod/` | Al je Java-code (registratie, GUI's, mobs, verhaal) |
| `src/main/resources/assets/mijn_eerste_mod/` | Texturen, models, blockstates, taal, GUI-texturen |
| `src/main/resources/data/mijn_eerste_mod/` | Recepten & verhaallijn (datapack-stijl) |
| `ai-code/` | **Jouw AI-code** – hier komen de codes die ik voor je schrijf |

## AI-code workflow 🤖

1. Ik (de AI) zet code in de `ai-code/`-map op **GitHub** (in jouw branch).
2. Open BlockyMod Studio → **🤖 AI-code / GitHub** → **Codes ophalen bij GitHub**.
3. Exporteer opnieuw – de codes zitten dan in je mod.

## Structuur die de app heeft aangemaakt

- 3 blok(ken), 1 item(s), 2 GUI('s),
  1 mob(s), 1 werkbank(en),
  2 verhaalhoofdstuk(ken).

Veel bouwplezier! 🎮
