# 🟩 BlockyMod Studio

**Een Windows-app waarmee je simpel Minecraft-mods maakt** – blokken, items,
werkbanken met eigen GUI, mobs (met interactie-GUI) én een verhaallijn, zonder
dat je één regel code hoeft te typen. De app genereert een complete
**Fabric-mod** (Java + assets + recepten) als ZIP.

```
🟩 Overzicht     🧱 Blokken      🗡️ Items       🛠️ Werkbanken
🖼️ GUI's         🐷 Mobs         📖 Verhaal     🤖 AI-code / GitHub
```

---

## 🚀 Starten op Windows

**Optie 1 – via de command prompt (downloaden + starten)**

> Heb je [Git](https://git-scm.com/download/win) + [Node.js](https://nodejs.org)? Plak dit in `cmd`:
>
> ```bat
> git clone -b arena/01a0e754-blockymoding https://github.com/Ven1x-cloud/blockymoding.git
> cd blockymoding
> npm install
> npm start
> ```
>
> Zonder Git? Dan eerst de ZIP ophalen (mapnamen kunnen iets afwijken – gebruik `dir` om te kijken):
>
> ```bat
> curl -L -o blockymoding.zip https://github.com/Ven1x-cloud/blockymoding/archive/refs/heads/arena/01a0e754-blockymoding.zip
> tar -xf blockymoding.zip
> cd blockymoding-arena-01a0e754-blockymoding
> npm install
> npm start
> ```
>
> Je kunt dit gewoon in de **hoofdmap** van het project draaien – `npm install`
> pakt de app automatisch mee (de echte app zit in `\app`, dat regelt de root
> zelf). *(Na het samenvoegen van de PR naar `main` werkt dezelfde truc met `main`.)*
>
> Lukt de root-install niet (bijv. een npm-recursiefout op Windows)? Doe het
> handmatig – dat werkt altijd: `cd app` → `npm install` → `npm start`.

**Optie 2 – Electron-app (dubbelklik)**

> 1. Installeer [Node.js](https://nodejs.org) (één keer)
> 2. Dubbelklik op **`Start.bat`** (hoofdmap) of `app\Start.bat`
> 3. Klaar – de app opent in een eigen venster met logo

**Optie 3 – in je browser**

> Dubbelklik op **`app\OpenInBrowser.bat`** (of open `app/renderer/index.html`)

**🖥️ Bureaublad-koppeling**

> Dubbelklik één keer op **`app\MaakBureaubladkoppeling.bat`** – daarna staat
> **BlockyMod Studio** (met logo-icoon) op je bureaublad.

Alle data wordt lokaal opgeslagen (browser-opslag). Exporteren = één knop → ZIP.

---

## 🧱 Wat kun je maken?

| Onderdeel | Wat doet de app |
|-----------|-----------------|
| **Blokken** | Naam, hardheid, gereedschap, lichtsterkte + 16×16 textuur-editor met *auto-genereren* (steen, bakstenen, ertsen, hout, gras…) |
| **Items** | Naam, stapelgrootte + textuur-editor |
| **Werkbanken** | Maak in één keer een blok + typische Minecraft-3×3-GUI + recepten (vormgebonden/vormloos/smelten/smoken). Sleep slots/knoppen/labels heen: de Java-code volgt je ontwerp |
| **GUI's** | Volledige GUI-ontwerper (slots, knoppen, labels, pijlen, vlakken) in Minecraft-stijl |
| **Mobs** | Vreedzaam of hostiel, leven/snelheid/aanval/drops, spawn-ei-kleuren – **en** een eigen GUI bij rechtermuisklik |
| **Verhaal** | Hoofdstukken met triggers (inloggen, mob doden, blok/item rechtsklikken, locatie) en acties (bericht, item, GUI, spawn, weer, tijd, commando, volgend hoofdstuk) |
| **Export** | Knop **⬇ Exporteer mod** → complete Fabric-mod als ZIP (gradle, Java, texturen, recepten, verhaal-JSON) |

Standaard-doel: **Minecraft 26.3** – de laatste versie (sept 2026, "Wilderness Bound",
officiële Mojang-mappings, Java 25). Optioneel ook **1.20.1 / 1.21.1** (Yarn, Java 17/21).

> **Over 26.3:** sinds Minecraft 26.1 gebruikt Fabric officiële Mojang-mappings
> (Yarn is vervallen). De app genereert daar aparte templates voor – netjes volgens
> de [Fabric-docs (26.2)](https://docs.fabricmc.net/develop/items/first-item).
> Omdat Fabric API-namen recent veranderd zijn, kan het voorkomen dat één naam
> iets anders heet: **plak de compilefout in de chat** en dan fix ik hem in
> `ai-code/` – daarna haal je de fix met één knop op.

## 🧊 Nieuw: 3D-vorm, item-boost, enchants & animatie-triggers

- **3D-vorm-editor** (tab *Blokken*): sliders voor breedte/hoogte/diepte + een
  sleep-preview in 3D; presets (vol blok, halve steen, pilaar, plaat). Exporteert
  maatwerk model-JSON zodra de vorm afwijkt van 16³.
- **Blok-boost**: explosieweerstand, wrijving, geen-botsing, kaartkleur en
  willekeurige ticks naast hardheid/licht/gereedschap.
- **Item-boost**: zeldzaamheid, duurzaamheid, brandwerend, enchant-glinstering
  en beheksbaarheid.
- **Aangepaste enchants** (tab *Items*, kaart onderaan): schade, effect-bij-hit
  of terugslag → Minecraft 26.3 krijgt een data-driven enchantment-JSON,
  1.20.1 krijgt Java-registercode. Gebruik in-game: `/enchant @p <modid>:<id> <niveau>`.
- **Gedrag & animatie-triggers** (tab *Mobs*): presets (dwaalt, jager, vlucht,
  springer) plus triggers (spawn, aanval, rechtsklik, timer, laag leven). De
  export bevat kant-en-klare hook-code in de entity-klasse én een
  prompt-bestand `ai-code/animaties/<mob>.md` dat je zo aan de AI geeft.

## 🛡️ Nieuw: uitrusting, geluiden, quests, import & meer

- **Uitrusting (armor)** – kies per item een draagpositie (helm/borst/broek/laarzen).
  Drie weergaven zijn geregeld: ① inventaris-icoon (met optionele animatie tot
  4 frames), ② in de hand (andere spelers zien het ook), ③ op het lijf – de app
  genereert automatisch de wapenlagen én het uitrustings-asset. 26.3 krijgt de
  `equippable`-route via `humanoidArmor(...)`, 1.20.1 een echte `ArmorItem`.
- **🔊 Geluiden** – acht kant-en-klare geluiden (beluister ze met ▶), als .ogg
  + `sounds.json` + Java-event in je mod. Bruikbaar in verhaal-acties én mob-triggers.
- **✨ Partikels** – nieuwe verhaal-actie én mob-trigger-optie (vlam, rook,
  hartjes, sneeuw…) – rechtstreeks in de Java-code.
- **🏆 Quests** – advancements met soort (direct / item / mob verslaan), icoon,
  kader, XP- en commando-beloning. Minecraft toont ze als prestatie met toast.
- **↩️ Ongedaan / ↪️ Opnieuw** – in elke textuur-editor (ook toetsenbord-vriendelijk
  gedrag blijft).
- **📂 Importeer mod** – knop in de topbalk: laad een eerder geëxporteerde ZIP
  (met `project.json`) en je hele project inclusief texturen komt terug.
- **🧊 Mob-3D-preview** – draaiende kop + loop-ende poten in de mob-kaart
  (voorvertoning; in-game-animaties komen via `ai-code/animaties/`).
- **Blok-3D-weergave verbeterd** – groter, lichter en contrastrijker.

## 🧪 Nieuw: effecten, drankjes, 6 texturen & eigen code

- **🧪 Effecten & drankjes** (nieuw menu): eigen status-effecten (visueel, schade, genezing of 🌀 Glitch – met eigen glitch-logo) en drankjes in **alle flesjes** – 🧴 drinkfles, 💦 spetter (splash), ☁️ wolk (lingering) **én op een pijl**. Met kleur, meerdere effecten en **brouwen** in het brouwstandaard (basis + ingrediënt).
- **🧱 6 texturen per blok**: per kant (voor/achter/links/rechts/boven/onder) een eigen textuur, plus **📷 Foto importeren** in elke textuur-bewerker.
- **🧊 Multi-vorm 3D-editor**: meerdere vormen per blok én per item – met eigen kleur, positie en scheve hoek (zo bouw je een toren: basis → ➕ Vorm → Pos Y +16 → laatste vorm scheef).
- **🔊 Geluid bij interactie**: rechtsklik-op-blok, gebruik-van-item én rechtsklik-op-mob (ook zonder GUI).
- **🧩 Eigen code**: tekstvak bij mobs (draait elke tick) én bij enchants (bij elke hit) – jij vult het, of de AI. Beide kunnen tegelijk: app-code + ai-code blijft gescheiden.
- **🎬 Mob-preview**: kies loop / spring / draai-animatie in de 3D-preview.
- **Bugfixes**: ID-vakjes onthouden je cursor (typen van een id werkt weer) en de 3D-blok-kubus is weer zichtbaar (was een klein stipje door een eenheids-fout).

Bijwerken op Windows (in cmd):

```bat
cd %USERPROFILE%\blockymoding
git pull
```

## 📤 Alles naar GitHub (knop)

Knop **📤 Alles pushen naar GitHub** (tab 🤖 AI-code / GitHub) zet in **één
keer** alles wat je in de app maakt in je repo – netjes in `mods/<modid>/`:

- `project.json` – jouw volledige ontwerp (blokken, items, GUI's, werkbanken,
  mobs, verhaal) – **zonder** token erin
- alle gegenereerde code (Java, Gradle, JSON) – dezelfde bestanden als de ZIP-export
- alle getekende texturen (PNG)

Alles gaat als één nette commit op de gekozen branch.

**Eén keer instellen – een GitHub-token** (schrijven kan nooit zonder):

1. <https://github.com> → je avatar → **Settings**
2. Links **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)** → naam bv. `blockymod` → vink **repo** aan → **Generate**
4. Kopieer de token (`ghp_...`) → plak 'm in de app bij **Token**

De token blijft alleen op je eigen computer (lokale opslag) en gaat **niet**
mee in de push. Hetzelfde veld gebruik je voor privé-repos bij het ophalen.

## 🖼️ Logo & bureaublad

- Het app-logo (groene werkbank-cube) zit in de topbar, als favicon én als
  `app/icon.ico` voor Windows.
- `app\MaakBureaubladkoppeling.bat` maakt een bureaublad-snelkoppeling met dat icoon.

---

## 🤖 De AI-code workflow (GitHub-knop)

De app **herinnert je bij elke nieuwe mod** om een extra map in deze repo te
maken waar ik (de AI) code voor je in zet — **één map per mod, géén Git nodig**:

1. Open <https://github.com/Ven1x-cloud/blockymoding> → **Add file → Create new
   file** → typ als naam `mods/<jouw-modnaam>/README.md` (de mappen ontstaan
   vanzelf) → **Commit changes**. *(Of zeg het tegen de AI: "maak de map
   mods/... aan" – dan doe ik het voor je.)*
2. **Jij** vraagt mij in de chat om code, bijvoorbeeld:
   > "Zet in `mods/mijn-mod/` een klasse die de kassa-actie afhandelt"
3. **Ik** zet die bestanden in jouw map op GitHub.
4. **Jij** opent de app → tab **🤖 AI-code / GitHub** → eigenaar
   `Ven1x-cloud`, repo `blockymoding`, branch jouw tak, **Map met AI-codes**
   = `mods/<jouw-modnaam>` → **Codes ophalen bij GitHub** → de bestanden
   zitten direct in je volgende export.

Bij privé-repos: voeg een GitHub-PAT in (wordt alleen lokaal bewaard).
Liever tóch met git? `mkdir` / `git add` / `git commit` / `git push` werkt
ook – maar de browser-route hierboven is het makkelijkst.

---

## 📁 Structuur van deze repo

```
blockymoding/
├── README.md            ← dit bestand
├── Start.bat            ← Windows: dubbelklik → installeer + start
├── package.json         ← root-scripts: npm install / npm start werken hier
├── ai-code/             ← map voor codes die ik voor je schrijf
├── mods/                ← per-mod mappen met AI-code (één map per mod)
└── app/
    ├── Start.bat        ← Windows: installeer + start (Electron)
    ├── MaakBureaubladkoppeling.bat ← bureaublad-snelkoppeling met icoon
    ├── OpenInBrowser.bat← Windows: open in browser
    ├── icon.ico / icon.png / renderer/assets/logo.png ← het logo
    ├── package.json     ← electron-afhankelijkheden
    ├── main.js          ← Electron-hoofdproces (opslaan-dialoog)
    ├── preload.js
    ├── renderer/        ← de eigenlijke app (HTML/CSS/JS, werkt ook offline)
    │   ├── index.html
    │   ├── css/style.css
    │   └── js/
    │       ├── state.js       projectmodell + opslag
    │       ├── texture.js     16×16 textuur-editor + generatoren
    │       ├── guidesign.js   GUI-ontwerper (slepen, render, validatie)
    │       ├── recipes.js     receptpatronen + suggesties
    │       ├── exporters.js   genereert álle mod-bestanden (JSON/Java)
    │       ├── zip.js         minitare ZIP-schrijver (geen libraries)
    │       ├── github.js      GitHub contents-API client
    │       └── app.js         UI-schermen
    └── tools/
        ├── check.js       export-test (node tools/check.js)
        └── dom-check.js   UI-smoketest in jsdom
```

### Controles draaien (ontwikkelaars)

```bash
cd app
npm run check        # export + DOM-smoketest
```

---

## ⚙️ Hoe ziet de gegenereerde mod eruit?

```
mijn_mod/
├── build.gradle · settings.gradle · gradle.properties
├── README.md
├── ai-code/                     ← jouw + mijn code
├── src/main/java/…/ModMain.java
│   ├── ModBlocks · ModItems · ModEntities
│   ├── gui/*ScreenHandler · client/*Screen
│   ├── entity/*Entity
│   └── story/StoryManager · StoryEvents
└── src/main/resources/
    ├── fabric.mod.json
    ├── assets/<mod>/textures · models · blockstates · lang · layout
    └── data/<mod>/recipes · loot_tables · story
```

Open de map in IntelliJ IDEA, laat Gradle syncen en draai `runClient`.

> **Let op:** de Java-stubs raken een specifieke mappings-versie (Yarn 1.20.1).
> Kom je een kleine compilefout tegen? Vraag het mij – gooi de fout in de chat
> en zet de gefixte code in `ai-code/`, daarna haal je hem met één knop op.

---

## 📜 Licentie

MIT – bouw lekker verder. 🎮
