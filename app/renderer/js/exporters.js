// ── Exporteur: genereert een complete Fabric-mod uit een project ──
"use strict";

const Exporters = (() => {
  // ── Hulpjes ──
  const MC_PROFILES = {
    "1.20.1": { yarn: "1.20.1+build.10", loader: "0.15.11", fabric: "0.92.2+1.20.1", loom: "1.6-SNAPSHOT", java: 17 },
    "1.21.1": { yarn: "1.21.1+build.3", loader: "0.16.9", fabric: "0.115.1+1.21.1", loom: "1.7-SNAPSHOT", java: 21 },
    // 🟢 Laatste versie (sept 2026): kalender-versie + officiële Mojang-mappings
    "26.3": { loader: "0.19.5", fabric: "0.160.5+26.3", loom: "1.15-SNAPSHOT", java: 25, mojmap: true }
  };

  const VERSION_OPTIONS = [
    ["26.3", "26.3 – laatste versie (Mojang-mappings)"],
    ["1.20.1", "1.20.1 – stabiel (Yarn)"],
    ["1.21.1", "1.21.1 – stabiel (Yarn)"]
  ];

  function profile(p) {
    return MC_PROFILES[p.meta.mcVersion] || MC_PROFILES["1.20.1"];
  }
  /** Kalender-versies (26.x) gebruiken officiële Mojang-mappings */
  function isMojmap(p) {
    return !!(profile(p).mojmap);
  }
  function is121(p) {
    const v = p.meta.mcVersion || "1.20.1";
    return parseInt(v.split(".")[1], 10) >= 21;
  }
  /** 1.21+ én 26.x: nieuwe datapack-mappen (loot_table, recipe) */
  function usesNewDirs(p) {
    return isMojmap(p) || is121(p);
  }
  function lootDir(p) { return usesNewDirs(p) ? "loot_table" : "loot_tables"; }
  function recipesDir(p) { return usesNewDirs(p) ? "recipe" : "recipes"; }
  function advDir(p) { return usesNewDirs(p) ? "advancement" : "advancements"; }
  function functionsDir(p) { return usesNewDirs(p) ? "function" : "functions"; }

  /** 1.20.5+/26.x: data-componenten beschikbaar (glint, enchantable). */
  function hasComponents(p) {
    if (isMojmap(p)) return true;
    const parts = (p.meta.mcVersion || "1.20.1").split(".");
    const minor = parseInt(parts[1], 10) || 0;
    if (minor > 21) return true;
    if (minor === 21) return true;
    if (minor === 20) return (parseInt(parts[2], 10) || 0) >= 5;
    return false;
  }

  // ── Uitrusting (armor): 3 weergaven – inventaris-icoon, in de hand, op het lijf ──
  const ARMOR_SLOTS = { helmet: "HELMET", chest: "CHESTPLATE", legs: "LEGGINGS", boots: "BOOTS" };
  const ARMOR_HP = { helmet: 165, chest: 240, legs: 225, boots: 195 };
  function isArmor(it) { return !!(it.armor && it.armor.slot && ARMOR_SLOTS[it.armor.slot]); }
  function armorHp(it) { const d = it.maxDamage | 0; return d > 0 ? d : (ARMOR_HP[it.armor.slot] || 165); }
  function armorDefense(it) { return (it.armor && (it.armor.defense | 0)) || 3; }

  /** ArmorMaterial-record voor 26.x (mojmap) – reparatie-tag + equipment-asset. */
  function armorMaterialM(p, it, hp) {
    const ns = p.meta.modId;
    const def = armorDefense(it);
    const map = Object.entries(ARMOR_SLOTS)
      .map(([k, v]) => `net.minecraft.world.item.ArmorType.${v}, ${k === it.armor.slot ? def : 0}`)
      .join(", ");
    const ench = (it.enchantability | 0) || 0;
    return `new net.minecraft.world.item.ArmorMaterial(${hp}, java.util.Map.of(${map}), ${ench}, `
      + `net.minecraft.sounds.SoundEvents.ARMOR_EQUIP_IRON, 0.0F, 0.0F, `
      + `net.minecraft.tags.TagKey.create(net.minecraft.core.registries.BuiltInRegistries.ITEM.key(), `
      + `net.minecraft.resources.ResourceLocation.fromNamespaceAndPath("${ns}", "repairs_${it.id}")), `
      + `net.minecraft.resources.ResourceKey.create(net.minecraft.world.item.equipment.EquipmentAssets.ROOT_ID, `
      + `net.minecraft.resources.ResourceLocation.fromNamespaceAndPath("${ns}", "${it.id}")))`;
  }

  /** Anonieme ArmorMaterial voor yarn (1.20.1). */
  function armorMaterialY(p, it, hp) {
    const ns = p.meta.modId;
    const def = armorDefense(it);
    const ench = (it.enchantability | 0) || 0;
    return `new net.minecraft.item.ArmorMaterial() {
        @Override public int getDurability(net.minecraft.item.ArmorItem.Type type) { return ${hp}; }
        @Override public int getProtection(net.minecraft.item.ArmorItem.Type type) { return ${def}; }
        @Override public int getEnchantability() { return ${ench}; }
        @Override public net.minecraft.sound.SoundEvent getEquipSound() { return net.minecraft.sound.SoundEvents.ITEM_ARMOR_EQUIP_IRON; }
        @Override public net.minecraft.recipe.Ingredient getRepairIngredient() { return net.minecraft.recipe.Ingredient.ofItems(net.minecraft.item.Items.IRON_INGOT); }
        @Override public String getName() { return "${ns}:${it.id}"; }
        @Override public float getToughness() { return 0.0F; }
        @Override public float getKnockbackResistance() { return 0.0F; }
    }`;
  }

  /** Item-properties keten voor officiële Mojang-mappings (26.x). */
  function itemPropsM(p, it) {
    const bits = [];
    const dmg = it.maxDamage | 0;
    if (dmg > 0) bits.push(`maxDamage(${dmg})`);
    else if (isArmor(it)) bits.push(`maxDamage(${armorHp(it)})`);
    else if ((it.maxStack || 64) !== 1) bits.push(`stacksTo(${it.maxStack || 64})`);
    if (it.rarity) bits.push(`rarity(net.minecraft.world.item.Rarity.${String(it.rarity).toUpperCase()})`);
    if (it.fireproof) bits.push("fireResistant()");
    if (it.glint) bits.push("component(net.minecraft.core.component.DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true)");
    if ((it.enchantability | 0) > 0) bits.push(`enchantable(${it.enchantability | 0})`);
    if (isArmor(it)) {
      bits.push(`humanoidArmor(${armorMaterialM(p, it, armorHp(it))}, net.minecraft.world.item.ArmorType.${ARMOR_SLOTS[it.armor.slot]})`);
    }
    return bits.length ? "." + bits.join(".") : "";
  }

  const BEHAVIOR_LABELS = { dwaalt: "dwaalt rustig rond", jager: "jager – valt spelers aan", vlucht: "vlucht bij gevaar", springer: "springerig & aanvallend" };

  /** Extra AI-doelen voor de gedrag-preset (FQN → werkt in beide mappings). */
  function behaviorGoals(m, flavor) {
    if (!m.behavior) return "";
    const goal = flavor === "mojmap" ? "net.minecraft.world.entity.ai.goal" : "net.minecraft.entity.ai.goal";
    const tgt = flavor === "mojmap" ? "net.minecraft.world.entity.ai.goal.target" : "net.minecraft.entity.ai.goal.target";
    const player = flavor === "mojmap" ? "net.minecraft.world.entity.player.Player" : "net.minecraft.entity.player.PlayerEntity";
    const L = [`        // 🎬 BlockyMod gedrag: ${BEHAVIOR_LABELS[m.behavior] || m.behavior}`];
    if (m.behavior === "dwaalt") {
      L.push(`        this.goalSelector.addGoal(3, new ${goal}.RandomStrollGoal(this, 1.0));`);
      L.push(`        this.goalSelector.addGoal(4, new ${goal}.LookAtPlayerGoal(this, ${player}.class, 6.0F));`);
    }
    if (m.behavior === "jager") {
      L.push(`        this.goalSelector.addGoal(1, new ${goal}.MeleeAttackGoal(this, 1.2, true));`);
      L.push(`        this.targetSelector.addGoal(2, new ${tgt}.NearestAttackableTargetGoal<>(this, ${player}.class, true));`);
    }
    if (m.behavior === "vlucht") {
      L.push(`        this.goalSelector.addGoal(0, new ${goal}.PanicGoal(this, 1.4));`);
    }
    if (m.behavior === "springer") {
      L.push(`        this.goalSelector.addGoal(1, new ${goal}.LeapAtTargetGoal(this, 0.4F));`);
      L.push(`        this.goalSelector.addGoal(2, new ${goal}.MeleeAttackGoal(this, 1.1, true));`);
      L.push(`        this.targetSelector.addGoal(3, new ${tgt}.NearestAttackableTargetGoal<>(this, ${player}.class, true));`);
    }
    return L.join("\n");
  }

  /** Animatie-trigger-haksels + aiStep/tickMovement-hook in de entity-klasse. */
  const PARTICLE_CONSTS = {
    flame: "FLAME", smoke: "SMOKE", heart: "HEART", crit: "CRIT", enchanted_hit: "ENCHANTED_HIT",
    happy_villager: "HAPPY_VILLAGER", angry_villager: "ANGRY_VILLAGER", end_rod: "END_ROD",
    snowflake: "SNOWFLAKE", electric_spark: "ELECTRIC_SPARK", portal: "PORTAL",
    underwater: "UNDERWATER", note: "NOTE", witch: "WITCH", slime: "SLIME"
  };

  /** Verwijzing naar een geluid-event: vanilla SoundEvents of eigen ModSounds. */
  function triggerSoundRef(p, m, flavor) {
    const moj = flavor === "mojmap";
    const v = m.triggerSound || "";
    if (v.startsWith("mod:")) return `ModSounds.${constname(v.slice(4))}`;
    if (v.startsWith("vanilla:")) {
      const n = v.slice(8);
      return moj ? `net.minecraft.sounds.SoundEvents.${n}` : `net.minecraft.sound.SoundEvents.${n}`;
    }
    return moj ? "net.minecraft.sounds.SoundEvents.ENTITY_PIG_AMBIENT" : "net.minecraft.sound.SoundEvents.ENTITY_PIG_AMBIENT";
  }

  /** Partikel-regel die op de serverkant draait (beide mappings). */
  function particleBlock(m, flavor) {
    const id = m.triggerParticle || "";
    if (!id) return "";
    const c = PARTICLE_CONSTS[id] || id.toUpperCase();
    const pt = flavor === "mojmap" ? "net.minecraft.core.particles.ParticleTypes" : "net.minecraft.particle.ParticleTypes";
    if (flavor === "mojmap") {
      return `
        if (this.level() instanceof net.minecraft.server.level.ServerLevel bmSl) {
            bmSl.sendParticles(${pt}.${c}, this.getX(), this.getY() + 1.0D, this.getZ(), 0.3D, 0.3D, 0.3D, 0.05D, 12);
        }`;
    }
    return `
        if (this.getWorld() instanceof net.minecraft.server.world.ServerWorld bmSw) {
            bmSw.spawnParticles(${pt}.${c}, this.getX(), this.getY() + 1.0D, this.getZ(), 0.3D, 0.3D, 0.3D, 0.05D, 12);
        }`;
  }

  function triggersBlock(p, m, flavor) {
    const ids = m.triggers || [];
    const eigenRaw = m.eigenCode == null ? "" : String(m.eigenCode);
    const hasEigen = eigenRaw.trim().length > 0;
    if (!ids.length && !(m.triggerParticle || "") && !(m.triggerSound || "") && !hasEigen) return "";
    const moj = flavor === "mojmap";
    const tick = moj ? "this.tickCount" : "this.age";
    const ambient = triggerSoundRef(p, m, flavor);
    const part = particleBlock(m, flavor);
    const L = [];
    if (ids.includes("spawn")) {
      L.push(`        if (${tick} == 1) {
            // 🌀 SPAWN: start-effect (geluid/partikel) – vervang door jouw animatie!
            this.playSound(${ambient}, 1.0F, 1.3F);${part}
        }`);
    }
    if (ids.includes("attack")) {
      L.push(`        if (this.getTarget() != null) {
            // ⚔ AANVAL: voeg hier partikels/beweging toe zodra de AI-code er is
        }`);
    }
    if (ids.includes("click")) {
      L.push(`        // 🖱 RECHTSKLIJK: visuele reactie op de interact-methode (zie interactMob)
        if (${tick} % 20 == 0) { /* voorbeeld-tick; wacht op AI-animatie */ }`);
    }
    if (ids.includes("timer")) {
      L.push(`        if (${tick} % 100 == 0) {
            // ⏱ ELKE 5 SECONDEN: periodiek animatie-effect${part}
        }`);
    }
    if (ids.includes("lowhp")) {
      L.push(`        if (this.getHealth() < this.getMaxHealth() * 0.3F) {
            // 💔 LAAG LEVEN: alarm-effect / animatie
        }`);
    }
    const hook = moj
      ? `    @Override
    public void aiStep() {
        super.aiStep();
        this.blockyModTriggers();
    }`
      : `    @Override
    protected void tickMovement() {
        super.tickMovement();
        this.blockyModTriggers();
    }`;
    const eigenMeth = hasEigen
      ? `\n    // — Eigen code van jou (of de AI) – draait elke tick —\n    private void bmEigenCode() {\n${eigenRaw.trim().split("\n").map((l) => "        " + l).join("\n")}\n    }\n`
      : "";
    return `    // 🎬 BlockyMod animatie-triggers – koppel hier je animaties (of laat de AI het coderen!)
    private int bmTriggerTimer = 0;

    private void blockyModTriggers() {
        bmTriggerTimer++;
${L.join("\n")}${hasEigen ? "\n        bmEigenCode();" : ""}
    }

${hook}${eigenMeth}
`;
  }

  /** Vorm-array normaliseren (blok én item): nieuw `shapes` of legacy `shape`. */
  function shapesOf(o) {
    if (Array.isArray(o.shapes) && o.shapes.length) return o.shapes;
    return [o.shape || { w: 16, h: 16, d: 16 }];
  }

  /** Maatwerk-model met elementen (multi-vorm) – gedeeld voor blokken én items. */
  function elementModel(baseTex, texDir, els, faceTex) {
    const r = (n) => Math.round(n * 100) / 100;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, parseFloat(v) || 0));
    const textures = { particle: baseTex, "0": baseTex };
    const DIRMAP = { north: "front", south: "back", west: "left", east: "right", up: "top", down: "bottom" };
    faceTex = faceTex || {};
    for (const ui of Object.values(DIRMAP)) {
      if (faceTex[ui] && faceTex[ui].length) textures["face_" + ui] = `${texDir}_${ui}`;
    }
    const elements = els.map((e, i) => {
      const w = Math.max(1, Math.min(32, parseFloat(e.w) || 16));
      const h = Math.max(1, Math.min(32, parseFloat(e.h) || 16));
      const d = Math.max(1, Math.min(32, parseFloat(e.d) || 16));
      // Legacy (zonder Pos-velden): x/z gecentreerd, y vanaf 0 – exact zoals oud gedrag
      const x = e.x == null ? (16 - w) / 2 : clamp(e.x, -16, 31);
      const y = e.y == null ? 0 : clamp(e.y, -16, 31);
      const z = e.z == null ? (16 - d) / 2 : clamp(e.z, -16, 31);
      let key = "0";
      if (e.color) { key = "v" + i; textures[key] = `${texDir}_vorm${i}`; }
      const mkFace = (dir) => {
        const ui = DIRMAP[dir];
        const k = faceTex[ui] && faceTex[ui].length ? "face_" + ui : key;
        return { uv: [0, 0, 16, 16], texture: "#" + k };
      };
      const el = {
        from: [r(x), r(y), r(z)],
        to: [r(x + w), r(y + h), r(z + d)],
        faces: {
          down: mkFace("down"), up: mkFace("up"),
          north: mkFace("north"), south: mkFace("south"),
          west: mkFace("west"), east: mkFace("east")
        }
      };
      const ang = parseFloat(e.rotAngle) || 0;
      if (e.rotAxis && ang && ["x", "y", "z"].includes(e.rotAxis)) {
        el.rotation = { origin: [r(x + w / 2), r(y + h / 2), r(z + d / 2)], axis: e.rotAxis, angle: ang };
      }
      return el;
    });
    return { textures, elements };
  }

  function isPlainFullCube(b) {
    const els = shapesOf(b);
    if (els.length !== 1) return false;
    const e = els[0];
    const faces = b.faceTex || {};
    const hasFaceTex = Object.keys(faces).some((k) => faces[k] && faces[k].length);
    return +e.w >= 16 && +e.h >= 16 && +e.d >= 16 && !(parseFloat(e.rotAngle) || 0) && !e.color && !hasFaceTex
      && !((+e.x) || (+e.y) || (+e.z));
  }

  /** Blokmodel: standaard-kubus óf maatwerk model (3D-vorm uit de editor). */
  function blockModel(ns, b) {
    const tex = `${ns}:block/${b.id}`;
    if (isPlainFullCube(b)) return { parent: "minecraft:block/cube_all", textures: { all: tex } };
    return elementModel(tex, tex.replace(/[^/]+$/, "") + b.id, shapesOf(b), b.faceTex);
  }

  /** Item-3D-model (zelfde editor als blokken) – parentloos element-model. */
  function itemModel3d(ns, it) {
    const tex = `${ns}:item/${it.id}`;
    return elementModel(tex, tex, shapesOf(it), it.faceTex);
  }

  /** Enchantment-JSON (26.x data-driven registry). */
  function enchantJson(p, e) {
    const ns = p.meta.modId;
    const base = typeof e.base === "number" ? e.base : 1;
    const per = typeof e.perLevel === "number" ? e.perLevel : 0.5;
    const maxLvl = Math.max(1, e.maxLevel || 3);
    let effects;
    if (e.effect === "status") {
      const dur = Math.max(1, e.statusDur || 3);
      effects = {
        "minecraft:post_attack": [{
          enchanted: "attacker",
          affected: "victim",
          effect: {
            type: "minecraft:apply_mob_effect",
            to_apply: e.statusId || "minecraft:poison",
            min_amplifier: e.statusAmp || 0,
            max_amplifier: e.statusAmp || 0,
            min_duration: { type: "minecraft:linear", base: dur, per_level_above_first: 0 },
            max_duration: { type: "minecraft:linear", base: dur, per_level_above_first: 0 }
          }
        }]
      };
    } else if (e.effect === "eigen") {
      effects = {
        "minecraft:post_attack": [{
          enchanted: "attacker",
          affected: "victim",
          effect: { type: "minecraft:run_function", function: `${ns}:enchant_${e.id}` }
        }]
      };
    } else if (e.effect === "knockback") {
      effects = {
        "minecraft:knockback": [{
          effect: { type: "minecraft:linear", base: base, per_level_above_first: per }
        }]
      };
    } else {
      effects = {
        "minecraft:damage": [{
          effect: { type: "minecraft:add", value: { type: "minecraft:linear", base: base, per_level_above_first: per } }
        }]
      };
    }
    return {
      description: { translate: `enchantment.${ns}.${e.id}` },
      weight: Math.max(1, e.weight || 10),
      max_level: maxLvl,
      min_cost: { base: 5, per_level_above_first: 8 },
      max_cost: { base: 20, per_level_above_first: 8 },
      anvil_cost: 2,
      slots: [e.slots || "hand"],
      supported_items: `#${ns}:enchantable/${e.id}`,
      effects
    };
  }

  /** Waarden voor het item-tag van een enchant: vanilla-tag(s) + eigen mod-items. */
  function enchantTagValues(p, e) {
    const ns = p.meta.modId;
    const vanilla = (e.slots === "armor")
      ? ["#minecraft:enchantable/armor"]
      : (e.slots === "any")
        ? ["#minecraft:enchantable/weapon", "#minecraft:enchantable/armor"]
        : (e.slots === "mainhand")
          ? ["#minecraft:enchantable/sword"]
          : ["#minecraft:enchantable/weapon"];
    const modItems = (p.items || []).map((it) => `${ns}:${it.id}`);
    return [...vanilla, ...modItems];
  }

  /** ModSounds: registreert eigen geluid-events (playsound + triggers). */
  function modSounds(p) {
    const ns = p.meta.modId;
    const lines = (p.sounds || []).map((s) =>
      `    public static final net.minecraft.${isMojmap(p) ? "sounds" : "sound"}.SoundEvent ${constname(s.id)} = register("${s.id}"); // ${s.naam || s.id}`);
    if (isMojmap(p)) {
      return `package ${javaPackage(p)};

/** Eigen geluiden – gegenereerd door BlockyMod Studio (sounds.json + .ogg). */
public final class ModSounds {
    private ModSounds() {}

${lines.join("\n")}

    public static void register() {
        // klassen-lading hierboven registreert alle geluiden
    }

    private static net.minecraft.sounds.SoundEvent register(String name) {
        net.minecraft.resources.ResourceLocation id =
                net.minecraft.resources.ResourceLocation.fromNamespaceAndPath("${ns}", name);
        return net.minecraft.core.Registry.register(
                net.minecraft.core.registries.BuiltInRegistries.SOUND_EVENT, id,
                net.minecraft.sounds.SoundEvent.createVariableRangeEvent(id));
    }
}`;
    }
    return `package ${javaPackage(p)};

/** Eigen geluiden – gegenereerd door BlockyMod Studio (sounds.json + .ogg). */
public final class ModSounds {
    private ModSounds() {}

${lines.join("\n")}

    public static void register() {
        // klassen-lading hierboven registreert alle geluiden
    }

    private static net.minecraft.sound.SoundEvent register(String name) {
        net.minecraft.util.Identifier id = net.minecraft.util.Identifier.of("${ns}", name);
        return net.minecraft.registry.Registry.register(
                net.minecraft.registry.Registry.SOUND_EVENT, id,
                net.minecraft.sound.SoundEvent.of(id));
    }
}`;
  }

  /** Advancement/quest-JSON (werkbaar op 1.20.1 én 26.x). */
  function questJson(p, q) {
    const ns = p.meta.modId;
    let criteria;
    if (q.type === "item") {
      criteria = { start: { trigger: "minecraft:inventory_changed", conditions: { items: [{ id: q.itemId || "minecraft:diamond" }] } } };
    } else if (q.type === "kill") {
      criteria = { start: { trigger: "minecraft:player_killed_entity", conditions: { entity: { type: q.entityId || "minecraft:zombie" } } } };
    } else {
      criteria = { start: { trigger: "minecraft:tick" } };
    }
    const rewards = {};
    if ((q.xp | 0) > 0) rewards.experience = q.xp | 0;
    if ((q.cmd || "").trim()) rewards.function = `${ns}:${q.id}_reward`;
    const out = {
      display: {
        icon: { id: q.icon || "minecraft:stone" },
        title: q.title || q.id,
        description: q.desc || "",
        frame: ["goal", "challenge"].includes(q.frame) ? q.frame : "task",
        background: "minecraft:textures/gui/advancements/backgrounds/stone.png",
        show_toast: true,
        announce_to_chat: true
      },
      criteria
    };
    if (Object.keys(rewards).length) out.rewards = rewards;
    return out;
  }

  /** Java-klasse met enchantment-registratie voor yarn (1.20.1). */
  function modEnchantmentsY(p) {
    const ns = p.meta.modId;
    const fields = (p.enchants || []).map((e) => {
      const cn = constname(e.id);
      // ALL: de vanilla-categories (WEAPON/ARMOR) sluiten eigen mod-items uit;
      // de EquipmentSlot-lijst filtert al op de juiste uitrustingsplek.
      const cat = "EnchantmentCategory.ALL";
      const slots = e.slots === "armor"
        ? "EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET"
        : e.slots === "any"
          ? "EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND, EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET"
          : e.slots === "hand"
            ? "EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND"
            : "EquipmentSlot.MAINHAND";
      const maxLvl = Math.max(1, e.maxLevel || 3);
      const base = typeof e.base === "number" ? e.base : 1;
      const per = typeof e.perLevel === "number" ? e.perLevel : 0.5;
      const rar = e.rarity === "epic" ? "EPIC" : e.rarity === "rare" ? "RARE" : e.rarity === "common" ? "COMMON" : "UNCOMMON";
      let effect = "";
      if (e.effect === "status") {
        const constmap = { poison: "POISON", wither: "WITHER", slowness: "SLOWNESS", weakness: "WEAKNESS", glowing: "GLOWING", hunger: "HUNGER", blindness: "BLINDNESS", levitation: "LEVITATION" };
        const sid = String(e.statusId || "minecraft:poison").split(":")[1] || "poison";
        const sconst = constmap[sid] || "POISON";
        const dur = Math.max(1, e.statusDur || 3) * 20;
        const amp = e.statusAmp || 0;
        effect = `
        @Override
        public void doPostAttack(LivingEntity attacker, Entity target, int level) {
            super.doPostAttack(attacker, target, level);
            if (target instanceof LivingEntity living) {
                living.addStatusEffect(new StatusEffectInstance(StatusEffectInstances.${sconst}, ${dur}, ${amp}));
            }
        }`;
      } else if (e.effect === "eigen") {
        const code = String(e.eigenCode || "// vul je eigen code in de app aan").trim();
        effect = `
        @Override
        public void doPostAttack(LivingEntity attacker, Entity target, int level) {
            super.doPostAttack(attacker, target, level);
            // — Eigen code (BlockyMod Studio) —
${code.split("\n").map((l) => "            " + l).join("\n")}
        }`;
      } else if (e.effect === "knockback") {
        effect = `
        @Override
        public void doPostAttack(LivingEntity attacker, Entity target, int level) {
            super.doPostAttack(attacker, target, level);
            target.knockback(${base.toFixed(2)}D * level, attacker.getX() - target.getX(), attacker.getZ() - target.getZ());
        }`;
      } else {
        effect = `
        @Override
        public float getAttackDamage(int level, EntityType<?> type) {
            return ${base.toFixed(1)}F + (level - 1) * ${per.toFixed(1)}F;
        }`;
      }
      return `    public static final Enchantment ${cn} = Registry.register(Registry.ENCHANTMENT,
            new Identifier("${ns}", "${e.id}"),
            new Enchantment(Enchantment.Rarity.${rar}, ${cat}, ${slots}) {
        @Override
        public int getMaxLevel() {
            return ${maxLvl};
        }

        @Override
        public int getMinCost(int level) {
            return 5 + (level - 1) * 8;
        }

        @Override
        public int getMaxCost(int level) {
            return 20 + (level - 1) * 8;
        }

        @Override
        public int getWeight() {
            return ${Math.max(1, e.weight || 10)};
        }
${effect}
    });`;
    }).join("\n\n");
    return `package ${javaPackage(p)};

import net.minecraft.enchantment.Enchantment;
import net.minecraft.enchantment.EnchantmentCategory;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffectInstances;
import net.minecraft.registry.Registry;
import net.minecraft.util.Identifier;

/**
 * Aangepaste enchants – gegenereerd door BlockyMod Studio.
 * Gebruik in-game: /enchant @p <modid>:<id> <niveau>
 */
public final class ModEnchantments {
    private ModEnchantments() {}

${fields}

    public static void register() {
        // registratie gebeurt via statische initialisatie (zie velden)
    }
}
`;
  }

  /** Prompt-bestand in ai-code/ voor de AI: animaties coderen. */
  function animPromptMd(p, m) {
    const map = { spawn: "bij spawn", attack: "bij een aanval", click: "bij rechtsklik", timer: "elke 5 seconden", lowhp: "bij laag leven (<30%)" };
    const chosen = (m.triggers || []).map((t) => map[t] || t);
    return `# 🎬 Animatie-prompts – ${m.name || m.id}

Triggers uit de app: ${chosen.length ? chosen.join(", ") : (m.behavior ? "gedrag: " + (BEHAVIOR_LABELS[m.behavior] || m.behavior) : "geen")}.

## Zo werkt het
1. Vraag de AI: *"Schrijf de animatie voor \`${m.id}\` die ${chosen[0] || "bij spawn"} partikels en geluid geeft"*
2. De AI zet de code in deze map (pad relatief aan deze map).
3. In de app: 🤖 AI-code / GitHub → **Codes ophalen** → opnieuw exporten.

## Waar de hooks staan
- Entity-klasse: \`src/main/java/.../entity/${classname(m.id)}Entity.java\`
- Methode: \`blockyModTriggers()\` met de aangevinkte triggers
- Voorbeelden die je aan de AI kunt vragen:
  - partikels: \`this.level().addParticle(ParticleTypes.CLOUD, getX(), getY(), getZ(), 0, 0.1, 0);\`
  - geluid: \`this.playSound(SoundEvents.ENTITY_PIG_AMBIENT, 1.0F, 1.0F);\`
  - beweging in \`aiStep()\` (26.3) of \`tickMovement()\` (1.20.1)

> Klaar? Zet de bestanden in je GitHub-map en druk in de app op **Codes ophalen**. 🚀
`;
  }

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
    if (usesNewDirs(p)) return "";
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
    if (isMojmap(p)) {
      put(`src/main/java/${pkgDir(p)}/CreativeTab.java`, creativeTabM(p));
    }

    // ── Blokken ──
    const ns = p.meta.modId;
    for (const b of p.blocks) {
      put(`src/main/resources/assets/${ns}/blockstates/${b.id}.json`, json({
        variants: { "": { model: `${ns}:block/${b.id}` } }
      }));
      put(`src/main/resources/assets/${ns}/models/block/${b.id}.json`, json(blockModel(ns, b)));
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
      if (!isPlainFullCube(it) && (Array.isArray(it.shapes) && it.shapes.length)) {
        // Maatwerk 3D-vorm (gedeelde editor met blokken)
        put(`src/main/resources/assets/${ns}/models/block/${it.id}.json`, json(itemModel3d(ns, it)));
        put(`src/main/resources/assets/${ns}/models/item/${it.id}.json`, json({ parent: `${ns}:block/${it.id}` }));
      } else {
        put(`src/main/resources/assets/${ns}/models/item/${it.id}.json`, json({
          parent: "minecraft:item/generated",
          textures: { layer0: `${ns}:item/${it.id}` }
        }));
      }
    }

    // ── 🧪 Drankjes: fles-modellen ──
    for (const pl of (p.potions || [])) {
      const bot = bottleSet(pl);
      for (const [on, suf] of [[bot.normaal, ""], [bot.splash, "_splash"], [bot.lingering, "_lingering"], [bot.pijl, "_arrow"]]) {
        if (!on) continue;
        put(`src/main/resources/assets/${ns}/models/item/${pl.id}${suf}.json`, json({
          parent: "minecraft:item/generated",
          textures: { layer0: `${ns}:item/${pl.id}${suf}` }
        }));
      }
      if (isMojmap(p)) {
        // 26.3: data-driven brewing (bron: minecraft.wiki – type minecraft:brewing)
        const ingr = (pl.brew && pl.brew.ingr) || "minecraft:nether_wart";
        const from = pl.brew && pl.brew.van === "awkward" ? "minecraft:awkward" : "minecraft:water";
        if (pl.brew && pl.brew.on !== false) {
          put(`src/main/resources/data/${ns}/recipe/${pl.id}_brouwen.json`, json({
            type: "minecraft:brewing",
            input: { item: "minecraft:potion", potion_contents: { potion: from } },
            reagent: { item: ingr },
            output: { id: `${ns}:${pl.id}` }
          }));
        }
        if (bot.splash) {
          put(`src/main/resources/data/${ns}/recipe/${pl.id}_brouwen_spetter.json`, json({
            type: "minecraft:brewing",
            input: { item: `${ns}:${pl.id}` },
            reagent: { item: "minecraft:gunpowder" },
            output: { id: `${ns}:${pl.id}_splash` }
          }));
        }
        if (bot.lingering) {
          put(`src/main/resources/data/${ns}/recipe/${pl.id}_brouwen_wolk.json`, json({
            type: "minecraft:brewing",
            input: { item: bot.splash ? `${ns}:${pl.id}_splash` : `${ns}:${pl.id}` },
            reagent: { item: "minecraft:dragon_breath" },
            output: { id: `${ns}:${pl.id}_lingering` }
          }));
        }
      }
    }

    // ── Aangepaste enchants ──
    const enchants = p.enchants || [];
    for (const e of enchants) {
      if (isMojmap(p)) {
        put(`src/main/resources/data/${ns}/enchantment/${e.id}.json`, json(enchantJson(p, e)));
        if (e.effect === "eigen") {
          put(`src/main/resources/data/${ns}/function/enchant_${e.id}.mcfunction`,
            `# Eigen enchant-effect – ${e.name || e.id} (BlockyMod Studio)\n# Commando's hieronder draaien bij elke hit:\n` + String(e.eigenCode || "# vul aan in de app").trim() + "\n");
        }
        put(`src/main/resources/data/${ns}/tags/item/enchantable/${e.id}.json`, json({ values: enchantTagValues(p, e) }));
        put(`src/main/resources/data/minecraft/tags/enchantment/in_enchanting_table.json`, json({ values: enchants.map((x) => `${ns}:${x.id}`) }));
      } else {
        put(`src/main/java/${pkgDir(p)}/ModEnchantments.java`, modEnchantmentsY(p));
        break; // één gedeelde registratie-klasse
      }
    }

    // ── Uitrusting (armor): equipment-asset (26.x) + reparatie-tag ──
    for (const it of p.items) {
      if (!isArmor(it)) continue;
      if (isMojmap(p)) {
        put(`src/main/resources/assets/${ns}/equipment/${it.id}.json`, json({
          layers: {
            humanoid: [{ texture: `${ns}:${it.id}` }],
            humanoid_leggings: [{ texture: `${ns}:${it.id}` }]
          }
        }));
        put(`src/main/resources/data/${ns}/tags/item/repairs_${it.id}.json`, json({ values: ["minecraft:iron_ingot"] }));
      }
    }
    // geanimeerde icoon → mcmeta (inventaris én in de hand)
    for (const it of p.items) {
      if (it.frames && it.frames.length) {
        put(`src/main/resources/assets/${ns}/textures/item/${it.id}.mcmeta`, json({ animation: { frametime: 10 } }));
      }
    }

    // ── Geluiden ──
    const sounds = p.sounds || [];
    if (sounds.length) {
      const sj = {};
      for (const s of sounds) {
        sj[`${ns}:${s.id}`] = { subtitle: `subtitles.${ns}.${s.id}`, sounds: [{ name: `${ns}:${s.id}` }] };
      }
      put(`src/main/resources/assets/${ns}/sounds.json`, json(sj));
      put(`src/main/java/${pkgDir(p)}/ModSounds.java`, modSounds(p));
    }
    if ((p.effects || []).length) {
      put(`src/main/java/${pkgDir(p)}/ModEffects.java`, modEffects(p));
    }
    if (!isMojmap(p) && (p.potions || []).length) {
      put(`src/main/java/${pkgDir(p)}/ModPotions.java`, modPotions(p));
    }

    // ── Quests (advancements) ──
    for (const q of (p.quests || [])) {
      put(`src/main/resources/data/${ns}/${advDir(p)}/${q.id}.json`, json(questJson(p, q)));
      const fn = (q.cmd || "").trim();
      if (fn) {
        put(`src/main/resources/data/${ns}/${functionsDir(p)}/${q.id}_reward.mcfunction`,
          fn.split("\n").map((l) => l.replace(/^\/+/, "")).join("\n") + "\n");
      }
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
      const handlerFile = isMojmap(p) ? `${classname(g.id)}Menu.java` : `${classname(g.id)}ScreenHandler.java`;
      put(`src/main/java/${pkgDir(p)}/gui/${handlerFile}`, screenHandler(p, g));
      put(`src/main/java/${pkgDir(p)}/client/${classname(g.id)}Screen.java`, screenClass(p, g));
    }
    if (p.guis.length) {
      put(`src/main/java/${pkgDir(p)}/gui/ModScreenHandlers.java`, modScreenHandlers(p));
      put(`src/main/java/${pkgDir(p)}/client/ModClient.java`, modClient(p));
    }

    // ── Mobs ──
    for (const m of p.mobs) {
      put(`src/main/java/${pkgDir(p)}/entity/${classname(m.id)}Entity.java`, entityClass(p, m));
      if ((m.triggers && m.triggers.length) || m.behavior) {
        put(`ai-code/animaties/${m.id}.md`, animPromptMd(p, m));
      }
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
- **Minecraft:** ${p.meta.mcVersion} (Fabric, Java ${profile(p).java}+)
- **Mappings:** ${isMojmap(p) ? "officiële Mojang-mappings (standaard sinds Minecraft 26.1)" : "Yarn " + (profile(p).yarn || "")}
- **Pakket:** \`${p.meta.package}\`
- **Auteur:** ${p.meta.author}
${isMojmap(p) ? `
> ⚠️ **Laatste-versie-doel:** dit project is gegenereerd voor Minecraft ${p.meta.mcVersion}.
> Fabric API-namen zijn recent gewijzigd – als er een kleine compilefout is,
> plak die in de chat en dan fix ik hem in \`ai-code/\`.
` : ""}
## Openen & draaien

