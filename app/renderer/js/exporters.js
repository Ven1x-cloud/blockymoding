// ── Exporteur: genereert een complete Fabric-mod uit een project ──
"use strict";

const Exporters = (() => {
  // ── Hulpjes ──
  const MC_PROFILES = {
    "1.20.1": { yarn: "1.20.1+build.10", loader: "0.15.11", fabric: "0.92.2+1.20.1", loom: "1.6-SNAPSHOT", java: 17 },
    "1.21.1": { yarn: "1.21.1+build.3", loader: "0.16.9", fabric: "0.115.1+1.21.1", loom: "1.7-SNAPSHOT", java: 21 }
  };

  function profile(p) {
    return MC_PROFILES[p.meta.mcVersion] || MC_PROFILES["1.20.1"];
  }
  function is121(p) {
    const v = p.meta.mcVersion || "1.20.1";
    return parseInt(v.split(".")[1], 10) >= 21;
  }
  function lootDir(p) { return is121(p) ? "loot_table" : "loot_tables"; }
  function recipesDir(p) { return is121(p) ? "recipe" : "recipes"; }
  function idExpr(p, pathLit) {
    // pathLit = bv. `"mijn_blok"`
    return is121(p)
      ? `Identifier.of(ModMain.MOD_ID, ${pathLit})`
      : `new Identifier(ModMain.MOD_ID, ${pathLit})`;
  }
  function itemSettings(p) {
    return is121(p) ? "new Item.Settings()" : "new FabricItemSettings()";
  }
  function itemSettingsImport(p) {
    return is121(p)
      ? "import net.minecraft.item.Item;"
      : "import net.fabricmc.fabric.api.item.v1.FabricItemSettings;";
  }
  function materialLine(p, tool) {
    if (is121(p)) return "";
    const mat = { pickaxe: "STONE", axe: "WOOD", shovel: "GROUND", hoe: "PLANTS", none: "STONE" }[tool] || "STONE";
    return `\n            .material(Material.${mat})`;
  }
  function javaPackage(p) { return p.meta.package; }
  function pkgDir(p) { return javaPackage(p).split(".").join("/"); }
  function classname(id) { return toClassName(id); }
  function constname(id) { return toConst(id); }

  function json(obj) { return JSON.stringify(obj, null, 2) + "\n"; }

  /** Unieke const-namen binnen één registratieklasse */
  function uniqueConsts(ids) {
    const used = new Map();
    const out = new Map();
    for (const id of ids) {
      let base = constname(id);
      if (used.has(base)) {
        let n = 2;
        while (used.has(base + "_" + n)) n++;
        base = base + "_" + n;
      }
      used.set(base, true);
      out.set(id, base);
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════
  //  TEKSTBESTANDEN
  // ════════════════════════════════════════════════════════════════

  function buildTextFiles(p) {
    const files = {};
    const put = (path, content) => { files[path] = content; };

    // ── Project-bestanden ──
    put("README.md", modReadme(p));
    put(".gitignore", "build/\nrun/\n.gradle/\n.idea/\n*.iml\nout/\nbin/\n");
    put("settings.gradle", `rootProject.name = '${p.meta.modId}'\n`);
    put("build.gradle", buildGradle(p));
    put("gradle.properties", gradleProps(p));
    put("src/main/resources/fabric.mod.json", fabricModJson(p));
    put(`src/main/java/${pkgDir(p)}/ModMain.java`, modMain(p));
    put(`src/main/java/${pkgDir(p)}/ModBlocks.java`, modBlocks(p));
    put(`src/main/java/${pkgDir(p)}/ModItems.java`, modItems(p));
    put(`src/main/java/${pkgDir(p)}/ModEntities.java`, modEntities(p));

    // ── Blokken ──
    const ns = p.meta.modId;
    for (const b of p.blocks) {
      put(`src/main/resources/assets/${ns}/blockstates/${b.id}.json`, json({
        variants: { "": { model: `${ns}:block/${b.id}` } }
      }));
      put(`src/main/resources/assets/${ns}/models/block/${b.id}.json`, json({
        parent: "minecraft:block/cube_all",
        textures: { all: `${ns}:block/${b.id}` }
      }));
      put(`src/main/resources/assets/${ns}/models/item/${b.id}.json`, json({
        parent: `${ns}:block/${b.id}`
      }));
      put(`src/main/resources/data/${ns}/${lootDir(p)}/blocks/${b.id}.json`, json({
        type: "minecraft:block",
        pools: [{
          rolls: 1,
          entries: [{ type: "minecraft:item", name: `${ns}:${b.id}` }],
          conditions: [{ condition: "minecraft:survives_explosion" }]
        }]
      }));
    }

    // ── Items ──
    for (const it of p.items) {
      put(`src/main/resources/assets/${ns}/models/item/${it.id}.json`, json({
        parent: "minecraft:item/generated",
        textures: { layer0: `${ns}:item/${it.id}` }
      }));
    }

    // ── Recepten ──
    p.workstations.forEach((w) => {
      (w.recipes || []).forEach((r, i) => {
        const rid = `${w.id}_${String(i + 1).padStart(2, "0")}`;
        const body = recipeJson(p, r);
        if (body) put(`src/main/resources/data/${ns}/${recipesDir(p)}/${rid}.json`, json(body));
      });
    });

    // ── GUI-layouts ──
    for (const g of p.guis) {
      put(`src/main/resources/assets/${ns}/layout/${g.id}.json`, json({
        id: g.id, name: g.name, width: g.width, height: g.height, mode: g.mode,
        bgColor: g.bgColor,
        elements: g.elements.map(({ _id, ...rest }) => rest) // interne ids weglaten
      }));
    }

    // ── Verhaal ──
    if (p.story.chapters.length) {
      put(`src/main/resources/data/${ns}/story/storyline.json`, json(p.story));
      put(`src/main/java/${pkgDir(p)}/story/StoryManager.java`, storyManager(p));
      put(`src/main/java/${pkgDir(p)}/story/StoryEvents.java`, storyEvents(p));
    }

    // ── GUI-klassen ──
    for (const g of p.guis) {
      put(`src/main/java/${pkgDir(p)}/gui/${classname(g.id)}ScreenHandler.java`, screenHandler(p, g));
      put(`src/main/java/${pkgDir(p)}/client/${classname(g.id)}Screen.java`, screenClass(p, g));
    }
    if (p.guis.length) {
      put(`src/main/java/${pkgDir(p)}/gui/ModScreenHandlers.java`, modScreenHandlers(p));
      put(`src/main/java/${pkgDir(p)}/client/ModClient.java`, modClient(p));
    }

    // ── Mobs ──
    for (const m of p.mobs) {
      put(`src/main/java/${pkgDir(p)}/entity/${classname(m.id)}Entity.java`, entityClass(p, m));
    }

    // ── Taalbestanden ──
    const { en, nl } = langFiles(p);
    put(`src/main/resources/assets/${ns}/lang/en_us.json`, json(en));
    put(`src/main/resources/assets/${ns}/lang/nl_nl.json`, json(nl));

    // ── AI-code map ──
    put("ai-code/README.md", aiCodeReadme(p));
    for (const f of p.aiFiles || []) {
      const rel = String(f.path || "").replace(/^\/+/, "").replace(/^ai-code\//, "");
      if (rel) put("ai-code/" + rel, f.content || "");
    }

    return files;
  }

  // ── Mod-README ──
  function modReadme(p) {
    const n = p.meta.name;
    return `# ${n}

Gemaakt met **BlockyMod Studio** 🟩

- **Mod-id:** \`${p.meta.modId}\`
- **Minecraft:** ${p.meta.mcVersion} (Fabric)
- **Pakket:** \`${p.meta.package}\`
- **Auteur:** ${p.meta.author}

## Openen & draaien

1. Open deze map in **IntelliJ IDEA** (met de Gradle-plugin) of in VS Code.
2. Laat Gradle syncen (internet nodig – Fabric Loom wordt gedownload).
3. Draai de client met het Gradle-taak \`runClient\`.

> Geen Gradle geïnstalleerd? Installeer het of gebruik je IDE's Gradle-integratie.
> De wrapper-jar zit bewust niet in de ZIP; één keer \`gradle wrapper\` maken is voldoende.

## Wat zit er in?

| Map | Wat |
|-----|-----|
| \`src/main/java/${javaPackage(p)}/\` | Al je Java-code (registratie, GUI's, mobs, verhaal) |
| \`src/main/resources/assets/${p.meta.modId}/\` | Texturen, models, blockstates, taal, GUI-texturen |
| \`src/main/resources/data/${p.meta.modId}/\` | Recepten & verhaallijn (datapack-stijl) |
| \`ai-code/\` | **Jouw AI-code** – hier komen de codes die ik voor je schrijf |

## AI-code workflow 🤖

1. Ik (de AI) zet code in de \`ai-code/\`-map op **GitHub** (in jouw branch).
2. Open BlockyMod Studio → **🤖 AI-code / GitHub** → **Codes ophalen bij GitHub**.
3. Exporteer opnieuw – de codes zitten dan in je mod.

## Structuur die de app heeft aangemaakt

- ${p.blocks.length} blok(ken), ${p.items.length} item(s), ${p.guis.length} GUI('s),
  ${p.mobs.length} mob(s), ${p.workstations.length} werkbank(en),
  ${p.story.chapters.length} verhaalhoofdstuk(ken).

Veel bouwplezier! 🎮
`;
  }

  function aiCodeReadme(p) {
    return `# ai-code/ (mod: ${p.meta.name})

Map voor code die door de AI is geschreven.

- Haal de bestanden op via BlockyMod Studio → 🤖 AI-code / GitHub.
- De bestanden worden bij het exporteren aan de mod toegevoegd.
- Vraag de AI om nieuwe bestanden te plaatsen in deze map op GitHub.
`;
  }

  // ── Gradle ──
  function buildGradle(p) {
    const prof = profile(p);
    return `plugins {
    id 'fabric-loom' version '${prof.loom}'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
    archivesName = project.archives_base_name
}

repositories {
    // voeg hier extra maven-repos toe indien nodig
}

dependencies {
    minecraft "com.mojang:minecraft:\${project.minecraft_version}"
    mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"
}

processResources {
    inputs.property "version", project.version
    filesMatching("fabric.mod.json") {
        expand "version": inputs.properties.version
    }
}

tasks.withType(JavaCompile).configureEach {
    it.options.release = ${prof.java}
}

java {
    withSourcesJar()
    sourceCompatibility = JavaVersion.VERSION_${prof.java}
    targetCompatibility = JavaVersion.VERSION_${prof.java}
}

jar {
    from("LICENSE") {
        rename { "\${it}_\${project.base.archivesName.get()}" }
    }
}
`;
  }

  function gradleProps(p) {
    const prof = profile(p);
    return `org.gradle.jvmargs=-Xmx1G
minecraft_version=${p.meta.mcVersion}
yarn_mappings=${prof.yarn}
loader_version=${prof.loader}
fabric_version=${prof.fabric}

mod_version=${p.meta.version}
maven_group=${javaPackage(p)}
archives_base_name=${p.meta.modId}
`;
  }

  function fabricModJson(p) {
    const hasClient = p.guis.length > 0 || p.mobs.length > 0;
    const entry = {
      main: [`${javaPackage(p)}.ModMain`]
    };
    if (hasClient) entry.client = [`${javaPackage(p)}.client.ModClient`];
    return json({
      schemaVersion: 1,
      id: p.meta.modId,
      version: "${version}",
      name: p.meta.name,
      description: `${p.meta.name} – gemaakt met BlockyMod Studio.`,
      authors: [p.meta.author],
      license: "All-Rights-Reserved",
      environment: "*",
      entrypoints: entry,
      depends: {
        fabricloader: ">=0.14.21",
        minecraft: `~${p.meta.mcVersion}`,
        java: `>=${profile(p).java}`,
        "fabric-api": "*"
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  JAVA
  // ════════════════════════════════════════════════════════════════

  function modMain(p) {
    const story = p.story.chapters.length ? "        story.StoryEvents.register();\n" : "";
    return `package ${javaPackage(p)};

import net.fabricmc.api.ModInitializer;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hoofdklasse van ${p.meta.name} – gegenereerd door BlockyMod Studio.
 */
public class ModMain implements ModInitializer {
    public static final String MOD_ID = "${p.meta.modId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static Identifier id(String path) {
        return ${idExpr(p, "path")};
    }

    @Override
    public void onInitialize() {
        ModBlocks.register();
        ModItems.register();
        ModEntities.register();
${p.guis.length ? "        gui.ModScreenHandlers.register();\n" : ""}${story}
        LOGGER.info("[{}] geïnitialiseerd – veel bouwplezier!", MOD_ID);
    }
}
`;
  }

  function modBlocks(p) {
    const consts = uniqueConsts(p.blocks.map((b) => b.id));
    let fields = "";
    let regs = "";
    for (const b of p.blocks) {
      const c = consts.get(b.id);
      const resistance = (Math.round((b.hardness || 1) * 5 * 10) / 10).toFixed(1);
      const tool = b.requiresTool ? (b.tool || "pickaxe") : "none";
      const lines = [
        `    public static final Block ${c} = new Block(AbstractBlock.Settings.create()`,
        materialLine(p, tool),
        `            .strength(${(b.hardness ?? 1).toFixed(1)}F, ${resistance}F)`
      ];
      if (b.requiresTool) lines.push(`            .requiresTool()`);
      if (b.light > 0) lines.push(`            .lightLevel(state -> ${b.light})`);
      lines.push(`            .sounds(BlockSoundGroup.${soundGroup(b)}));`);
      fields += lines.join("\n") + "\n";
      regs += `        Registry.register(Registries.BLOCK, ModMain.id("${b.id}"), ${c});\n`;
    }
    const needsMaterial = !is121(p) && p.blocks.some((b) => b.requiresTool);
    return `package ${javaPackage(p)};

import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.block.BlockSoundGroup;
${needsMaterial ? "import net.minecraft.block.Material;\n" : ""}import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

/**
 * Alle blokken van deze mod.
 * ⛏ = blok-eigenschappen pas je hier aan (hardheid, licht, etc.)
 */
public final class ModBlocks {
    private ModBlocks() {}

${fields || "    // (nog geen blokken – maak er een in BlockyMod Studio!)"}
    public static void register() {
${regs || "        // niets te registreren"}
    }
}
`;
  }

  function soundGroup(b) {
    const t = b.tool || "pickaxe";
    if (b.sound) return b.sound;
    return { pickaxe: "STONE", axe: "WOOD", shovel: "STONE", hoe: "GRASS" }[t] || "STONE";
  }

  function modItems(p) {
    const allIds = [
      ...p.items.map((i) => i.id),
      ...p.blocks.map((b) => b.id),
      ...p.mobs.map((m) => m.id + "_spawn_egg")
    ];
    const consts = uniqueConsts(allIds);
    const byId = new Map(allIds.map((id, i) => [id, [...consts.values()][i]]));
    let fields = "";
    let regs = "";

    for (const b of p.blocks) {
      const c = byId.get(b.id);
      fields += `    public static final Item ${c} = new BlockItem(ModBlocks.${consts.get(b.id) || c}, ${itemSettings(p)});\n`;
      regs += `        Registry.register(Registries.ITEM, ModMain.id("${b.id}"), ${c});\n`;
    }
    for (const it of p.items) {
      const c = byId.get(it.id);
      const settings = itemSettings(p);
      const s = settings === "new Item.Settings()"
        ? `new Item.Settings().maxCount(${it.maxStack || 64})`
        : `new FabricItemSettings().maxCount(${it.maxStack || 64})`;
      fields += `    public static final Item ${c} = new Item(${s});\n`;
      regs += `        Registry.register(Registries.ITEM, ModMain.id("${it.id}"), ${c});\n`;
    }
    for (const m of p.mobs) {
      const c = byId.get(m.id + "_spawn_egg");
      fields += `    public static final Item ${c} = new SpawnEggItem(ModEntities.${constname(m.id)}, 0x${padHex(m.colors ? m.colors.primary : "ffffff")}, 0x${padHex(m.colors ? m.colors.secondary : "aaaaaa")}, ${itemSettings(p)});\n`;
      regs += `        Registry.register(Registries.ITEM, ModMain.id("${m.id}_spawn_egg"), ${c});\n`;
    }

    const imports = new Set(["import net.minecraft.item.BlockItem;",
      "import net.minecraft.item.Item;", "import net.minecraft.registry.Registries;",
      "import net.minecraft.registry.Registry;"]);
    if (p.mobs.length) imports.add("import net.minecraft.item.SpawnEggItem;");
    if (!is121(p)) imports.add("import net.fabricmc.fabric.api.item.v1.FabricItemSettings;");

    return `package ${javaPackage(p)};

${[...imports].join("\n")}

/**
 * Alle items van deze mod (incl. blok-items en spawn-eggs).
 */
public final class ModItems {
    private ModItems() {}

${fields || "    // (nog geen items)"}
    public static void register() {
${regs || "        // niets te registreren"}
    }
}
`;
  }

  function padHex(h) {
    let s = String(h || "ffffff").replace(/^#/, "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join(""); // #fc0 → ffcc00
    return s.padStart(6, "0").slice(0, 6);
  }

  function modEntities(p) {
    let fields = "";
    let regs = "";
    for (const m of p.mobs) {
      const c = constname(m.id);
      const group = m.kind === "hostile" ? "MONSTER" : "CREATURE";
      fields += `    public static final EntityType<${classname(m.id)}Entity> ${c} = Registry.register(
            Registries.ENTITY_TYPE,
            ModMain.id("${m.id}"),
            FabricEntityTypeBuilder.create(SpawnGroup.${group}, ${classname(m.id)}Entity::new)
                    .dimensions(EntityDimensions.fixed(${(m.width || 0.9).toFixed(2)}F, ${(m.height || 1.4).toFixed(2)}F))
                    .trackRangeBlocks(8)
                    .trackedUpdateRate(3)
                    .build());
`;
      regs += `        FabricDefaultAttributeRegistry.register(${c}, ${classname(m.id)}Entity.createAttributes());\n`;
    }
    if (!p.mobs.length) {
      fields = "    // (nog geen mobs – maak er een in BlockyMod Studio!)";
      regs = "        // niets te registreren";
    }
    return `package ${javaPackage(p)};

import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricEntityTypeBuilder;
import net.minecraft.entity.EntityDimensions;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
${p.mobs.map((m) => `import ${javaPackage(p)}.entity.${classname(m.id)}Entity;`).join("\n")}

/**
 * Alle mobs van deze mod.
 */
public final class ModEntities {
    private ModEntities() {}

${fields}

    public static void register() {
${regs}
    }
}
`;
  }

  function entityClass(p, m) {
    const cn = classname(m.id);
    const gui = m.guiId ? getGuiP(p, m.guiId) : null;
    const guiHandler = gui ? classname(gui.id) + "ScreenHandler" : null;
    const dropRefs = (m.drops || []).filter((d) => d.id).map((d) => ({ d, ref: itemRef(p, d.id) }));
    const needsModItems = dropRefs.some(({ ref }) => ref.startsWith("ModItems."));
    const dropsLines = dropRefs.map(({ d, ref }) =>
      `            if (RNG.nextFloat() <= ${(d.chance ?? 1).toFixed(2)}F) {
                this.dropStack(new ItemStack(${ref}, ${Math.max(1, d.count || 1)}));
            }`).join("\n");

    let interact = "";
    if (guiHandler) {
      interact = `
    /**
     * Rechtermuisklik op de mob → opent je GUI "${gui.name}".
     */
    @Override
    public boolean interactMob(PlayerEntity player, Hand hand) {
        if (!this.getWorld().isClient() && player instanceof ServerPlayerEntity serverPlayer) {
            serverPlayer.openHandledScreen(new SimpleNamedScreenHandlerFactory() {
                @Override
                public Text getDisplayName() {
                    return Text.literal("${escapeJava(gui.name)}");
                }

                @Override
                public ScreenHandler createMenu(int syncId, PlayerInventory inv, PlayerEntity p) {
                    return new ${guiHandler}(syncId, inv);
                }
            });
            return true;
        }
        return super.interactMob(player, hand);
    }
`;
    }

    return `package ${javaPackage(p)}.entity;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.passive.PigEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.SimpleNamedScreenHandlerFactory;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Hand;
import net.minecraft.world.World;
${guiHandler ? `import ${javaPackage(p)}.gui.${guiHandler};` : ""}
${needsModItems ? `import ${javaPackage(p)}.ModItems;` : ""}

import java.util.Random;

/**
 * ${m.name} – mod-mob gegenereerd door BlockyMod Studio.
 * ${gui ? "Op rechtermuisklik opent: " + gui.name : "Standaard-gedrag (vraag de AI voor meer acties)."}
 */
public class ${cn}Entity extends PigEntity {
    private static final Random RNG = new Random();

    public ${cn}Entity(EntityType<? extends PigEntity> entityType, World world) {
        super(entityType, world);
    }

    /** Basis-attributen (leven, snelheid, aanval). */
    public static DefaultAttributeContainer.Builder createAttributes() {
        return PigEntity.createAttributes()
                .add(EntityAttributes.GENERIC_MAX_HEALTH, ${(m.health || 20).toFixed(1)}F)
                .add(EntityAttributes.GENERIC_MOVEMENT_SPEED, ${(m.speed || 0.25).toFixed(3)}F)
                .add(EntityAttributes.GENERIC_ATTACK_DAMAGE, ${(m.damage || 3).toFixed(1)}F);
    }
${interact}
    /** Drops bij dood. */
    @Override
    protected void dropLoot(net.minecraft.entity.damage.DamageSource damageSource, boolean causedByPlayer) {
        super.dropLoot(damageSource, causedByPlayer);
        if (this.getWorld().isClient()) return;
${dropsLines ? dropsLines : "        // TODO: drops instellen in BlockyMod Studio (tab Mobs) of in ai-code/"}
    }
}
`;
  }

  function getGuiP(p, guiId) {
    return p.guis.find((g) => g.id === guiId) || null;
  }

  function itemRef(p, raw) {
    const id = State.resolveItemId(p, raw);
    if (id.startsWith("minecraft:")) {
      const item = id.split(":")[1];
      // Items.X bestaat alleen voor bekende vanilla-items; anders Identifier-weg
      return `Items.${toConstVanilla(item)}`;
    }
    const local = id.split(":")[1];
    const item = p.items.find((i) => i.id === local);
    if (item) return `ModItems.${toConst(local)}`;
    const blk = p.blocks.find((b) => b.id === local);
    if (blk) return `ModItems.${toConst(local)}`; // block-items heten hetzelfde
    return `Items.${toConstVanilla(local)}`;
  }

  function toConstVanilla(vanillaId) {
    return vanillaId.toUpperCase();
  }

  // ── GUI-klassen ──
  function modScreenHandlers(p) {
    const fields = p.guis.map((g) =>
      `    public static final ScreenHandlerType<${classname(g.id)}ScreenHandler> ${constname(g.id)} =
            ScreenHandlerRegistry.registerSimple(ModMain.id("${g.id}"), ${classname(g.id)}ScreenHandler::new);`
    ).join("\n");
    return `package ${javaPackage(p)}.gui;

import net.fabricmc.fabric.api.screenhandler.v1.ScreenHandlerRegistry;
import net.minecraft.screen.ScreenHandlerType;
import ${javaPackage(p)}.ModMain;

/**
 * Registreert alle GUI's (screen handlers) van deze mod.
 */
public final class ModScreenHandlers {
    private ModScreenHandlers() {}

${fields}

    public static void register() {
        // wordt via de statische velden hierboven geregistreerd
        ModMain.LOGGER.debug("Screen handlers geladen: ${p.guis.map((g) => g.id).join(", ")}");
    }
}
`;
  }

  function screenHandler(p, g) {
    const cn = classname(g.id);
    const inputs = g.elements.filter((e) => e.type === "slot" && e.role === "input").sort((a, b) => a.index - b.index);
    const outputs = g.elements.filter((e) => e.type === "slot" && e.role === "output");
    const players = g.elements.filter((e) => e.type === "slot" && e.role === "player");

    if (g.mode === "crafting") {
      // Slots herpositioneren op basis van de VANILLA-positie (volgorde-onafhankelijk):
      // {vanillaX, vanillaY, ontwerpX, ontwerpY}
      const posRows = [];
      for (const o of outputs) posRows.push(`            {124, 35, ${o.x}, ${o.y}}, // uitvoer`);
      inputs.forEach((s) => {
        const col = s.index % 3, row = Math.floor(s.index / 3);
        posRows.push(`            {${30 + col * 18}, ${17 + row * 18}, ${s.x}, ${s.y}}, // invoer ${s.index}`);
      });
      for (const s of players) {
        const isHotbar = s.index < 9;
        const vx = 8 + (s.index % 9) * 18;
        const vy = isHotbar ? 142 : 84 + Math.floor((s.index - 9) / 9) * 18;
        posRows.push(`            {${vx}, ${vy}, ${s.x}, ${s.y}}, // speler inv ${s.index}`);
      }
      const posTable = posRows.length ? `
    /** Slotposities: {vanillaX, vanillaY, ontwerpX, ontwerpY} */
    private static final int[][] SLOT_POS = {
${posRows.join("\n")}
    };
` : "";

      return `package ${javaPackage(p)}.gui;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.screen.CraftingScreenHandler;
import net.minecraft.screen.slot.Slot;
import net.minecraft.world.World;
import net.minecraft.util.math.BlockPos;

/**
 * Werkbank-GUI "${g.name}" (modus: crafting → werkt met alle recepten uit de tab Werkbanken).
 * Slots worden na super() naar jouw ontwerp-positie verplaatst.
 */
public class ${cn}ScreenHandler extends CraftingScreenHandler {${posTable}
    public ${cn}ScreenHandler(int syncId, PlayerInventory playerInventory) {
        this(syncId, playerInventory, playerInventory.player.getWorld(), BlockPos.ORIGIN);
    }

    public ${cn}ScreenHandler(int syncId, PlayerInventory playerInventory, World world, BlockPos pos) {
        super(syncId, playerInventory, world, pos);
${posRows.length ? `        // 🔧 Verplaats slots naar jouw ontwerp (match op de originele vanilla-positie)
        int[][] origineel = new int[this.slots.size()][2];
        for (int i = 0; i < this.slots.size(); i++) {
            Slot s = this.slots.get(i);
            origineel[i][0] = s.x;
            origineel[i][1] = s.y;
        }
        for (int[] q : SLOT_POS) {
            for (int i = 0; i < this.slots.size(); i++) {
                if (origineel[i][0] == q[0] && origineel[i][1] == q[1]) {
                    Slot slot = this.slots.get(i);
                    slot.x = q[2];
                    slot.y = q[3];
                    break;
                }
            }
        }` : "        // geen aanpassingen"}
    }

    /** Werkt altijd – ook als een mob de GUI opent. */
    @Override
    public boolean canUse(PlayerEntity player) {
        return true;
    }
}
`;
    }

    // ── Vrije modus ──
    const content = [...inputs, ...outputs].sort((a, b) => (a._id > b._id ? 1 : -1));
    const contentSize = content.length;
    let addLines = "";
    content.forEach((s, i) => {
      addLines += `        // content-slot ${i} (${s.role})\n`;
      addLines += `        this.addSlot(new Slot(content, ${i}, ${s.x}, ${s.y}));\n`;
    });
    players.sort((a, b) => a.index - b.index).forEach((s) => {
      addLines += `        this.addSlot(new Slot(playerInventory, ${s.index}, ${s.x}, ${s.y})); // speler ${s.index}\n`;
    });

    return `package ${javaPackage(p)}.gui;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.Slot;

/**
 * Vrij GUI "${g.name}" (modus: free).
 * Slots staan op jouw ontwerp-positie. De inhoud is een gewone inventaris –
 * koppel hier in ai-code/ jouw eigen logica (bijv. kopen, verkopen, smeden).
 */
public class ${cn}ScreenHandler extends ScreenHandler {
    private final SimpleInventory content = new SimpleInventory(${Math.max(1, contentSize)});

    public ${cn}ScreenHandler(int syncId, PlayerInventory playerInventory) {
        super(ModScreenHandlers.${constname(g.id)}, syncId);

${addLines || "        // geen slots – voeg ze toe in de GUI-ontwerper"}
    }

    /** Snel-verplaatsen (shift-klik) tussen speler en GUI. */
    @Override
    public ItemStack quickMoveStack(PlayerEntity player, int index) {
        ItemStack newStack = ItemStack.EMPTY;
        Slot slot = this.slots.get(index);
        if (slot != null && slot.hasStack()) {
            ItemStack current = slot.getStack();
            newStack = current.copy();
            if (index < ${contentSize}) {
                if (!this.insertItem(current, ${contentSize}, this.slots.size(), true)) {
                    return ItemStack.EMPTY;
                }
            } else if (!this.insertItem(current, 0, ${contentSize}, false)) {
                return ItemStack.EMPTY;
            }
            if (current.isEmpty()) {
                slot.setStack(ItemStack.EMPTY);
            } else {
                slot.markDirty();
            }
            if (current.getCount() == newStack.getCount()) {
                return ItemStack.EMPTY;
            }
            slot.onTakeItem(player, current);
        }
        return newStack;
    }

    @Override
    public boolean canUse(PlayerEntity player) {
        return true;
    }

    /** Inhoud van de GUI-slots (voor jouw eigen logica). */
    public SimpleInventory getContent() {
        return content;
    }
}
`;
  }

  function screenClass(p, g) {
    const cn = classname(g.id);
    const labels = g.elements.filter((e) => e.type === "label");
    const buttons = g.elements.filter((e) => e.type === "button");
    const labelLines = labels.map((l) =>
      `        context.drawText(this.textRenderer, "${escapeJava(l.text)}", this.x + ${l.x}, this.y + ${l.y}, 0x${javaColor(l.color)}, false);`
    ).join("\n");
    const buttonLines = buttons.map((b) =>
      `        this.addDrawableChild(ButtonWidget.builder(Text.literal("${escapeJava(b.text)}"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).dimensions(this.x + ${b.x}, this.y + ${b.y}, ${b.w || 100}, ${b.h || 20}).build());`
    ).join("\n");

    return `package ${javaPackage(p)}.client;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.screen.slot.Slot;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import ${javaPackage(p)}.ModMain;
import ${javaPackage(p)}.gui.${cn}ScreenHandler;

/**
 * Scherm voor "${g.name}" – tekent je zelf-ontworpen GUI-textuur.
 */
@Environment(EnvType.CLIENT)
public class ${cn}Screen extends HandledScreen<${cn}ScreenHandler> {
    private static final Identifier TEXTURE = ModMain.id("textures/gui/${g.id}.png");

    public ${cn}Screen(${cn}ScreenHandler handler, PlayerInventory inventory, Text title) {
        super(handler, inventory, title);
        this.backgroundWidth = ${g.width};
        this.backgroundHeight = ${g.height};
        this.titleX = 4000; // eigen titel-tekst, zie drawBackground
    }

    @Override
    protected void init() {
        super.init();
${buttonLines ? buttonLines + "\n" : "        // geen knoppen in dit GUI-ontwerp"}
    }

    @Override
    protected void drawBackground(DrawContext context, float delta, int mouseX, int mouseY) {
        context.drawTexture(TEXTURE, this.x, this.y, 0, 0, this.backgroundWidth, this.backgroundHeight);
${labelLines ? labelLines : ""}
    }

    @Override
    protected void drawSlot(DrawContext context, Slot slot) {
        // De slot-achtergrond zit al in je eigen textuur – teken alleen het item.
        context.drawItem(slot.getStack(), slot.x, slot.y);
        context.drawItemInSlot(this.textRenderer, slot.getStack(), slot.x, slot.y);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        super.render(context, mouseX, mouseY, delta);
        this.drawMouseoverTooltip(context, mouseX, mouseY);
    }
}
`;
  }

  function modClient(p) {
    const screenRegs = p.guis.map((g) =>
      `        HandledScreens.register(ModScreenHandlers.${constname(g.id)}, ${classname(g.id)}Screen::new);`
    ).join("\n");
    const renderRegs = p.mobs.map((m) =>
      `        // TODO: eigen model/texture? Vraag de AI! (nu: varken-look als voorbeeld)
        EntityRendererRegistry.register(ModEntities.${constname(m.id)}, PigEntityRenderer::new);`
    ).join("\n");
    const imports = new Set([
      "import net.fabricmc.api.ClientModInitializer;",
      `import ${javaPackage(p)}.ModMain;`
    ]);
    if (p.guis.length) {
      imports.add("import net.minecraft.client.gui.screen.ingame.HandledScreens;");
      imports.add(`import ${javaPackage(p)}.gui.ModScreenHandlers;`);
      p.guis.forEach((g) => imports.add(`import ${javaPackage(p)}.client.${classname(g.id)}Screen;`));
    }
    if (p.mobs.length) {
      imports.add("import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;");
      imports.add("import net.minecraft.client.render.entity.PigEntityRenderer;");
      imports.add(`import ${javaPackage(p)}.ModEntities;`);
    }

    return `package ${javaPackage(p)}.client;

${[...imports].join("\n")}

/**
 * Client-registratie: schermen (GUI's) en mob-renderers.
 */
public class ModClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
${screenRegs || "        // geen GUI's om te registreren"}
${renderRegs || "        // geen mobs om te registreren"}
        ModMain.LOGGER.debug("Client geladen.");
    }
}
`;
  }

  function escapeJava(s) {
    return String(s ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "");
  }

  function javaColor(hex) {
    const h = padHex(hex);
    // #rrggbb → 0xRRGGBB (java-lexicaal zelfde bitpatroon als rgb)
    return h;
  }

  // ════════════════════════════════════════════════════════════════
  //  RECEPTEN → JSON
  // ════════════════════════════════════════════════════════════════

  function recipeJson(p, r) {
    const ns = p.meta.modId;
    const out = {
      item: r.output && r.output.includes(":") ? r.output : State.resolveItemId(p, r.output),
      count: r.count || 1
    };
    if (!out.item) return null;
    const result121 = is121(p);
    const resultField = result121 ? { id: out.item, count: out.count } : out;

    if (r.type === "shaped") {
      const { pattern, key } = RecipesKit.buildPattern(r.cells || []);
      if (!pattern.length) return null;
      const keyJson = {};
      for (const [letter, ing] of Object.entries(key)) keyJson[letter] = RecipesKit.ingredientJson(ing);
      return {
        type: "minecraft:crafting_shaped",
        category: out.item.endsWith("_block") || p.blocks.some((b) => ns + ":" + b.id === out.item) ? "building" : "misc",
        pattern,
        key: keyJson,
        result: resultField
      };
    }
    if (r.type === "shapeless") {
      const ings = RecipesKit.usedCells(r).map(RecipesKit.ingredientJson);
      if (!ings.length) return null;
      return {
        type: "minecraft:crafting_shapeless",
        category: "misc",
        ingredients: ings,
        result: resultField
      };
    }
    if (r.type === "smelting" || r.type === "smoking") {
      const ing = (r.cells || [])[0];
      if (!ing) return null;
      return {
        type: r.type === "smoking" ? "minecraft:smoking" : "minecraft:smelting",
        ingredient: RecipesKit.ingredientJson(ing),
        result: is121(p) ? out.item : out.item,
        experience: r.xp ?? 0.1,
        cookingtime: r.type === "smoking" ? 100 : 200
      };
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════
  //  TAALBESTANDEN
  // ════════════════════════════════════════════════════════════════

  function langFiles(p) {
    const ns = p.meta.modId;
    const en = {}, nl = {};
    for (const b of p.blocks) {
      en[`block.${ns}.${b.id}`] = b.name || b.id;
      nl[`block.${ns}.${b.id}`] = b.name || b.id;
    }
    for (const it of p.items) {
      en[`item.${ns}.${it.id}`] = it.name || it.id;
      nl[`item.${ns}.${it.id}`] = it.name || it.id;
    }
    for (const m of p.mobs) {
      en[`entity.${ns}.${m.id}`] = m.name || m.id;
      nl[`entity.${ns}.${m.id}`] = m.name || m.id;
      en[`item.${ns}.${m.id}_spawn_egg`] = `Spawn-egg ${m.name || m.id}`;
      nl[`item.${ns}.${m.id}_spawn_egg`] = `Ei om ${m.name || m.id} te roepen`;
    }
    for (const g of p.guis) {
      en[`gui.${ns}.${g.id}`] = g.name || g.id;
      nl[`gui.${ns}.${g.id}`] = g.name || g.id;
    }
    return { en, nl };
  }

  // ════════════════════════════════════════════════════════════════
  //  VERHAAL → JAVA
  // ════════════════════════════════════════════════════════════════

  function storyManager(p) {
    const ns = p.meta.modId;
    const guiImports = new Set();
    // open_gui-acties → handler-klassen
    for (const ch of p.story.chapters)
      for (const ev of ch.events || [])
        for (const a of ev.actions || [])
          if (a.type === "gui" && a.gui) {
            const g = getGuiP(p, a.gui);
            if (g) guiImports.add(g);
          }

    return `package ${javaPackage(p)}.story;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.SimpleNamedScreenHandlerFactory;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.world.World;
import ${javaPackage(p)}.ModMain;
${[...guiImports].map((g) => `import ${javaPackage(p)}.gui.${classname(g.id)}ScreenHandler;`).join("\n")}

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Leest data/${ns}/story/storyline.json en voert acties uit.
 *
 * ⚠️ TODO (vraag de AI of bouw zelf in ai-code/):
 *   - voortgang opslaan zodat hij een herstart overleeft
 *   - meer trigger-types / voorwaarden
 */
public final class StoryManager {
    public static final StoryManager INSTANCE = new StoryManager();

    public static class Event {
        public String id;
        public JsonObject trigger;
        public List<JsonObject> actions = new ArrayList<>();
    }

    public static class Chapter {
        public String id;
        public String title;
        public List<Event> events = new ArrayList<>();
    }

    public static class Progress {
        public int chapterIndex = 0;
        public final Set<String> done = new HashSet<>();
    }

    private final Map<UUID, Progress> progress = new HashMap<>();
    private List<Chapter> chapters = List.of();
    private boolean loaded = false;

    private StoryManager() {}

    /** (Her)laad de verhaallijn van de server. */
    public synchronized void load(net.minecraft.server.MinecraftServer server) {
        try {
            Identifier id = ModMain.id("story/storyline.json");
            var resource = server.getResourceManager().getResource(id);
            try (InputStream in = resource.get().getInputStream()) {
                JsonObject root = new Gson().fromJson(
                        new InputStreamReader(in, StandardCharsets.UTF_8), JsonObject.class);
                chapters = parse(root);
                loaded = true;
                ModMain.LOGGER.info("[Story] {} hoofdstukken geladen.", chapters.size());
            }
        } catch (Exception e) {
            ModMain.LOGGER.warn("[Story] storyline.json kon niet geladen worden: {}", e.getMessage());
            chapters = List.of();
            loaded = true;
        }
    }

    private List<Chapter> parse(JsonObject root) {
        List<Chapter> out = new ArrayList<>();
        JsonArray arr = root.has("chapters") ? root.getAsJsonArray("chapters") : new JsonArray();
        for (JsonElement el : arr) {
            JsonObject c = el.getAsJsonObject();
            Chapter ch = new Chapter();
            ch.id = getStr(c, "id", "hoofdstuk");
            ch.title = getStr(c, "title", ch.id);
            if (c.has("events")) {
                for (JsonElement ee : c.getAsJsonArray("events")) {
                    JsonObject eo = ee.getAsJsonObject();
                    Event ev = new Event();
                    ev.id = getStr(eo, "id", ch.id + "_" + ev.hashCode());
                    ev.trigger = eo.has("trigger") ? eo.getAsJsonObject("trigger") : new JsonObject();
                    if (eo.has("actions"))
                        for (JsonElement ae : eo.getAsJsonArray("actions"))
                            ev.actions.add(ae.getAsJsonObject());
                    ch.events.add(ev);
                }
            }
            out.add(ch);
        }
        return out;
    }

    private static String getStr(JsonObject o, String k, String def) {
        return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : def;
    }

    public Progress getProgress(UUID uuid) {
        return progress.computeIfAbsent(uuid, u -> new Progress());
    }

    // ── Triggers ──

    public void onJoin(ServerPlayerEntity player) {
        ensureLoaded(player);
        Progress pr = getProgress(player.getUuid());
        if (pr.chapterIndex == 0 && pr.done.isEmpty()) {
            runTrigger(player, "join");
        }
    }

    public void onKill(ServerPlayerEntity killer, net.minecraft.entity.Entity killed) {
        ensureLoaded(killer);
        String typeId = Registries.ENTITY_TYPE.getId(killed.getType()).toString();
        runTrigger(killer, "kill", "entity", typeId);
    }

    public void onInteractBlock(ServerPlayerEntity player, net.minecraft.util.hit.BlockHitResult hit) {
        ensureLoaded(player);
        Identifier blockId = Registries.BLOCK.getId(
                player.getWorld().getBlockState(hit.getBlockPos()).getBlock());
        runTrigger(player, "block", "block", blockId.toString());
    }

    public void onInteractItem(ServerPlayerEntity player, ItemStack stack) {
        ensureLoaded(player);
        Identifier itemId = Registries.ITEM.getId(stack.getItem());
        runTrigger(player, "item", "item", itemId.toString());
    }

    public void onWorldTick(ServerWorld world) {
        if (!loaded) load(world.getServer());
        if (world.getTime() % 20 != 0) return;
        for (ServerPlayerEntity player : world.getPlayers()) {
            Progress pr = getProgress(player.getUuid());
            Chapter ch = currentChapter(pr);
            if (ch == null) continue;
            for (Event ev : ch.events) {
                if (matchLocation(player, ev.trigger)) {
                    runEvent(player, ev);
                }
            }
        }
    }

    private void ensureLoaded(ServerPlayerEntity player) {
        if (!loaded) load(player.getServer());
    }

    private Chapter currentChapter(Progress pr) {
        if (pr.chapterIndex < 0 || pr.chapterIndex >= chapters.size()) return null;
        return chapters.get(pr.chapterIndex);
    }

    private boolean matchLocation(PlayerEntity player, JsonObject trigger) {
        if (trigger == null || !"location".equals(getStr(trigger, "type", ""))) return false;
        double x = trigger.has("x") ? trigger.get("x").getAsDouble() : 0;
        double y = trigger.has("y") ? trigger.get("y").getAsDouble() : 0;
        double z = trigger.has("z") ? trigger.get("z").getAsDouble() : 0;
        double r = trigger.has("r") ? trigger.get("r").getAsDouble() : 4;
        double dx = player.getX() - x, dy = player.getY() - y, dz = player.getZ() - z;
        return dx * dx + dy * dy + dz * dz <= r * r;
    }

    /** Zoek passende events in het huidige hoofdstuk en voer ze uit. */
    public void runTrigger(ServerPlayerEntity player, String type, String field, String value) {
        Progress pr = getProgress(player.getUuid());
        Chapter ch = currentChapter(pr);
        if (ch == null) return;
        for (Event ev : ch.events) {
            if (pr.done.contains(ev.id)) continue;
            String t = getStr(ev.trigger, "type", "");
            if (!type.equals(t)) continue;
            if (field != null && !value.equals(getStr(ev.trigger, field, ""))) continue;
            runEvent(player, ev);
        }
    }

    public void runTrigger(ServerPlayerEntity player, String type) {
        runTrigger(player, type, null, null);
    }

    /** Voer alle acties van een event uit. */
    public void runEvent(ServerPlayerEntity player, Event ev) {
        Progress pr = getProgress(player.getUuid());
        if (pr.done.contains(ev.id)) return;
        pr.done.add(ev.id);
        for (JsonObject action : ev.actions) {
            execute(player, action);
        }
    }

    private void execute(ServerPlayerEntity player, JsonObject a) {
        String type = getStr(a, "type", "");
        World world = player.getWorld();
        switch (type) {
            case "message" -> player.sendMessage(Text.literal(getStr(a, "text", "")), false);
            case "give" -> {
                String itemId = getStr(a, "item", "minecraft:stone");
                int count = a.has("count") ? a.get("count").getAsInt() : 1;
                var item = Registries.ITEM.get(Identifier.tryParse(itemId));
                if (item != null && item != net.minecraft.item.Items.AIR) {
                    player.getInventory().insertStack(new ItemStack(item, count));
                    player.sendMessage(Text.literal("+ " + count + " × " + itemId), true);
                }
            }
            case "weather" -> {
                String w = getStr(a, "state", "clear");
                runCommand(player, w.equals("thunder") ? "weather thunder"
                        : w.equals("rain") ? "weather rain" : "weather clear");
            }
            case "time" -> {
                runCommand(player, "time set " + ("night".equals(getStr(a, "state", "day")) ? "night" : "day"));
            }
            case "spawn" -> {
                String entityId = getStr(a, "entity", "minecraft:pig");
                int count = a.has("count") ? a.get("count").getAsInt() : 1;
                var type = Registries.ENTITY_TYPE.get(Identifier.tryParse(entityId));
                var rng = java.util.concurrent.ThreadLocalRandom.current();
                for (int i = 0; i < count; i++) {
                    var entity = type.create(world);
                    if (entity != null) {
                        entity.refreshPositionAndAngles(
                                player.getX() + (rng.nextDouble() - 0.5) * 3,
                                player.getY(),
                                player.getZ() + (rng.nextDouble() - 0.5) * 3,
                                rng.nextFloat() * 360f, 0f);
                        world.spawnEntity(entity);
                    }
                }
            }
            case "command" -> {
                if (player.getServer() != null) {
                    player.getServer().getCommandManager()
                            .executeWithPrefix(player.getCommandSource(), getStr(a, "cmd", "say hallo"));
                }
            }
            case "gui" -> openGui(player, getStr(a, "gui", ""));
            case "next" -> {
                Progress pr = getProgress(player.getUuid());
                pr.chapterIndex++;
                Chapter ch = currentChapter(pr);
                player.sendMessage(Text.literal("§6" + (ch != null ? ch.title : "Einde van het verhaal!")), false);
            }
            default -> ModMain.LOGGER.warn("[Story] onbekende actie: {}", type);
        }
    }

    /** Voer een console-commando uit (als operator-rechten beschikbaar zijn). */
    private void runCommand(ServerPlayerEntity player, String cmd) {
        if (player.getServer() != null) {
            player.getServer().getCommandManager()
                    .executeWithPrefix(player.getCommandSource().withLevel(2), cmd);
        }
    }

    private void openGui(ServerPlayerEntity player, String guiId) {
        switch (guiId) {
${p.guis.filter((g) => guiImports.has(g)).map((g) =>
        `            case "${g.id}" -> player.openHandledScreen(new SimpleNamedScreenHandlerFactory() {
                @Override
                public Text getDisplayName() { return Text.literal("${escapeJava(g.name)}"); }

                @Override
                public net.minecraft.screen.ScreenHandler createMenu(int syncId, PlayerInventory inv, PlayerEntity p) {
                    return new ${classname(g.id)}ScreenHandler(syncId, inv);
                }
            });`).join("\n") || "            // geen GUI's gekoppeld"}
            default -> ModMain.LOGGER.warn("[Story] onbekend gui: {}", guiId);
        }
    }
}
`;
  }

  function storyEvents(p) {
    return `package ${javaPackage(p)}.story;

import net.fabricmc.fabric.api.entity.event.v1.ServerEntityCombatEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.TypedActionResult;

/**
 * Koppelt game-gebeurtenissen aan jouw verhaallijn.
 * Triggers die de app ondersteunt: join, kill, block, item, location.
 */
public final class StoryEvents {
    private StoryEvents() {}

    public static void register() {
        // Speler logt in
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) ->
                StoryManager.INSTANCE.onJoin(handler.player));

        // Iets doodmaken
        ServerEntityCombatEvents.AFTER_KILL_OTHER_ENTITY.register((world, entity, killed) -> {
            if (entity instanceof net.minecraft.server.network.ServerPlayerEntity player) {
                StoryManager.INSTANCE.onKill(player, killed);
            }
        });

        // Blok rechtsklikken
        UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
            if (!world.isClient() && player instanceof net.minecraft.server.network.ServerPlayerEntity sp) {
                StoryManager.INSTANCE.onInteractBlock(sp, hitResult);
            }
            return ActionResult.PASS;
        });

        // Item rechtsklikken
        UseItemCallback.EVENT.register((player, world, hand) -> {
            if (!world.isClient() && player instanceof net.minecraft.server.network.ServerPlayerEntity sp) {
                StoryManager.INSTANCE.onInteractItem(sp, player.getStackInHand(hand));
            }
            return TypedActionResult.pass(player.getStackInHand(hand));
        });

        // Locatie-triggers (elke seconde)
        ServerTickEvents.END_WORLD_TICK.register(world ->
                StoryManager.INSTANCE.onWorldTick(world));
    }
}
`;
  }

  // ════════════════════════════════════════════════════════════════
  //  TEXTUREN (PNG-bytes) – browsercanvas nodig
  // ════════════════════════════════════════════════════════════════

  /** Lijst met alle textuurbestanden die gerenderd moeten worden */
  function collectTextures(p) {
    const ns = p.meta.modId;
    const jobs = [];
    for (const b of p.blocks) {
      jobs.push({
        path: `src/main/resources/assets/${ns}/textures/block/${b.id}.png`,
        render: async () => {
          let px = b.pixels;
          if (!px || !px.some(Boolean)) {
            px = TextureKit.generate(b.genStyle || "ruis", b.genColor || "#8a8a8a", hashStr(b.id));
          }
          return TextureKit.canvasToPngBytes(TextureKit.pixelsToCanvas(px, 16));
        }
      });
    }
    for (const it of p.items) {
      jobs.push({
        path: `src/main/resources/assets/${ns}/textures/item/${it.id}.png`,
        render: async () => {
          let px = it.pixels;
          if (!px || !px.some(Boolean)) {
            px = TextureKit.generate(it.genStyle || "ruis", it.genColor || "#b87333", hashStr(it.id));
          }
          return TextureKit.canvasToPngBytes(TextureKit.pixelsToCanvas(px, 16));
        }
      });
    }
    for (const g of p.guis) {
      jobs.push({
        path: `src/main/resources/assets/${ns}/textures/gui/${g.id}.png`,
        render: async () => TextureKit.canvasToPngBytes(GuiDesign.renderToCanvas(g))
      });
    }
    return jobs;
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 99991 || 7;
  }

  /** Volledig exportplan: tekstbestanden + textuurjobs */
  function exportPlan(p) {
    const textFiles = buildTextFiles(p);
    const textures = collectTextures(p);
    return { textFiles, textures };
  }

  return { buildTextFiles, collectTextures, exportPlan, MC_PROFILES };
})();

if (typeof module !== "undefined") module.exports = { Exporters };
