# 🤖 AI-code map

Deze map is bedoeld voor **code die ik (de AI) voor je schrijf**.

## Zo werkt het

1. Maak in **BlockyMod Studio** een mod en zorg dat deze `ai-code/` map in je
   GitHub-branch bestaat (de app herinnert je hier automatisch bij).
2. Vraag mij in de chat om code, bijvoorbeeld:
   > "Zet in `ai-code/` een klasse die bij het openen van de werkbank een speciaal effect geeft"
   of
   > "Schrijf het save-systeem voor het verhaal in `ai-code/`"
3. Ik zet de bestanden hier in deze map (op GitHub, in jouw branch).
4. Open **BlockyMod Studio** → tab **🤖 AI-code / GitHub** →
   **Codes ophalen bij GitHub**. De app haalt de bestanden op en voegt ze
   toe aan je mod-export.

## Regels

- Bestandspaden: **relatief** aan deze map, bv. `mijnfeature/MijnKlasse.java`
- Zet grote blokken code in aparte bestanden; dan kan de app ze netjes importeren.
- Nederlands of Engels commentaar mag — wat jij fijn vindt.

## Voorbeeld-structuur

```
ai-code/
├── README.md          ← dit bestand
├── extra/
│   └── Voorbeeld.java  ← code die ik voor je schrijf
└── ...
```