1. Open deze map in **IntelliJ IDEA** (met de Gradle-plugin) of in VS Code.
2. Laat Gradle syncen (internet nodig – Fabric Loom wordt gedownload).${isMojmap(p) ? " Gebruik **Gradle 9.4+** (nodig voor Loom 1.15)." : ""}
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
    if (isMojmap(p)) return buildGradleM(p);
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
    if (isMojmap(p)) return gradlePropsM(p);
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



  // ── Drankjes-effecten: gedeelde helpers ──
  function bottleSet(pl) {
    return Object.assign({ normaal: true, splash: true, lingering: true, pijl: true }, pl.bottles || {});
  }
  function potColorInt(pl) {
    return parseInt(String(pl.kleur || "#3366cc").replace(/^#/, "").padEnd(6, "0").slice(0, 6), 16) || 0x3366cc;
  }
  /** Effect-instanties als gedeelde lijst-informatie. */
  function potEffectRows(p, pl) {
    return (pl.effects || []).map((r) => ({
      id: r.eff || "minecraft:speed",
      dur: Math.max(1, parseInt(r.dur, 10) || 60) * 20,
      amp: Math.max(0, parseInt(r.amp, 10) || 0)
    }));
  }
  /** 26.3: Holder-resolutie via de registry. ⚠️ ongeldige id → AI-fix. */
  function mjEffectRef(id) {
    return `net.minecraft.core.Holder.direct(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.get(net.minecraft.resources.ResourceLocation.parse("${id}")))`;
  }
  function mjInstanceList(p, pl) {
    const rows = potEffectRows(p, pl).map((r) => `new net.minecraft.world.effect.MobEffectInstance(${mjEffectRef(r.id)}, ${r.dur}, ${r.amp})`);
    return `java.util.List.of(${rows.join(", ") || " "})`;
  }
  /** ⚠️ PotionContents-recordvolgorde (potion, custom_color, custom_effects) – AI-fix bij compile-fout. */
  function mjContents(p, pl) {
    return `new net.minecraft.world.item.component.PotionContents(java.util.Optional.empty(), java.util.Optional.of(${potColorInt(pl)}), ${mjInstanceList(p, pl)})`;
  }
  /** 1.20.1 (yarn): ruwe registry-resolutie – werkt voor vanilla én eigen effect-id's. */
  function yvEffectRef(id) {
    return `net.minecraft.registry.Registries.STATUS_EFFECT.get(net.minecraft.util.Identifier.tryParse("${id}"))`;
  }
  function yvInstanceList(p, pl) {
    const rows = potEffectRows(p, pl).map((r) => `new net.minecraft.entity.effect.StatusEffectInstance(${yvEffectRef(r.id)}, ${r.dur}, ${r.amp})`);
    return rows.join(", ");
  }
  const BREW_INGR = { "minecraft:nether_wart": "NETHER_WART", "minecraft:redstone": "REDSTONE", "minecraft:glowstone": "GLOWSTONE", "minecraft:dragon_breath": "DRAGON_BREATH", "minecraft:gunpowder": "GUNPOWDER" };

  /** Drankjes → ModPotions.java (1.20.1 yarn): Potion-registry + fles-items. */
  function modPotions(p) {
    const ns = p.meta.modId;
    const rows = [];
    for (const pl of (p.potions || [])) {
      const cn = constname(pl.id);
      const bot = bottleSet(pl);
      const instances = yvInstanceList(p, pl);
      rows.push(`    /** ${pl.naam || pl.id} – potion-entry (brouwen + vanilla-fles-resolver) */`);
      rows.push(`    public static final Potion ${cn}_POTION = net.minecraft.registry.Registry.register(net.minecraft.registry.Registry.POTION, ${idExpr(p, `"${pl.id}"`)}, new Potion(${instances}));`);
      const std = itemSettings(p) + ".maxCount(1)";
      if (bot.normaal) rows.push(`    public static final Item ${cn} = net.minecraft.registry.Registry.register(net.minecraft.registry.Registries.ITEM, ${idExpr(p, `"${pl.id}"`)}, new Drink("${ns}:${pl.id}", ${std}));`);
      if (bot.splash) rows.push(`    public static final Item ${cn}_SPLASH = net.minecraft.registry.Registry.register(net.minecraft.registry.Registries.ITEM, ${idExpr(p, `"${pl.id}_splash"` )}, new SplashB("${ns}:${pl.id}", ${std}));`);
      if (bot.lingering) rows.push(`    public static final Item ${cn}_LINGERING = net.minecraft.registry.Registry.register(net.minecraft.registry.Registries.ITEM, ${idExpr(p, `"${pl.id}_lingering"` )}, new LingB("${ns}:${pl.id}", ${std}));`);
      if (bot.pijl) rows.push(`    public static final Item ${cn}_ARROW = net.minecraft.registry.Registry.register(net.minecraft.registry.Registries.ITEM, ${idExpr(p, `"${pl.id}_arrow"` )}, new TippedB("${ns}:${pl.id}", ${itemSettings(p)}));`);
      rows.push("");
    }

    const tabAdds = (p.potions || []).filter((pl) => bottleSet(pl).normaal)
      .map((pl) => `            entries.add(${constname(pl.id)});`).join("\n");

    return `package ${javaPackage(p)};

import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.LingeringPotionItem;
import net.minecraft.item.PotionItem;
import net.minecraft.item.SplashPotionItem;
import net.minecraft.item.TippedArrowItem;
import net.minecraft.potion.Potion;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * Drankjes van ${p.meta.name} – BlockyMod Studio.
 * ⚠️ Fles-klassen zetten de "Potion"-NBT automatisch → drinken/gooid werkt
 *    met de gewone Minecraft-animaties. Compile-fout op een klasse-naam? → AI-fix.
 */
public final class ModPotions {
    private ModPotions() {}

${rows.join("\n") || "    // (nog geen drankjes)"}

    // ── Fles-klassen (NBT-vuller + vanilla gedrag) ──

    /** Drinkfles – effecten uit de Potion-registry (animatie blijft standaard). */
    public static class Drink extends PotionItem {
        private final String pot;

        public Drink(String pot, Item.Settings s) {
            super(s);
            this.pot = pot;
        }

        @Override
        public ActionResult use(World world, PlayerEntity user, Hand hand) {
            ItemStack st = user.getStackInHand(hand);
            if (st.getNbt() == null || !st.getNbt().contains("Potion")) st.getOrCreateNbt().putString("Potion", pot);
            return super.use(world, user, hand);
        }
    }

    /** Spetterfles (splash). */
    public static class SplashB extends SplashPotionItem {
        private final String pot;

        public SplashB(String pot, Item.Settings s) {
            super(s);
            this.pot = pot;
        }

        @Override
        public ActionResult use(World world, PlayerEntity user, Hand hand) {
            ItemStack st = user.getStackInHand(hand);
            if (st.getNbt() == null || !st.getNbt().contains("Potion")) st.getOrCreateNbt().putString("Potion", pot);
            return super.use(world, user, hand);
        }
    }

    /** Wolkfles (lingering). */
    public static class LingB extends LingeringPotionItem {
        private final String pot;

        public LingB(String pot, Item.Settings s) {
            super(s);
            this.pot = pot;
        }

        @Override
        public ActionResult use(World world, PlayerEntity user, Hand hand) {
            ItemStack st = user.getStackInHand(hand);
            if (st.getNbt() == null || !st.getNbt().contains("Potion")) st.getOrCreateNbt().putString("Potion", pot);
            return super.use(world, user, hand);
        }
    }

    /** Gepijlde pijl (tipped arrow). ⚠️ createArrow-signatuur kan per mappingsversie wijzigen → AI-fix. */
    public static class TippedB extends TippedArrowItem {
        private final String pot;

        public TippedB(String pot, Item.Settings s) {
            super(s);
            this.pot = pot;
        }

        @Override
        public net.minecraft.entity.projectile.arrow.ArrowEntity createArrow(World world, ItemStack stack, PlayerEntity user, Hand hand) {
            if (stack.getNbt() == null || !stack.getNbt().contains("Potion")) stack.getOrCreateNbt().putString("Potion", pot);
            return super.createArrow(world, stack, user, hand);
        }
    }

    public static void register() {
        // velden hierboven registreren zichzelf${tabAdds ? `; items in de creatieve tab:
        net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents.modifyEntriesEvent(net.minecraft.item.ItemGroups.INGREDIENTS).register(entries -> {
${tabAdds}
        });` : ""}
    }
}
`;
  }


  // ── Klassen-fragmenten: interactie-geluid (blok/item) + drink-flesje ──
  const YARN_BLOCK_CLS = `
    /** Rechtsklik op het blok → geluid (BlockyMod Studio). */
    private static class InteractBlock extends Block {
        private final net.minecraft.sound.SoundEvent snd;

        InteractBlock(net.minecraft.sound.SoundEvent snd, AbstractBlock.Settings s) {
            super(s);
            this.snd = snd;
        }

        @Override
        public net.minecraft.util.ActionResult onUse(net.minecraft.block.BlockState state, net.minecraft.world.World world, net.minecraft.util.math.BlockPos pos, net.minecraft.entity.player.PlayerEntity player, net.minecraft.util.Hand hand, net.minecraft.util.hit.BlockHitResult hit) {
            if (!world.isClient()) {
                world.playSound(null, pos, snd, net.minecraft.sound.SoundSource.BLOCKS, 1.0F, 1.0F);
            }
            return super.onUse(state, world, pos, player, hand, hit);
        }
    }
`;

  const MOJ_BLOCK_CLS = `
    /** Rechtsklik op het blok → geluid (BlockyMod Studio). */
    private static class InteractBlock extends Block {
        private final net.minecraft.sounds.SoundEvent snd;

        InteractBlock(net.minecraft.sounds.SoundEvent snd, BlockBehaviour.Properties p) {
            super(p);
            this.snd = snd;
        }

        @Override
        protected net.minecraft.world.level.block.state.BlockState useWithoutItem(net.minecraft.world.level.block.state.BlockState state, net.minecraft.core.Level level, net.minecraft.core.BlockPos pos, net.minecraft.world.entity.player.Player player, net.minecraft.world.phys.BlockHitResult hit) {
            if (!level.isClientSide()) {
                level.playSound(null, pos, snd, net.minecraft.world.level.SoundSource.BLOCKS, 1.0F, 1.0F);
            }
            return super.useWithoutItem(state, level, pos, player, hit);
        }
    }
`;

  const YARN_ITEM_CLS = `
    /** Rechtsklik met het item → geluid (BlockyMod Studio). */
    private static class UseSoundItem extends Item {
        private final net.minecraft.sound.SoundEvent snd;

        UseSoundItem(net.minecraft.sound.SoundEvent snd, Item.Settings s) {
            super(s);
            this.snd = snd;
        }

        @Override
        public net.minecraft.util.ActionResult use(net.minecraft.world.World world, net.minecraft.entity.player.PlayerEntity user, net.minecraft.util.Hand hand) {
            if (!world.isClient()) {
                world.playSound(null, user.getBlockPos(), snd, net.minecraft.sound.SoundSource.PLAYERS, 1.0F, 1.0F);
            }
            return super.use(world, user, hand);
        }
    }
`;

  const MOJ_ITEM_CLS = `
    /** Rechtsklik met het item → geluid (BlockyMod Studio). */
    private static class UseSoundItem extends Item {
        private final net.minecraft.sounds.SoundEvent snd;

        UseSoundItem(net.minecraft.sounds.SoundEvent snd, Item.Properties p) {
            super(p);
            this.snd = snd;
        }

        @Override
        public net.minecraft.world.InteractionResult use(net.minecraft.world.level.Level level, net.minecraft.world.entity.player.Player player, net.minecraft.world.InteractionHand hand) {
            if (!level.isClientSide()) {
                level.playSound(null, player.blockPosition(), snd, net.minecraft.world.level.SoundSource.PLAYERS, 1.0F, 1.0F);
            }
            return super.use(level, player, hand);
        }
    }
`;

  const MOJ_DRINK_CLASS = `
    /** Zelf-drinkbaar flesje – effecten direct toepenen (26.3). ⚠️ drink-animatie erbij? → AI-fix. */
    private static class BMDrinkItem extends Item {
        private final java.util.List<net.minecraft.world.effect.MobEffectInstance> effects;

        BMDrinkItem(java.util.List<net.minecraft.world.effect.MobEffectInstance> effects, Item.Properties p) {
            super(p);
            this.effects = effects;
        }

        @Override
        public net.minecraft.world.InteractionResult use(net.minecraft.world.level.Level level, net.minecraft.world.entity.player.Player player, net.minecraft.world.InteractionHand hand) {
            if (!level.isClientSide()) {
                for (net.minecraft.world.effect.MobEffectInstance ie : effects) {
                    player.addEffect(new net.minecraft.world.effect.MobEffectInstance(ie.getEffect(), ie.getDuration(), ie.getAmplifier()));
                }
                net.minecraft.world.item.ItemStack st = player.getItemInHand(hand);
                st.shrink(1);
                if (st.isEmpty()) {
                    player.getInventory().add(new net.minecraft.world.item.ItemStack(net.minecraft.world.item.Items.GLASS_BOTTLE));
                }
                player.swing(hand);
            }
            return net.minecraft.world.InteractionResult.sidedSuccess(level.isClientSide());
        }
    }
`;

  /** Eigen status-effecten → ModEffects.java (beide mappings). */
  function modEffects(p) {
    const ns = p.meta.modId;
    const moj = isMojmap(p);
    const catOf = (e) => e.gedrag === "schade" ? "HARMFUL" : e.gedrag === "genezing" ? "BENEFICIAL" : "NEUTRAL";
    const cat = (e) => moj ? `net.minecraft.world.effect.MobEffectCategory.${catOf(e)}` : `net.minecraft.entity.effect.StatusEffectCategory.${catOf(e)}`;
    const hex = (e) => "0x" + String(e.kleur || "#55cc55").replace(/^#/, "").padEnd(6, "0").slice(0, 6).toUpperCase();
    const fields = (p.effects || []).map((e) => {
      let overrides = "";
      if (e.gedrag === "schade") {
        overrides = moj
          ? ` {\n                // ⚠️ Tick-methode-namen verschillen per mappings-versie (AI-fix bij compile-fout)\n                @Override\n                public boolean shouldApplyEffectTickThisTick(int duration, int amplifier) {\n                    return duration % 40 == 0;\n                }\n\n                @Override\n                public void applyEffectTick(net.minecraft.world.entity.LivingEntity entity, int amplifier) {\n                    entity.hurt(entity.damageSources().magic(), 1.0F);\n                }\n            }`
          : ` {\n                // ⚠️ Tick-methode-namen verschillen per mappings-versie (AI-fix bij compile-fout)\n                @Override\n                public boolean canApplyUpdateEffect(int duration, int amplifier) {\n                    return duration % 40 == 0;\n                }\n\n                @Override\n                public void applyUpdateEffect(net.minecraft.entity.LivingEntity entity, int amplifier) {\n                    entity.damage(entity.getDamageSources().magic(), 1.0F);\n                }\n            }`;
      } else if (e.gedrag === "genezing") {
        overrides = moj
          ? ` {\n                // ⚠️ Tick-methode-namen verschillen per mappings-versie (AI-fix bij compile-fout)\n                @Override\n                public boolean shouldApplyEffectTickThisTick(int duration, int amplifier) {\n                    return duration % 60 == 0;\n                }\n\n                @Override\n                public void applyEffectTick(net.minecraft.world.entity.LivingEntity entity, int amplifier) {\n                    entity.heal(1.0F);\n                }\n            }`
          : ` {\n                // ⚠️ Tick-methode-namen verschillen per mappings-versie (AI-fix bij compile-fout)\n                @Override\n                public boolean canApplyUpdateEffect(int duration, int amplifier) {\n                    return duration % 60 == 0;\n                }\n\n                @Override\n                public void applyUpdateEffect(net.minecraft.entity.LivingEntity entity, int amplifier) {\n                    entity.heal(1.0F);\n                }\n            }`;
      }
      const cn = constname(e.id);
      if (moj) {
        return `    public static final net.minecraft.world.effect.MobEffect ${cn} = register("${e.id}",\n            new net.minecraft.world.effect.MobEffect(${cat(e)}, ${hex(e)})${overrides});`;
      }
      return `    public static final net.minecraft.entity.effect.StatusEffect ${cn} = net.minecraft.registry.Registry.register(\n            net.minecraft.registry.Registries.STATUS_EFFECT,\n            ${idExpr(p, `"${e.id}"`)},\n            new net.minecraft.entity.effect.StatusEffect(${cat(e)}, ${hex(e)})${overrides});`;
    }).join("\n\n");
    if (moj) {
      return `package ${javaPackage(p)};

/**
 * Eigen status-effecten van ${p.meta.name} – BlockyMod Studio.
 * 🎨 Alleen-visueel hoeft geen extra code; schade/genezing hebben tick-haksels
 *    (⚠️ methode-namen kunnen per mappings-versie verschillen → AI-fix).
 */
public final class ModEffects {
    private ModEffects() {}

${fields || "    // (nog geen eigen effecten)"}

    private static net.minecraft.world.effect.MobEffect register(String id, net.minecraft.world.effect.MobEffect effect) {
        net.minecraft.resources.ResourceKey<net.minecraft.world.effect.MobEffect> key =
                net.minecraft.resources.ResourceKey.create(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.key(), ModMain.id(id));
        return net.minecraft.core.registry.Registry.register(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT, key, effect);
    }

    public static void initialize() {
        // velden hierboven registreren zichzelf bij het laden van de klasse
    }
}
`;
    }
    return `package ${javaPackage(p)};

/**
 * Eigen status-effecten van ${p.meta.name} – BlockyMod Studio.
 * 🎨 Alleen-visueel hoeft geen extra code; schade/genezing hebben tick-haksels
 *    (⚠️ methode-namen kunnen per mappings-versie verschillen → AI-fix).
 */
public final class ModEffects {
    private ModEffects() {}

${fields || "    // (nog geen eigen effecten)"}

    public static void register() {
        // velden hierboven registreren zichzelf bij het laden van de klasse
    }
}
`;
  }

  function modMain(p) {
    if (isMojmap(p)) return modMainM(p);
    const story = p.story.chapters.length ? "        story.StoryEvents.register();\n" : "";
    const snd = (p.sounds && p.sounds.length) ? "        ModSounds.register();\n" : "";
    const effReg = (p.effects && p.effects.length) ? "        ModEffects.register();\n" : "";
    const potReg = (p.potions && p.potions.length) ? "        ModPotions.register();\n" : "";
    const brew = (p.potions || []).filter((pl) => pl.brew && pl.brew.on !== false).map((pl) => {
      const ingr = BREW_INGR[pl.brew.ingr] || "NETHER_WART";
      const from = pl.brew.van === "awkward" ? "awkward" : "water";
      const mcId = is121(p)
        ? `net.minecraft.util.Identifier.of("minecraft", "${from}")`
        : `new net.minecraft.util.Identifier("minecraft", "${from}")`;
      return `        // 🧪 ${pl.naam || pl.id} brouwen (basis: ${from})
        net.fabricmc.fabric.api.registry.BrewingRecipeRegistry.registerPotionRecipe(
                net.minecraft.registry.Registry.get(net.minecraft.registry.Registry.POTION, ${mcId}),
                net.minecraft.item.Items.${ingr},
                ModPotions.${constname(pl.id)}_POTION);`;
    }).join("\n");
    const brewAll = brew ? brew + "\n" : "";
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
${p.guis.length ? "        gui.ModScreenHandlers.register();\n" : ""}${(p.enchants && p.enchants.length) ? "        ModEnchantments.register();\n" : ""}${effReg}${potReg}${snd}${brewAll}${story}
        LOGGER.info("[{}] geïnitialiseerd – veel bouwplezier!", MOD_ID);
    }
}
`;
  }

  function modBlocks(p) {
    if (isMojmap(p)) return modBlocksM(p);
    const consts = uniqueConsts(p.blocks.map((b) => b.id));
    let fields = "";
    let regs = "";
    for (const b of p.blocks) {
      const c = consts.get(b.id);
      const resistance = (Math.round((b.hardness || 1) * 5 * 10) / 10).toFixed(1);
      const tool = b.requiresTool ? (b.tool || "pickaxe") : "none";
      const iSnd = b.interactSound ? triggerSoundRef(p, { triggerSound: b.interactSound }, "yarn") : null;
      const lines = [
        `    public static final Block ${c} = new ${iSnd ? `InteractBlock(${iSnd}, AbstractBlock.Settings.create()` : `Block(AbstractBlock.Settings.create()`}`,
        materialLine(p, tool),
        `            .strength(${(b.hardness ?? 1).toFixed(1)}F, ${resistance}F)`
      ];
      if (b.requiresTool) lines.push(`            .requiresTool()`);
      if (b.light > 0) lines.push(`            .lightLevel(state -> ${b.light})`);
      if ((b.blast || 0) > 0) lines.push(`            .explosionResistance(${Number(b.blast).toFixed(1)}F)`);
      if (b.friction && Math.abs(b.friction - 0.6) > 0.001) lines.push(`            .slipperiness(${Number(b.friction).toFixed(2)}F)`);
      if (b.noCollision) lines.push(`            .noCollision()`);
      if (b.mapColor) lines.push(`            .mapColor(net.minecraft.block.MapColor.${String(b.mapColor).toUpperCase()})`);
      if (b.randomTicks) lines.push(`            .randomTicks()`);
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
${p.blocks.some((b) => b.interactSound) ? YARN_BLOCK_CLS : ""}
}
`;
  }

  function soundGroup(b) {
    const t = b.tool || "pickaxe";
    if (b.sound) return b.sound;
    return { pickaxe: "STONE", axe: "WOOD", shovel: "STONE", hoe: "GRASS" }[t] || "STONE";
  }

  function modItems(p) {
    if (isMojmap(p)) return modItemsM(p);
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
      if (isArmor(it)) {
        const hp = armorHp(it);
        fields += `    public static final Item ${c} = new ArmorItem(${armorMaterialY(p, it, hp)}, ArmorItem.Type.${ARMOR_SLOTS[it.armor.slot]}, ${settings}.maxDamage(${hp}));\n`;
        regs += `        Registry.register(Registries.ITEM, ModMain.id("${it.id}"), ${c});\n`;
        continue;
      }
      const bits = [];
      const dmg = it.maxDamage | 0;
      if (dmg > 0) bits.push(`maxDamage(${dmg})`);
      else bits.push(`maxCount(${it.maxStack || 64})`);
      if (it.rarity) bits.push(`rarity(net.minecraft.util.Rarity.${String(it.rarity).toUpperCase()})`);
      if (it.fireproof) bits.push("fireproof()");
      const s = settings + "." + bits.join(".");
      const iSnd = (!isArmor(it) && it.interactSound) ? triggerSoundRef(p, { triggerSound: it.interactSound }, "yarn") : null;
      fields += `    public static final Item ${c} = new ${iSnd ? `UseSoundItem(${iSnd}, ${s})` : `Item(${s})`};\n`;
      regs += `        Registry.register(Registries.ITEM, ModMain.id("${it.id}"), ${c});\n`;
    }
    for (const m of p.mobs) {
      const c = byId.get(m.id + "_spawn_egg");
      fields += `    public static final Item ${c} = new SpawnEggItem(ModEntities.${constname(m.id)}, 0x${padHex(m.colors ? m.colors.primary : "ffffff")}, 0x${padHex(m.colors ? m.colors.secondary : "aaaaaa")}, ${itemSettings(p)});\n`;
      regs += `        Registry.register(Registries.ITEM, ModMain.id("${m.id}_spawn_egg"), ${c});\n`;
    }

    const blockTabEvs = p.blocks.length ? `
        // 🗂 Blokken in de creatieve tab (1.20.1) ⚠️ API-naam wijkt mogelijk af → AI-fix
        net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents.modifyEntriesEvent(net.minecraft.item.ItemGroups.BUILDING_BLOCKS).register(entries -> {
${p.blocks.map((b) => `            entries.add(${consts.get(b.id)});`).join("\n")}
        });` : "";
    const itemTabFields = [
      ...p.items.map((it) => byId.get(it.id)),
      ...p.mobs.map((m) => byId.get(m.id + "_spawn_egg"))
    ].filter(Boolean);
    const itemTabEvs = itemTabFields.length ? `
        // 🗂 Items in de creatieve tab (1.20.1) ⚠️ API-naam wijkt mogelijk af → AI-fix
        net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents.modifyEntriesEvent(net.minecraft.item.ItemGroups.INGREDIENTS).register(entries -> {
${itemTabFields.map((f) => `            entries.add(${f});`).join("\n")}
        });` : "";
    const imports = new Set(["import net.minecraft.item.BlockItem;",
      "import net.minecraft.item.Item;", "import net.minecraft.registry.Registries;",
      "import net.minecraft.registry.Registry;",
      "import net.minecraft.item.ArmorItem;", "import net.minecraft.item.ArmorMaterial;"]);
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
${regs || "        // niets te registreren"}${blockTabEvs}${itemTabEvs}
    }
