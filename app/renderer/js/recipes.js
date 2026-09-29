// ── Recepten: model, validatie en standaard-items ──
"use strict";

const RecipesKit = (() => {
  /** Veelgebruikte vanilla-items voor snel-kiezen */
  const VANILLA_ITEMS = [
    "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:birch_planks",
    "minecraft:jungle_planks", "minecraft:acacia_planks", "minecraft:dark_oak_planks",
    "minecraft:mangrove_planks", "minecraft:cherry_planks", "minecraft:crimson_planks",
    "minecraft:warped_planks", "minecraft:bamboo_planks",
    "minecraft:stick", "minecraft:string", "minecraft:leather", "minecraft:feather",
    "minecraft:coal", "minecraft:charcoal", "minecraft:iron_ingot", "minecraft:gold_ingot",
    "minecraft:copper_ingot", "minecraft:diamond", "minecraft:emerald", "minecraft:redstone",
    "minecraft:lapis_lazuli", "minecraft:quartz", "minecraft:amethyst_shard",
    "minecraft:iron_nugget", "minecraft:gold_nugget",
    "minecraft:cobblestone", "minecraft:stone", "minecraft:stone_bricks",
    "minecraft:mossy_cobblestone", "minecraft:smooth_stone", "minecraft:sandstone",
    "minecraft:obsidian", "minecraft:nether_brick", "minecraft:end_stone",
    "minecraft:dirt", "minecraft:sand", "minecraft:gravel", "minecraft:clay_ball",
    "minecraft:glass", "minecraft:ice", "minecraft:book", "minecraft:paper",
    "minecraft:bookshelf", "minecraft:bowl", "minecraft:brick", "minecraft:nether_star",
    "minecraft:blaze_rod", "minecraft:ender_pearl", "minecraft:slime_ball",
    "minecraft:bone", "minecraft:bone_meal", "minecraft:gunpowder", "minecraft:spider_eye",
    "minecraft:wheat", "minecraft:bread", "minecraft:sugar", "minecraft:egg",
    "minecraft:apple", "minecraft:golden_apple", "minecraft:magma_cream",
    "minecraft:glowstone_dust", "minecraft:prismarine_shard", "minecraft:prismarine_crystals",
    "minecraft:nautilus_shell", "minecraft:heart_of_the_sea", "minecraft:honeycomb",
    "minecraft:honey_bottle", "minecraft:dye", "minecraft:ink_sac", "minecraft:glow_ink_sac",
    "minecraft:cactus", "minecraft:pumpkin", "minecraft:melon", "minecraft:carrot",
    "minecraft:potato", "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log",
    "minecraft:iron_block", "minecraft:gold_block", "minecraft:diamond_block",
    "minecraft:emerald_block", "minecraft:copper_block", "minecraft:amethyst_block",
    "minecraft:raw_iron", "minecraft:raw_gold", "minecraft:raw_copper",
    "minecraft:furnace", "minecraft:crafting_table", "minecraft:chest", "minecraft:hopper",
    "minecraft:torch", "minecraft:lantern", "minecraft:chain", "minecraft:ladder"
  ];

  const VANILLA_TAGS = [
    "minecraft:planks", "minecraft:logs", "minecraft:wool", "minecraft:coals",
    "minecraft:stone_crafting_materials", "minecraft:wooden_slabs",
    "minecraft:wooden_stairs", "minecraft:sand", "minecraft:small_flowers",
    "minecraft:tall_flowers", "minecraft:flowers", "minecraft:leaves"
  ];

  function emptyCells() { return new Array(9).fill(null); }

  function usedCells(recipe) {
    return (recipe.cells || []).filter(Boolean);
  }

  /** Bouw patroon + key uit de 3×3 (rips lege rijen/kolommen) */
  function buildPattern(cells) {
    const grid = [];
    for (let r = 0; r < 3; r++) grid.push(cells.slice(r * 3, r * 3 + 3));

    let minR = 3, maxR = -1, minC = 3, maxC = -1;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        if (grid[r][c]) {
          minR = Math.min(minR, r); maxR = Math.max(maxR, r);
          minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        }
    if (maxR < 0) return { pattern: [], key: {} };

    const pattern = [];
    const key = {};
    const letters = "ABCDEFGHIJ";
    let next = 0;
    for (let r = minR; r <= maxR; r++) {
      let row = "";
      for (let c = minC; c <= maxC; c++) {
        const ing = grid[r][c];
        if (!ing) { row += " "; continue; }
        let letter = Object.keys(key).find((k) => key[k] === ing);
        if (!letter) {
          letter = letters[next++];
          key[letter] = ing;
        }
        row += letter;
      }
      pattern.push(row);
    }
    return { pattern, key };
  }

  /** Ingredient-string → JSON-object ({item} of {tag}) */
  function ingredientJson(ing) {
    if (ing.startsWith("#")) return { tag: ing.slice(1) };
    return { item: ing };
  }

  /** Validatie; geeft lijst van problemen terug */
  function validate(recipe) {
    const issues = [];
    const used = usedCells(recipe);
    if (recipe.type === "shaped") {
      if (used.length < 1) issues.push("Minstens één ingrediënt in de 3×3 nodig.");
      if (!recipe.output) issues.push("Uitvoer ontbreekt.");
    } else if (recipe.type === "shapeless") {
      if (used.length < 1) issues.push("Minstens één ingrediënt nodig.");
      if (!recipe.output) issues.push("Uitvoer ontbreekt.");
    } else if (recipe.type === "smelting" || recipe.type === "smoking") {
      if (!recipe.cells[0]) issues.push("Ingrediënt ontbreekt.");
      if (!recipe.output) issues.push("Uitvoer ontbreekt.");
    }
    if (recipe.output && !/^[a-z0-9_.:]+$/.test(recipe.output))
      issues.push("Uitvoer-id mag alleen letters, cijfers, _, . en : bevatten.");
    if (recipe.count < 1 || recipe.count > 64) issues.push("Aantal moet 1-64 zijn.");
    return issues;
  }

  /** Korte samenvatting voor lijstweergave */
  function summary(recipe) {
    const ings = usedCells(recipe).slice(0, 6);
    const plus = usedCells(recipe).length > 6 ? "…" : "";
    const out = (recipe.output || "?") + (recipe.count > 1 ? " ×" + recipe.count : "");
    const t = { shaped: "Vormgebonden", shapeless: "Vormloos", smelting: "Smelten", smoking: "Smoken" }[recipe.type] || recipe.type;
    return `${t}: ${ings.join(", ")}${plus} → ${out}`;
  }

  return { VANILLA_ITEMS, VANILLA_TAGS, emptyCells, usedCells, buildPattern, ingredientJson, validate, summary };
})();

if (typeof module !== "undefined") module.exports = { RecipesKit };