${p.items.some((it) => it.interactSound && !isArmor(it)) ? YARN_ITEM_CLS : ""}
}
`;
  }

  function padHex(h) {
    let s = String(h || "ffffff").replace(/^#/, "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join(""); // #fc0 → ffcc00
    return s.padStart(6, "0").slice(0, 6);
  }

  function modEntities(p) {
    if (isMojmap(p)) return modEntitiesM(p);
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
    if (isMojmap(p)) return entityClassM(p, m);
    const goalsY = behaviorGoals(m, "yarn");
    const trigY = triggersBlock(p, m, "yarn");
    const cn = classname(m.id);
    const gui = m.guiId ? getGuiP(p, m.guiId) : null;
    const guiHandler = gui ? classname(gui.id) + "ScreenHandler" : null;
    const dropRefs = (m.drops || []).filter((d) => d.id).map((d) => ({ d, ref: itemRef(p, d.id) }));
    const needsModItems = dropRefs.some(({ ref }) => ref.startsWith("ModItems."));
    const dropsLines = dropRefs.map(({ d, ref }) =>
      `            if (RNG.nextFloat() <= ${(d.chance ?? 1).toFixed(2)}F) {
                this.dropStack(new ItemStack(${ref}, ${Math.max(1, d.count || 1)}));
            }`).join("\n");

    const iSndY = m.interactSound ? triggerSoundRef(p, { triggerSound: m.interactSound }, "yarn") : "";
    let interact = "";
    if (guiHandler || iSndY) {
      interact = `
    /**
     * Rechtermuisklik op de mob${guiHandler ? " → opent je GUI \"" + gui.name + "\"" : " → speelt een geluid"}.
     */
    @Override
    public boolean interactMob(PlayerEntity player, Hand hand) {
${iSndY ? `        if (!this.getWorld().isClient()) {
            this.playSound(${iSndY}, 1.0F, 1.0F);
        }` : ""}
${guiHandler ? `        if (!this.getWorld().isClient() && player instanceof ServerPlayerEntity serverPlayer) {
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
        }` : ""}
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
${goalsY ? goalsY + "\n" : ""}    }
${trigY}
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
    if (isMojmap(p)) return modScreenHandlersM(p);
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
    if (isMojmap(p)) return screenHandlerM(p, g);
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
    if (isMojmap(p)) return screenClassM(p, g);
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
    if (isMojmap(p)) return modClientM(p);
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
    const result121 = usesNewDirs(p);
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
    for (const e of (p.enchants || [])) {
      en[`enchantment.${ns}.${e.id}`] = e.name || e.id;
      nl[`enchantment.${ns}.${e.id}`] = e.name || e.id;
    }
    for (const s of (p.sounds || [])) {
      en[`subtitles.${ns}.${s.id}`] = s.naam || s.id;
      nl[`subtitles.${ns}.${s.id}`] = s.naam || s.id;
    }
    for (const fx of (p.effects || [])) {
      en[`effect.${ns}.${fx.id}`] = fx.naam || fx.id;
      nl[`effect.${ns}.${fx.id}`] = fx.naam || fx.id;
    }
    for (const pl of (p.potions || [])) {
      const bot = pl.bottles || { normaal: true, splash: true, lingering: true, pijl: true };
      const variants = [
        [bot.normaal, "", "🧪 "],
        [bot.splash, "_splash", "💦 "],
        [bot.lingering, "_lingering", "☁️ "],
        [bot.pijl, "_arrow", "🏹 "]
      ];
      for (const [on, suf, pre] of variants) {
        if (!on) continue;
        en[`item.${ns}.${pl.id}${suf}`] = pre + (pl.naam || pl.id) + (suf ? ` (${suf.replace("_", "")})` : "");
        nl[`item.${ns}.${pl.id}${suf}`] = pre + (pl.naam || pl.id) + (suf ? " (" + (suf === "_splash" ? "spetter" : suf === "_lingering" ? "wolk" : "pijl") + ")" : "");
      }
      en[`potion.${ns}.${pl.id}`] = pl.naam || pl.id; // 1.20.1 vanilla-fles naam
      nl[`potion.${ns}.${pl.id}`] = pl.naam || pl.id;
    }
    return { en, nl };
  }

  // ════════════════════════════════════════════════════════════════
  //  VERHAAL → JAVA
  // ════════════════════════════════════════════════════════════════

  function storyManager(p) {
    if (isMojmap(p)) return storyManagerM(p);
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
            case "geluid" -> runCommand(player, "playsound " + getStr(a, "sound", "minecraft:block.note_block.pling") + " master @s ~ ~ ~ " + getStr(a, "volume", "1") + " " + getStr(a, "pitch", "1"));
            case "partikel" -> runCommand(player, "particle " + getStr(a, "particle", "minecraft:flame") + " ~ ~1 ~ 0.2 0.5 0.2 0.02 " + (a.has("count") ? a.get("count").getAsInt() : 20));
            case "effect" -> {
                var ef = net.minecraft.registry.Registries.STATUS_EFFECT.get(net.minecraft.util.Identifier.tryParse(getStr(a, "effect", "minecraft:speed")));
                if (ef != null) {
                    player.addStatusEffect(new net.minecraft.entity.effect.StatusEffectInstance(ef,
                            a.has("dur") ? a.get("dur").getAsInt() * 20 : 200,
                            a.has("amp") ? a.get("amp").getAsInt() : 0));
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
    if (isMojmap(p)) return storyEventsM(p);
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
  //  MODERNE TEMPLATES – officiële Mojang-mappings (Minecraft 26.x)
  //  Bron: docs.fabricmc.net (26.2-voorbeelden) + Fabric-release-notes
  // ════════════════════════════════════════════════════════════════

  function buildGradleM(p) {
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
    mappings loom.officialMojangMappings()
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
    it.options.encoding = 'UTF-8'
}

java {
    withSourcesJar()
    toolchain {
        languageVersion = JavaLanguageVersion.of(${prof.java})
    }
}

jar {
    from("LICENSE") {
        rename { "\${it}_\${project.base.archivesName.get()}" }
    }
}
`;
  }

  function gradlePropsM(p) {
    const prof = profile(p);
    return `org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true

minecraft_version=${p.meta.mcVersion}
loader_version=${prof.loader}
fabric_version=${prof.fabric}

mod_version=${p.meta.version}
maven_group=${javaPackage(p)}
archives_base_name=${p.meta.modId}
`;
  }

  function modMainM(p) {
    const gui = p.guis.length ? "        gui.ModScreenHandlers.initialize();\n" : "";
    const creative = "        CreativeTab.initialize(); // ⚠️ zie CreativeTab.java\n";
    const effRegM = (p.effects && p.effects.length) ? "        ModEffects.initialize();\n" : "";
    const story = p.story.chapters.length ? "        story.StoryEvents.register();\n" : "";
    const snd = (p.sounds && p.sounds.length) ? "        ModSounds.register();\n" : "";
    return `package ${javaPackage(p)};

import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.ResourceLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hoofdklasse van ${p.meta.name} – gegenereerd door BlockyMod Studio.
 * Doelversie: Minecraft ${p.meta.mcVersion} (officiële Mojang-mappings).
 */
public class ModMain implements ModInitializer {
    public static final String MOD_ID = "${p.meta.modId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(MOD_ID, path);
    }

    @Override
    public void onInitialize() {
        ModBlocks.initialize();
        ModItems.initialize();
        ModEntities.initialize();
${effRegM}${gui}${creative}${snd}${story}
        LOGGER.info("[{}] geïnitialiseerd – veel bouwplezier!", MOD_ID);
    }
}
`;
  }

  function modBlocksM(p) {
    const fields = p.blocks.map((b) => {
      const resistance = (Math.round((b.hardness || 1) * 5 * 10) / 10).toFixed(1);
      const sound = soundGroup(b);
      const iSnd = b.interactSound ? triggerSoundRef(p, { triggerSound: b.interactSound }, "mojmap") : null;
      const lines = [
        `    public static final Block ${constname(b.id)} = registerBlock("${b.id}", ${iSnd ? `props -> new InteractBlock(${iSnd}, props)` : `Block::new`},`,
        `            BlockBehaviour.Properties.of()`,
        `                    .strength(${(b.hardness ?? 1).toFixed(1)}F, ${resistance}F)`
      ];
      if (b.requiresTool) lines.push(`                    .requiresCorrectToolForDrops()`);
      if (b.light > 0) lines.push(`                    .lightLevel(state -> ${b.light})`);
      if ((b.blast || 0) > 0) lines.push(`                    .explosionResistance(${Number(b.blast).toFixed(1)}F)`);
      if (b.friction && Math.abs(b.friction - 0.6) > 0.001) lines.push(`                    .friction(${Number(b.friction).toFixed(2)}F)`);
      if (b.noCollision) lines.push(`                    .noCollission()`);
      if (b.mapColor) lines.push(`                    .mapColor(net.minecraft.world.level.material.MapColor.${String(b.mapColor).toUpperCase()})`);
      if (b.randomTicks) lines.push(`                    .randomTicks()`);
      lines.push(`                    .sound(SoundType.${sound}));`);
      return lines.join("\n");
    }).join("\n\n");

    const regs = p.blocks.map((b) =>
      `        // "${b.id}" – registratie gebeurt via de statische velden (zie initialize())`).join("\n");

    return `package ${javaPackage(p)};

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.BlockBehaviour;
import net.minecraft.world.level.block.SoundType;

/**
 * Alle blokken van deze mod.
 * ⛏ = blok-eigenschappen pas je hier aan (hardheid, licht, etc.)
 */
public final class ModBlocks {
    private ModBlocks() {}

${fields || "    // (nog geen blokken – maak er een in BlockyMod Studio!)"}

    /** Registreert een blok met verplichte registry-key (1.21.2+ / 26.x). */
    private static Block registerBlock(String path,
            java.util.function.Function<BlockBehaviour.Properties, Block> factory,
            BlockBehaviour.Properties properties) {
        ResourceKey<Block> key = ResourceKey.create(Registries.BLOCK, ModMain.id(path));
        return Registry.register(BuiltInRegistries.BLOCK, key, factory.apply(properties.setId(key)));
    }

    public static void initialize() {
${p.blocks.length ? (regs || "        // geladen via statische velden") : "        // niets te registreren"}
    }
${p.blocks.some((b) => b.interactSound) ? MOJ_BLOCK_CLS : ""}
}
`;
  }

  function modItemsM(p) {
    const blockItems = p.blocks.map((b) =>
      `    public static final BlockItem ${constname(b.id)} = registerBlockItem("${b.id}", ModBlocks.${constname(b.id)});`
    ).join("\n");
    const plainItems = p.items.map((it) => {
      const iSnd = (!isArmor(it) && it.interactSound) ? triggerSoundRef(p, { triggerSound: it.interactSound }, "mojmap") : null;
      return `    public static final Item ${constname(it.id)} = registerItem("${it.id}", props -> new ${iSnd ? `UseSoundItem(${iSnd}, props${itemPropsM(p, it)})` : `Item(props${itemPropsM(p, it)})`});`;
    }).join("\n");
    const eggs = p.mobs.map((m) =>
      `    public static final Item ${constname(m.id)}_SPAWN_EGG = registerItem("${m.id}_spawn_egg",
            props -> new SpawnEggItem(ModEntities.${constname(m.id)}, 0x${padHex(m.colors ? m.colors.primary : "ffffff")}, 0x${padHex(m.colors ? m.colors.secondary : "aaaaaa")}, props)); // ⚠️ als de kleur-ctor weg is: vraag de AI om de component-vorm`
    ).join("\n");

    const potParts = (p.potions || []).map((pl) => {
      const bot = bottleSet(pl);
      const lines = [];
      const contents = mjContents(p, pl);
      const comp = `props.component(net.minecraft.core.component.DataComponents.POTION_CONTENTS, ${contents})`;
      if (bot.normaal) lines.push(`    public static final Item ${constname(pl.id)} = registerItem("${pl.id}", props -> new BMDrinkItem(${mjInstanceList(p, pl)}, props.maxCount(1)));`);
      if (bot.splash) lines.push(`    public static final Item ${constname(pl.id + "_splash")} = registerItem("${pl.id}_splash", props -> new SplashPotionItem(${comp}.maxCount(1))); // ⚠️ klassenaam bij twijfel: AI-fix`);
      if (bot.lingering) lines.push(`    public static final Item ${constname(pl.id + "_lingering")} = registerItem("${pl.id}_lingering", props -> new LingeringPotionItem(${comp}.maxCount(1))); // ⚠️ klassenaam bij twijfel: AI-fix`);
      if (bot.pijl) lines.push(`    public static final Item ${constname(pl.id + "_arrow")} = registerItem("${pl.id}_arrow", props -> new TippedArrowItem(${comp})); // ⚠️ klassenaam bij twijfel: AI-fix`);
      return lines.join("\n");
    }).filter(Boolean).join("\n");

    const parts = [blockItems, plainItems, potParts, eggs].filter(Boolean).join("\n");

    return `package ${javaPackage(p)};

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.level.block.Block;

/**
 * Alle items van deze mod (incl. blok-items en spawn-eggs).
 * Items/blokken krijgen automatisch de juiste translation-key.
 */
public final class ModItems {
    private ModItems() {}

${parts || "    // (nog geen items)"}
${p.items.some((it) => it.interactSound && !isArmor(it)) ? MOJ_ITEM_CLS : ""}
${((p.potions || []).some((pl) => bottleSet(pl).normaal)) ? MOJ_DRINK_CLASS : ""}

    private static Item registerItem(String path,
            java.util.function.Function<Item.Properties, Item> factory) {
        ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, ModMain.id(path));
        Item item = factory.apply(new Item.Properties().setId(key));
        Registry.register(BuiltInRegistries.ITEM, key, item);
        return item;
    }

    private static BlockItem registerBlockItem(String path, Block block) {
        ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, ModMain.id(path));
        BlockItem item = new BlockItem(block, new Item.Properties().useBlockDescriptionPrefix().setId(key));
        Registry.register(BuiltInRegistries.ITEM, key, item);
        return item;
    }

    public static void initialize() {
        // geladen via statische velden
    }
}
`;
  }

  function modEntitiesM(p) {
    const fields = p.mobs.map((m) => {
      const group = m.kind === "hostile" ? "MONSTER" : "CREATURE";
      return `    public static final EntityType<${classname(m.id)}Entity> ${constname(m.id)} = register("${m.id}",
            EntityType.Builder.<${classname(m.id)}Entity>of(${classname(m.id)}Entity::new, MobCategory.${group})
                    .sized(${(m.width || 0.9).toFixed(2)}F, ${(m.height || 1.4).toFixed(2)}F)
                    .clientTrackingRange(8)
                    .updateInterval(3));`;
    }).join("\n\n");

    const attrs = p.mobs.map((m) =>
      `        FabricDefaultAttributeRegistry.register(${constname(m.id)}, ${classname(m.id)}Entity.createAttributes());`
    ).join("\n");

    return `package ${javaPackage(p)};

import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
${p.mobs.map((m) => `import ${javaPackage(p)}.entity.${classname(m.id)}Entity;`).join("\n")}

/**
 * Alle mobs van deze mod.
 */
public final class ModEntities {
    private ModEntities() {}

${fields || "    // (nog geen mobs – maak er een in BlockyMod Studio!)"}

    private static <T extends net.minecraft.world.entity.Entity> EntityType<T> register(
            String path, EntityType.Builder<T> builder) {
        ResourceKey<EntityType<T>> key = ResourceKey.create(Registries.ENTITY_TYPE, ModMain.id(path));
        return Registry.register(BuiltInRegistries.ENTITY_TYPE, key, builder.build(key));
    }

    public static void initialize() {
${p.mobs.length ? attrs : "        // niets te registreren"}
    }
}
`;
  }

  function entityClassM(p, m) {
    const goalsM = behaviorGoals(m, "mojmap");
    const trigM = triggersBlock(p, m, "mojmap");
    const cn = classname(m.id);
    const gui = m.guiId ? getGuiP(p, m.guiId) : null;
    const guiMenu = gui ? classname(gui.id) + "Menu" : null;
    const dropRefs = (m.drops || []).filter((d) => d.id).map((d) => ({ d, ref: itemRef(p, d.id) }));
    const needsModItems = dropRefs.some(({ ref }) => ref.startsWith("ModItems."));
    const dropsLines = dropRefs.map(({ d, ref }) =>
      `        if (RNG.nextFloat() <= ${(d.chance ?? 1).toFixed(2)}F) {
            this.spawnAtLocation(new ItemStack(${ref}, ${Math.max(1, d.count || 1)}));
        }`).join("\n");

    const iSndM = m.interactSound ? triggerSoundRef(p, { triggerSound: m.interactSound }, "mojmap") : "";
    let interact = "";
    if (guiMenu || iSndM) {
      interact = `
    /**
     * Rechtermuisklik op de mob${guiMenu ? " → opent je GUI \"" + gui.name + "\"" : " → speelt een geluid"}.
     */
    @Override
    protected InteractionResult mobInteract(Player player, InteractionHand hand) {
${iSndM ? `        if (!this.level().isClientSide) {
            this.playSound(${iSndM}, 1.0F, 1.0F);
        }` : ""}
${guiMenu ? `        if (!this.level().isClientSide && player instanceof ServerPlayer serverPlayer) {
            serverPlayer.openMenu(new SimpleMenuProvider(
                    (syncId, inv, p2) -> new ${guiMenu}(syncId, inv),
                    Component.literal("${escapeJava(gui.name)}")));
            return InteractionResult.sidedSuccess(this.level().isClientSide);
        }` : ""}
        return super.mobInteract(player, hand);
    }
`;
    }

    return `package ${javaPackage(p)}.entity;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.animal.Pig;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.SimpleMenuProvider;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
${guiMenu ? `import ${javaPackage(p)}.gui.${guiMenu};` : ""}
${needsModItems ? `import ${javaPackage(p)}.ModItems;` : ""}

import java.util.Random;

/**
 * ${m.name} – mod-mob gegenereerd door BlockyMod Studio (Mojang-mappings).
 * ${gui ? "Op rechtermuisklik opent: " + gui.name : "Standaard-gedrag (vraag de AI voor meer acties)."}
 */
public class ${cn}Entity extends Pig {
    private static final Random RNG = new Random();

    public ${cn}Entity(EntityType<? extends Pig> entityType, Level level) {
        super(entityType, level);
${goalsM ? goalsM + "\n" : ""}    }
${trigM}
    /** Basis-attributen (leven, snelheid, aanval). */
    public static AttributeSupplier.Builder createAttributes() {
        return Pig.createAttributes()
                .add(Attributes.MAX_HEALTH, ${(m.health || 20).toFixed(1)}F)
                .add(Attributes.MOVEMENT_SPEED, ${(m.speed || 0.25).toFixed(3)}F)
                .add(Attributes.ATTACK_DAMAGE, ${(m.damage || 3).toFixed(1)}F);
    }
${interact}
    /** Drops bij dood. */
    @Override
    protected void dropCustomDeathLoot(DamageSource source, int looting, boolean recentlyHitByPlayer) {
        super.dropCustomDeathLoot(source, looting, recentlyHitByPlayer);
        if (this.level().isClientSide) return;
${dropsLines || "        // TODO: drops instellen in BlockyMod Studio (tab Mobs) of in ai-code/"}
    }
}
`;
  }

  function modScreenHandlersM(p) {
    const fields = p.guis.map((g) =>
      `    public static final MenuType<${classname(g.id)}Menu> ${constname(g.id)} = register("${g.id}", ${classname(g.id)}Menu::new);`
    ).join("\n");
    return `package ${javaPackage(p)}.gui;

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.inventory.MenuType;

/**
 * Registreert alle GUI's (menu's) van deze mod.
 * ⚠️ Compilefout op MenuType? → Copy-paste de fout in chat, ik fix hem in ai-code/.
 */
public final class ModScreenHandlers {
    private ModScreenHandlers() {}

${fields}

    private static <T extends net.minecraft.world.inventory.AbstractContainerMenu> MenuType<T> register(
            String path, MenuType.MenuFactory<T> factory) {
        ResourceKey<MenuType<T>> key = ResourceKey.create(Registries.MENU, ModMain.id(path));
        return Registry.register(BuiltInRegistries.MENU, key, new MenuType<>(factory));
    }

    public static void initialize() {
        // geladen via statische velden
    }
}
`;
  }

  function screenHandlerM(p, g) {
    const cn = classname(g.id);
    const inputs = g.elements.filter((e) => e.type === "slot" && e.role === "input").sort((a, b) => a.index - b.index);
    const outputs = g.elements.filter((e) => e.type === "slot" && e.role === "output");
    const players = g.elements.filter((e) => e.type === "slot" && e.role === "player");

    if (g.mode === "crafting") {
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

import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.level.Level;

/**
 * Werkbank-GUI "${g.name}" (modus: crafting → werkt met alle recepten uit de tab Werkbanken).
 * Slots worden na super() naar jouw ontwerp-positie verplaatst.
 */
public class ${cn}Menu extends CraftingMenu {${posTable}
    public ${cn}Menu(int id, Inventory inventory) {
        this(id, inventory, inventory.player.level(), BlockPos.ZERO);
    }

    public ${cn}Menu(int id, Inventory inventory, Level level, BlockPos pos) {
        super(id, inventory, level, pos);
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
    public boolean stillValid(Player player) {
        return true;
    }
}
`;
    }

    // ── Vrije modus ──
    const content = [...inputs, ...outputs];
    const contentSize = content.length;
    let addLines = "";
    content.forEach((s, i) => {
      addLines += `        this.addSlot(new Slot(content, ${i}, ${s.x}, ${s.y})); // ${s.role}\n`;
    });
    players.sort((a, b) => a.index - b.index).forEach((s) => {
      addLines += `        this.addSlot(new Slot(playerInventory, ${s.index}, ${s.x}, ${s.y})); // speler ${s.index}\n`;
    });

    return `package ${javaPackage(p)}.gui;

import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.SimpleContainer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.inventory.Slot;

/**
 * Vrij GUI "${g.name}" (modus: free).
 * Koppel hier in ai-code/ jouw eigen logica (bijv. kopen, verkopen, smeden).
 */
public class ${cn}Menu extends AbstractContainerMenu {
    private final SimpleContainer content = new SimpleContainer(${Math.max(1, contentSize)});

    public ${cn}Menu(int id, Inventory playerInventory) {
        super(ModScreenHandlers.${constname(g.id)}, id);

${addLines || "        // geen slots – voeg ze toe in de GUI-ontwerper"}
    }

    /** Snel-verplaatsen (shift-klik) tussen speler en GUI. */
    @Override
    public ItemStack quickMoveStack(Player player, int index) {
        ItemStack newStack = ItemStack.EMPTY;
        Slot slot = this.slots.get(index);
        if (slot != null && slot.hasItem()) {
            ItemStack current = slot.getItem();
            newStack = current.copy();
            if (index < ${contentSize}) {
                if (!this.moveItemStackTo(current, ${contentSize}, this.slots.size(), true)) {
                    return ItemStack.EMPTY;
                }
            } else if (!this.moveItemStackTo(current, 0, ${contentSize}, false)) {
                return ItemStack.EMPTY;
            }
            if (current.isEmpty()) {
                slot.set(ItemStack.EMPTY);
            } else {
                slot.setChanged();
            }
            if (current.getCount() == newStack.getCount()) {
                return ItemStack.EMPTY;
            }
            slot.onTake(player, current);
        }
        return newStack;
    }

    @Override
    public boolean stillValid(Player player) {
        return true;
    }

    /** Inhoud van de GUI-slots (voor jouw eigen logica). */
    public SimpleContainer getContent() {
        return content;
    }
}
`;
  }

  function screenClassM(p, g) {
    const cn = classname(g.id);
    const labels = g.elements.filter((e) => e.type === "label");
    const buttons = g.elements.filter((e) => e.type === "button");
    const labelLines = labels.map((l) =>
      `        g.drawString(this.font, "${escapeJava(l.text)}", this.leftPos + ${l.x}, this.topPos + ${l.y}, 0x${javaColor(l.color)}, false);`
    ).join("\n");
    const buttonLines = buttons.map((b) =>
      `        this.addRenderableWidget(Button.builder(Component.literal("${escapeJava(b.text)}"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + ${b.x}, this.topPos + ${b.y}, ${b.w || 100}, ${b.h || 20}).build());`
    ).join("\n");

    return `package ${javaPackage(p)}.client;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;
import pkg.ModMain;
import pkg.gui.${cn}Menu;

/**
 * Scherm voor "${g.name}" – tekent je zelf-ontworpen GUI-textuur.
 */
@Environment(EnvType.CLIENT)
public class ${cn}Screen extends AbstractContainerScreen<${cn}Menu> {
    private static final ResourceLocation TEXTURE = ModMain.id("textures/gui/${g.id}.png");

    public ${cn}Screen(${cn}Menu menu, Inventory inventory, Component title) {
        super(menu, inventory, title);
        this.imageWidth = ${g.width};
        this.imageHeight = ${g.height};
        this.titleLabelX = 4000; // verberg de standaard-titel (wij tekenen onze eigen labels)
    }

    @Override
    protected void init() {
        super.init();
${buttonLines ? buttonLines + "\n" : "        // geen knoppen in dit GUI-ontwerp"}
    }

    @Override
    protected void renderBg(GuiGraphics g, float partialTick, int mouseX, int mouseY) {
        g.blit(TEXTURE, this.leftPos, this.topPos, 0, 0, this.imageWidth, this.imageHeight);
${labelLines ? labelLines : ""}
    }

    @Override
    protected void renderSlot(GuiGraphics g, Slot slot) {
        // De slot-achtergrond zit al in je eigen textuur – teken alleen het item.
        g.renderItem(slot.getItem(), slot.x, slot.y);
        g.renderItemDecorations(this.font, slot.getItem(), slot.x, slot.y);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        super.render(g, mouseX, mouseY, delta);
        this.renderTooltip(g, mouseX, mouseY);
    }
}
`;
  }

  function modClientM(p) {
    const screenRegs = p.guis.map((g) =>
      `        MenuScreens.register(ModScreenHandlers.${constname(g.id)}, ${classname(g.id)}Screen::new);`
    ).join("\n");
    const renderRegs = p.mobs.map((m) =>
      `        // TODO: eigen model/texture? Vraag de AI! (nu: varken-look als voorbeeld)
        EntityRendererRegistry.register(ModEntities.${constname(m.id)}, PigRenderer::new);`
    ).join("\n");
    const imports = new Set([
      "import net.fabricmc.api.ClientModInitializer;",
      `import ${javaPackage(p)}.ModMain;`
    ]);
    if (p.guis.length) {
      imports.add("import net.minecraft.client.gui.screens.MenuScreens;");
      imports.add(`import ${javaPackage(p)}.gui.ModScreenHandlers;`);
    }
    if (p.mobs.length) {
      imports.add("import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;");
      imports.add("import net.minecraft.client.render.entity.PigRenderer;");
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

  function creativeTabM(p) {
    const blockAccepts = p.blocks.map((b) => `                    tab.accept(ModBlocks.${constname(b.id)}.asItem());`).join("\n");
    const potAccepts = [];
    for (const pl of (p.potions || [])) {
      const bot = bottleSet(pl);
      if (bot.normaal) potAccepts.push(`                    tab.accept(ModItems.${constname(pl.id)});`);
      if (bot.splash) potAccepts.push(`                    tab.accept(ModItems.${constname(pl.id + "_splash")});`);
      if (bot.lingering) potAccepts.push(`                    tab.accept(ModItems.${constname(pl.id + "_lingering")});`);
      if (bot.pijl) potAccepts.push(`                    tab.accept(ModItems.${constname(pl.id + "_arrow")});`);
    }
    const itemAccepts = [
      ...p.items.map((it) => `                    tab.accept(ModItems.${constname(it.id)});`),
      ...p.mobs.map((m) => `                    tab.accept(ModItems.${constname(m.id)}_SPAWN_EGG);`),
      ...potAccepts
    ].join("\n");
    const blocksTab = p.blocks.length ? `
        CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.BUILDING_BLOCKS)
                .register(tab -> {
${blockAccepts}
                });` : "";
    const itemsTab = (p.items.length || p.mobs.length || (p.potions || []).length) ? `
        CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.${p.mobs.length && !p.items.length ? "SPAWN_EGGS" : "INGREDIENTS"})
                .register(tab -> {
${itemAccepts}
                });` : "";

    return `package ${javaPackage(p)};

import net.fabricmc.fabric.api.itemgroup.v1.CreativeModeTabEvents;
import net.minecraft.world.item.CreativeModeTabs;

/**
 * Zet alles in de creatieve-modus-tabbladen zodat je het direct terugvindt.
 *
 * ⚠️ ALS DIT COMPILATIEFOUTEN GEEFT (API hernoemd in een update):
 *    1. verwijder dit bestand,
 *    2. verwijder de regel "CreativeTab.initialize();" uit ModMain,
 *    3. vraag de AI in de chat om een fix → die zet ik in ai-code/.
 */
public final class CreativeTab {
    private CreativeTab() {}

    public static void initialize() {${blocksTab || ""}
${itemsTab || "        // geen losse items"}
    }
}
`;
  }

  function storyManagerM(p) {
    const ns = p.meta.modId;
    const guiImports = new Set();
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
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.SimpleMenuProvider;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;
import ${javaPackage(p)}.ModMain;
${[...guiImports].map((g) => `import ${javaPackage(p)}.gui.${classname(g.id)}Menu;`).join("\n")}

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
    public synchronized void load(MinecraftServer server) {
        try {
            ResourceLocation id = ModMain.id("story/storyline.json");
            var resource = server.getResourceManager().getResource(id);
            try (InputStream in = resource.get().open()) {
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
                    ev.id = getStr(eo, "id", ch.id + "_" + Math.abs(eo.hashCode()));
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

    public void onJoin(ServerPlayer player) {
        ensureLoaded(player);
        Progress pr = getProgress(player.getUuid());
        if (pr.chapterIndex == 0 && pr.done.isEmpty()) {
            runTrigger(player, "join");
        }
    }

    public void onKill(ServerPlayer killer, net.minecraft.world.entity.Entity killed) {
        ensureLoaded(killer);
        ResourceLocation typeId = BuiltInRegistries.ENTITY_TYPE.getKey(killed.getType());
        runTrigger(killer, "kill", "entity", String.valueOf(typeId));
    }

    public void onInteractBlock(ServerPlayer player, BlockHitResult hit) {
        ensureLoaded(player);
        ResourceLocation blockId = BuiltInRegistries.BLOCK.getKey(
                player.level().getBlockState(hit.getBlockPos()).getBlock());
        runTrigger(player, "block", "block", String.valueOf(blockId));
    }

    public void onInteractItem(ServerPlayer player, ItemStack stack) {
        ensureLoaded(player);
        ResourceLocation itemId = BuiltInRegistries.ITEM.getKey(stack.getItem());
        runTrigger(player, "item", "item", String.valueOf(itemId));
    }

    public void onWorldTick(ServerLevel level) {
        if (!loaded) load(level.getServer());
        if (level.getGameTime() % 20 != 0) return;
        for (ServerPlayer player : level.players()) {
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

    private void ensureLoaded(ServerPlayer player) {
        if (!loaded) load(player.getServer());
    }

    private Chapter currentChapter(Progress pr) {
        if (pr.chapterIndex < 0 || pr.chapterIndex >= chapters.size()) return null;
        return chapters.get(pr.chapterIndex);
    }

    private boolean matchLocation(Player player, JsonObject trigger) {
        if (trigger == null || !"location".equals(getStr(trigger, "type", ""))) return false;
        double x = trigger.has("x") ? trigger.get("x").getAsDouble() : 0;
        double y = trigger.has("y") ? trigger.get("y").getAsDouble() : 0;
        double z = trigger.has("z") ? trigger.get("z").getAsDouble() : 0;
        double r = trigger.has("r") ? trigger.get("r").getAsDouble() : 4;
        double dx = player.getX() - x, dy = player.getY() - y, dz = player.getZ() - z;
        return dx * dx + dy * dy + dz * dz <= r * r;
    }

    /** Zoek passende events in het huidige hoofdstuk en voer ze uit. */
    public void runTrigger(ServerPlayer player, String type, String field, String value) {
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

    public void runTrigger(ServerPlayer player, String type) {
        runTrigger(player, type, null, null);
    }

    /** Voer alle acties van een event uit. */
    public void runEvent(ServerPlayer player, Event ev) {
        Progress pr = getProgress(player.getUuid());
        if (pr.done.contains(ev.id)) return;
        pr.done.add(ev.id);
        for (JsonObject action : ev.actions) {
            execute(player, action);
        }
    }

    private void execute(ServerPlayer player, JsonObject a) {
        String type = getStr(a, "type", "");
        Level level = player.level();
        switch (type) {
            case "message" -> player.sendSystemMessage(Component.literal(getStr(a, "text", "")));
            case "give" -> {
                String itemId = getStr(a, "item", "minecraft:stone");
                int count = a.has("count") ? a.get("count").getAsInt() : 1;
                var item = BuiltInRegistries.ITEM.getOptional(ResourceLocation.tryParse(itemId)).orElse(null);
                if (item != null && item != Items.AIR) {
                    player.getInventory().add(new ItemStack(item, count));
                    player.displayClientMessage(Component.literal("+ " + count + " × " + itemId), true);
                }
            }
            case "weather" -> {
                String w = getStr(a, "state", "clear");
                runCommand(player, w.equals("thunder") ? "weather thunder"
                        : w.equals("rain") ? "weather rain" : "weather clear");
            }
            case "time" -> runCommand(player, "time set " + ("night".equals(getStr(a, "state", "day")) ? "night" : "day"));
            case "spawn" -> {
                String entityId = getStr(a, "entity", "minecraft:pig");
                int count = a.has("count") ? a.get("count").getAsInt() : 1;
                var typeRef = BuiltInRegistries.ENTITY_TYPE.getOptional(ResourceLocation.tryParse(entityId)).orElse(null);
                var rng = java.util.concurrent.ThreadLocalRandom.current();
                for (int i = 0; i < count && typeRef != null; i++) {
                    var entity = typeRef.create(level);
                    if (entity != null) {
                        entity.moveTo(
                                player.getX() + (rng.nextDouble() - 0.5) * 3,
                                player.getY(),
                                player.getZ() + (rng.nextDouble() - 0.5) * 3,
                                rng.nextFloat() * 360f, 0f);
                        level.addFreshEntity(entity);
                    }
                }
            }
            case "command" -> runCommand(player, getStr(a, "cmd", "say hallo"));
            case "geluid" -> runCommand(player, "playsound " + getStr(a, "sound", "minecraft:block.note_block.pling") + " master @s ~ ~ ~ " + getStr(a, "volume", "1") + " " + getStr(a, "pitch", "1"));
            case "partikel" -> runCommand(player, "particle " + getStr(a, "particle", "minecraft:flame") + " ~ ~1 ~ 0.2 0.5 0.2 0.02 " + (a.has("count") ? a.get("count").getAsInt() : 20));
            case "effect" -> {
                var ef = net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.get(net.minecraft.resources.ResourceLocation.tryParse(getStr(a, "effect", "minecraft:speed")));
                if (ef != null) {
                    player.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.core.Holder.direct(ef),
                            a.has("dur") ? a.get("dur").getAsInt() * 20 : 200,
                            a.has("amp") ? a.get("amp").getAsInt() : 0));
                }
            }
            case "gui" -> openGui(player, getStr(a, "gui", ""));
            case "next" -> {
                Progress pr = getProgress(player.getUuid());
                pr.chapterIndex++;
                Chapter ch = currentChapter(pr);
                player.sendSystemMessage(Component.literal("§6" + (ch != null ? ch.title : "Einde van het verhaal!")));
            }
            default -> ModMain.LOGGER.warn("[Story] onbekende actie: {}", type);
        }
    }

    /** Voer een commando uit (op de server). */
    private void runCommand(ServerPlayer player, String cmd) {
        if (player.getServer() != null) {
            player.getServer().getCommands()
                    .performPrefixedCommand(player.createCommandSourceStack().withPermission(2), cmd);
        }
    }

    private void openGui(ServerPlayer player, String guiId) {
        switch (guiId) {
${p.guis.filter((g) => guiImports.has(g)).map((g) =>
        `            case "${g.id}" -> player.openMenu(new SimpleMenuProvider(
                    (syncId, inv, p2) -> new ${classname(g.id)}Menu(syncId, inv),
                    Component.literal("${escapeJava(g.name)}")));`).join("\n") || "            // geen GUI's gekoppeld"}
            default -> ModMain.LOGGER.warn("[Story] onbekend gui: {}", guiId);
        }
    }
}
`;
  }

  function storyEventsM(p) {
    return `package ${javaPackage(p)}.story;

import net.fabricmc.fabric.api.entity.event.v1.ServerEntityCombatEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.InteractionResultHolder;

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
            if (entity instanceof net.minecraft.server.level.ServerPlayer player) {
                StoryManager.INSTANCE.onKill(player, killed);
            }
        });

        // Blok rechtsklikken
        UseBlockCallback.EVENT.register((player, level, hand, hitResult) -> {
            if (!level.isClientSide && player instanceof net.minecraft.server.level.ServerPlayer sp) {
                StoryManager.INSTANCE.onInteractBlock(sp, hitResult);
            }
            return InteractionResult.PASS;
        });

        // Item rechtsklikken
        UseItemCallback.EVENT.register((player, level, hand) -> {
            if (!level.isClientSide && player instanceof net.minecraft.server.level.ServerPlayer sp) {
                StoryManager.INSTANCE.onInteractItem(sp, player.getItemInHand(hand));
            }
            return InteractionResultHolder.pass(player.getItemInHand(hand));
        });

        // Locatie-triggers (elke seconde)
        ServerTickEvents.END_WORLD_TICK.register(level ->
                StoryManager.INSTANCE.onWorldTick(level));
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
    const variantJobs = (o, kind) => {
      const els = Array.isArray(o.shapes) ? o.shapes : [];
      els.forEach((e, i) => {
        if (!e.color) return;
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/${kind}/${o.id}_vorm${i}.png`,
          render: async () => TextureKit.canvasToPngBytes(TextureKit.pixelsToCanvas(TextureKit.generate("vlak", e.color, 1), 16))
        });
      });
      const fm = o.faceTex || {};
      for (const f of ["front", "back", "left", "right", "top", "bottom"]) {
        if (!fm[f] || !fm[f].length) continue;
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/${kind}/${o.id}_${f}.png`,
          render: async () => TextureKit.canvasToPngBytes(TextureKit.pixelsToCanvas(fm[f], 16))
        });
      }
    };
    for (const bb of p.blocks) variantJobs(bb, "block");
    for (const it of p.items) {
      jobs.push({
        path: `src/main/resources/assets/${ns}/textures/item/${it.id}.png`,
        render: async () => {
          let px = it.pixels;
          if (!px || !px.some(Boolean)) {
            px = TextureKit.generate(it.genStyle || "ruis", it.genColor || "#b87333", hashStr(it.id));
          }
          if (it.frames && it.frames.length) {
            return TextureKit.stripPng([px, ...it.frames]); // geanimeerde icoon
          }
          return TextureKit.canvasToPngBytes(TextureKit.pixelsToCanvas(px, 16));
        }
      });
      variantJobs(it, "item");
    }
    for (const pl of (p.potions || [])) {
      const bot = bottleSet(pl);
      for (const [on, suf] of [[bot.normaal, ""], [bot.splash, "_splash"], [bot.lingering, "_lingering"], [bot.pijl, "_arrow"]]) {
        if (!on) continue;
        const isArrow = suf === "_arrow";
        const kleur = pl.kleur || "#3366cc";
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/item/${pl.id}${suf}.png`,
          render: async () => TextureKit.canvasToPngBytes(isArrow ? TextureKit.arrowPng(16, kleur) : TextureKit.bottlePng(16, kleur))
        });
      }
    }
    for (const fx of (p.effects || [])) {
      jobs.push({
        path: `src/main/resources/assets/${ns}/textures/mob_effect/${fx.id}.png`,
        render: async () => TextureKit.canvasToPngBytes(TextureKit.armorPng(18, 18, fx.kleur || "#55cc55", 1))
      });
    }
    // wapenlagen (equipped-variant): 26.x → equipment-texturen, 1.20.1 → models/armor
    for (const it of p.items) {
      if (!isArmor(it)) continue;
      const colorOf = () => TextureKit.avgColor(it.pixels);
      if (isMojmap(p)) {
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/entity/equipment/humanoid/${it.id}.png`,
          render: async () => TextureKit.armorPng(64, 64, colorOf(), 1)
        });
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/entity/equipment/humanoid_leggings/${it.id}.png`,
          render: async () => TextureKit.armorPng(64, 64, colorOf(), 2)
        });
      } else {
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/models/armor/${it.id}_layer_1.png`,
          render: async () => TextureKit.armorPng(64, 32, colorOf(), 1)
        });
        jobs.push({
          path: `src/main/resources/assets/${ns}/textures/models/armor/${it.id}_layer_2.png`,
          render: async () => TextureKit.armorPng(64, 32, colorOf(), 2)
        });
      }
    }
    // geluiden (OGG uit de bibliotheek)
    for (const snd of (p.sounds || [])) {
      jobs.push({
        path: `src/main/resources/assets/${ns}/sounds/${snd.id}.ogg`,
        render: async () => {
          const lib = (typeof SoundLib !== "undefined" && SoundLib[snd.lib]) || null;
          if (!lib) throw new Error("Onbekend geluid: " + snd.lib);
          const bin = atob(lib.b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return arr;
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

  return { buildTextFiles, collectTextures, exportPlan, MC_PROFILES, VERSION_OPTIONS };
})();

if (typeof module !== "undefined") module.exports = { Exporters };
